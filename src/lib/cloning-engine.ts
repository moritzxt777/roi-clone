import { chromium, Page as PlaywrightPage } from 'playwright';
import prisma from '@/lib/prisma';
import { sanitizeHtml } from '@/lib/validations';
import { validateUrl } from './security/url-validator';
import crypto from 'crypto';

interface ElementNode {
  id: string;
  type: string;
  tagName: string;
  selector: string;
  content: Record<string, any>;
  styles: Record<string, any>;
  attrs: Record<string, any>;
  children: ElementNode[];
}

export async function clonePage(cloneId: string): Promise<void> {
  const clone = await prisma.clone.findUnique({
    where: { id: cloneId },
    include: { user: true },
  });

  if (!clone) throw new Error('Clone not found');

  try {
    await prisma.clone.update({
      where: { id: cloneId },
      data: { status: 'FETCHING', progress: 10 },
    });

    const targetUrl = await validateUrl(clone.sourceUrl);

    const wsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT ||
      (process.env.BROWSERLESS_API_KEY ? `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_API_KEY}` : null);

    const browser = wsEndpoint
      ? await chromium.connect(wsEndpoint)
      : await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();

      // Block unnecessary heavy resources
      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['media', 'font'].includes(type)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });

      await prisma.clone.update({
        where: { id: cloneId },
        data: { status: 'ANALYZING', progress: 50 },
      });

      // Force scroll to load lazy images/components
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 200;
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= document.body.scrollHeight || totalHeight > 10000) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              resolve();
            }
          }, 100);
        });
      });

      await page.waitForTimeout(2000); // Allow react states to settle

      // Extract all stylesheets
      const cssRules = await page.evaluate(() => {
        return Array.from(document.styleSheets)
          .map(sheet => {
            try {
              return Array.from(sheet.cssRules || []).map(rule => rule.cssText).join('\n');
            } catch (e) {
              // Handle cross-origin stylesheet access issues
              if (sheet.href) return `/* External: ${sheet.href} */`;
              return '';
            }
          })
          .join('\n');
      });

      await prisma.clone.update({
        where: { id: cloneId },
        data: { status: 'RECONSTRUCTING', progress: 70 },
      });

      // DOM Analyzer -> JSON Structure
      const domTree = await page.evaluate(() => {
        function getElementType(tagName: string, el: HTMLElement): string {
          const t = tagName.toLowerCase();
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label'].includes(t)) return 'TEXT';
          if (t === 'img') return 'IMAGE';
          if (t === 'a') return 'LINK';
          if (t === 'button' || el.getAttribute('role') === 'button') return 'BUTTON';
          if (t === 'form') return 'FORM';
          if (t === 'video') return 'VIDEO';
          if (t === 'iframe') return 'IFRAME';
          if (['div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside'].includes(t)) return 'CONTAINER';
          return 'CUSTOM';
        }

        function extractNodeData(node: HTMLElement, path: string): ElementNode | null {
          if (node.nodeType !== Node.ELEMENT_NODE) return null;
          if (['script', 'style', 'noscript', 'meta', 'link'].includes(node.tagName.toLowerCase())) return null;

          const tagName = node.tagName.toLowerCase();
          const type = getElementType(tagName, node);
          const computed = window.getComputedStyle(node);
          
          if (computed.display === 'none') return null;

          const attrs: Record<string, string> = {};
          Array.from(node.attributes).forEach(attr => {
            attrs[attr.name] = attr.value;
          });

          const content: Record<string, any> = {};
          if (type === 'TEXT' || type === 'BUTTON') content.text = node.innerText?.trim();
          if (type === 'IMAGE') {
            content.src = (node as HTMLImageElement).src;
            content.alt = (node as HTMLImageElement).alt;
          }
          if (type === 'LINK') content.href = (node as HTMLAnchorElement).href;
          if (type === 'VIDEO') content.src = (node as HTMLVideoElement).src;
          
          // Get specific structural styles
          const styles: Record<string, string> = {
            display: computed.display,
            flexDirection: computed.flexDirection,
            width: computed.width,
            height: computed.height,
            backgroundColor: computed.backgroundColor,
            color: computed.color,
            fontSize: computed.fontSize,
            fontWeight: computed.fontWeight,
            padding: computed.padding,
            margin: computed.margin,
          };

          const id = 'el-' + Math.random().toString(36).substring(2, 9);
          node.setAttribute('data-editor-id', id);

          const children: ElementNode[] = [];
          Array.from(node.childNodes).forEach((child, idx) => {
            const childData = extractNodeData(child as HTMLElement, `${path}>${tagName}:nth-child(${idx + 1})`);
            if (childData) children.push(childData);
          });

          return {
            id,
            type,
            tagName,
            selector: path,
            content,
            styles,
            attrs,
            children,
          };
        }

        return extractNodeData(document.body, 'body');
      });

      // Get Final HTML with injected data-editor-id
      const finalHtml = await page.content();
      const sanitizedHtml = sanitizeHtml(finalHtml);

      // Create Page record automatically
      const slug = (clone.name || 'projeto')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

      const pageRecord = await prisma.page.create({
        data: {
          name: clone.name || 'Projeto Clonado',
          slug,
          userId: clone.userId,
          sourceUrl: clone.sourceUrl,
          html: sanitizedHtml,
          css: cssRules,
          js: '',
          status: 'DRAFT',
        },
      });

      // Save element tree
      async function saveNode(node: ElementNode, parentId: string | null = null, position: number = 0) {
        const element = await prisma.pageElement.create({
          data: {
            pageId: pageRecord.id,
            selector: node.selector || node.tagName,
            type: node.type as any,
            content: node.content,
            styles: node.styles,
            attrs: { ...(node.attrs || {}), tagName: node.tagName },
            position,
            parentId,
          },
        });

        for (let i = 0; i < (node.children || []).length; i++) {
          await saveNode(node.children[i], element.id, i);
        }
      }

      if (domTree) {
        await saveNode(domTree);
      }

      await prisma.clone.update({
        where: { id: cloneId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          pageId: pageRecord.id,
          resultHtml: sanitizedHtml,
          resultCss: cssRules,
          resultJs: JSON.stringify(domTree),
          completedAt: new Date(),
        },
      });

      await browser.close();
    } catch (err) {
      await browser.close();
      throw err;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    await prisma.clone.update({
      where: { id: cloneId },
      data: { status: 'FAILED', error: errorMessage },
    });
    throw error;
  }
}

export async function generatePageFromClone(cloneId: string, pageId: string): Promise<void> {
  const clone = await prisma.clone.findUnique({
    where: { id: cloneId },
  });

  if (!clone || clone.status !== 'COMPLETED' || !clone.resultJs) {
    throw new Error('Clone não concluído ou sem estrutura extraída');
  }

  const domTree: ElementNode = JSON.parse(clone.resultJs);

  await prisma.page.update({
    where: { id: pageId },
    data: {
      html: clone.resultHtml || '',
      css: clone.resultCss || '',
      js: '', 
      status: 'DRAFT',
    },
  });

  // Flat out the DOM tree to save as PageElements with Parent relations
  async function saveNode(node: ElementNode, parentId: string | null = null, position: number = 0) {
    const element = await prisma.pageElement.create({
      data: {
        pageId,
        selector: node.selector || node.tagName,
        type: node.type as any,
        content: node.content,
        styles: node.styles,
        attrs: { ...(node.attrs || {}), tagName: node.tagName },
        position,
        parentId,
      },
    });

    for (let i = 0; i < node.children.length; i++) {
      await saveNode(node.children[i], element.id, i);
    }
  }

  if (domTree) {
    await saveNode(domTree);
  }
}
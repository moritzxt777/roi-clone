import prisma from '@/lib/prisma';
import { EditorElement } from '@/stores/editor-store';

export async function getEditorData(id: string, userId: string) {
  // 1. Try to find as a Clone
  const clone = await prisma.clone.findFirst({
    where: { 
      id,
      userId 
    },
    include: {
      page: {
        include: {
          elements: {
            orderBy: { position: 'asc' }
          }
        }
      }
    }
  });

  if (clone) {
    let page = clone.page;

    // If Page hasn't been generated yet for this Clone, create it now!
    if (!page) {
      const slug = (clone.name || 'projeto')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

      page = await prisma.page.create({
        data: {
          name: clone.name || 'Projeto Clonado',
          slug,
          userId: clone.userId,
          sourceUrl: clone.sourceUrl,
          html: clone.resultHtml || '',
          css: clone.resultCss || '',
          js: '',
          status: 'DRAFT',
        },
        include: {
          elements: true
        }
      });

      await prisma.clone.update({
        where: { id: clone.id },
        data: { pageId: page.id }
      });

      // Save element tree if resultJs is present
      if (clone.resultJs) {
        try {
          const domTree = JSON.parse(clone.resultJs);
          async function saveNode(node: any, parentId: string | null = null, position: number = 0) {
            const el = await prisma.pageElement.create({
              data: {
                pageId: page!.id,
                selector: node.selector || node.tagName || 'div',
                type: node.type || 'CUSTOM',
                content: node.content || {},
                styles: node.styles || {},
                attrs: { ...(node.attrs || {}), tagName: node.tagName },
                position,
                parentId,
              }
            });
            for (let i = 0; i < (node.children || []).length; i++) {
              await saveNode(node.children[i], el.id, i);
            }
          }
          await saveNode(domTree);
          
          // Re-fetch page elements
          const freshElements = await prisma.pageElement.findMany({
            where: { pageId: page.id },
            orderBy: { position: 'asc' }
          });
          page.elements = freshElements;
        } catch (e) {
          console.error('Failed to parse and save domTree:', e);
        }
      }
    }

    // Reconstruct hierarchical tree from flat elements
    const flatElements = page.elements || [];
    const elementMap = new Map();
    const rootElements: EditorElement[] = [];

    flatElements.forEach((el: any) => {
      elementMap.set(el.id, { ...el, children: [] });
    });

    flatElements.forEach((el: any) => {
      if (el.parentId && elementMap.has(el.parentId)) {
        elementMap.get(el.parentId).children.push(elementMap.get(el.id));
      } else {
        rootElements.push(elementMap.get(el.id));
      }
    });

    // If no elements in database, but resultJs is available, fallback to it
    if (rootElements.length === 0 && clone.resultJs) {
      try {
        const domTree = JSON.parse(clone.resultJs);
        if (domTree) rootElements.push(domTree);
      } catch (e) {}
    }

    // Fetch other user pages to enable instant multi-page funnel switching
    const userPages = await prisma.page.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        slug: true,
        sourceUrl: true,
        meta: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 25,
    });

    const pageMeta = (page.meta as any) || {};
    const discoveredSubpages = Array.isArray(pageMeta.subpages) ? pageMeta.subpages : [];

    return {
      pageId: page.id,
      cloneId: clone.id,
      projectName: clone.name,
      sourceUrl: clone.sourceUrl || '',
      initialElements: rootElements,
      css: page.css || clone.resultCss || '',
      html: page.html || clone.resultHtml || '',
      availablePages: userPages.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        sourceUrl: p.sourceUrl || '',
        isCurrent: p.id === page.id,
      })),
      discoveredSubpages,
      meta: pageMeta,
    };
  }

  // 2. Try to find directly as a Page
  const page = await prisma.page.findFirst({
    where: { 
      id,
      userId 
    },
    include: {
      elements: {
        orderBy: { position: 'asc' }
      }
    }
  });

  if (page) {
    const flatElements = page.elements || [];
    const elementMap = new Map();
    const rootElements: EditorElement[] = [];

    flatElements.forEach((el: any) => {
      elementMap.set(el.id, { ...el, children: [] });
    });

    flatElements.forEach((el: any) => {
      if (el.parentId && elementMap.has(el.parentId)) {
        elementMap.get(el.parentId).children.push(elementMap.get(el.id));
      } else {
        rootElements.push(elementMap.get(el.id));
      }
    });

    const userPages = await prisma.page.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        slug: true,
        sourceUrl: true,
        meta: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 25,
    });

    const pageMeta = (page.meta as any) || {};
    const discoveredSubpages = Array.isArray(pageMeta.subpages) ? pageMeta.subpages : [];

    return {
      pageId: page.id,
      cloneId: page.id,
      projectName: page.name,
      sourceUrl: page.sourceUrl || '',
      initialElements: rootElements,
      css: page.css || '',
      html: page.html || '',
      availablePages: userPages.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        sourceUrl: p.sourceUrl || '',
        isCurrent: p.id === page.id,
      })),
      discoveredSubpages,
      meta: pageMeta,
    };
  }

  return null;
}

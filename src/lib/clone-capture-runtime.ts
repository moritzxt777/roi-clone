import prisma from '@/lib/prisma';
import {
  createRecorder,
  limitBody,
  resourceKeyFor,
  shouldRecord,
  type CaptureSummary,
} from './clone-capture';
import { getAppUrl } from './url';

const TEXTUAL = /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded))/i;

/**
 * Attaches a recorder to a Playwright page and persists what it observes.
 *
 * Network recording has to be installed before navigation, because the calls a
 * single-page funnel makes on load are exactly the ones worth capturing and they
 * happen during the first paint.
 *
 * The request handler is deliberately non-blocking: Playwright's `response`
 * listener runs inside the browser's event loop, and awaiting a body read there
 * can stall navigation. The body is read with a short timeout and a size cap,
 * and a failure is recorded as a capture without a body rather than dropped.
 */
export function installCaptureRecorder(
  page: import('playwright').Page,
  options: { appOrigin: string }
): { persist: (pageId: string) => Promise<CaptureSummary> } {
  const recorder = createRecorder({ appOrigin: options.appOrigin });

  const pending: Array<Promise<void>> = [];

  page.on('response', (response) => {
    const request = response.request();
    const method = request.method();
    const url = response.url();
    const contentType = response.headers()['content-type'] ?? null;

    if (!shouldRecord(url, contentType)) return;

    const task = (async () => {
      let body: string | null = null;
      let isBase64 = false;

      try {
        const buffer = await response.body();
        if (buffer && buffer.length > 0) {
          if (TEXTUAL.test((contentType ?? '').toLowerCase())) {
            body = limitBody(buffer.toString('utf8'));
          } else {
            body = buffer.toString('base64');
            isBase64 = true;
          }
        }
      } catch {
        // A body that cannot be read — a redirect, an aborted request, a stream
        // that was already consumed — still leaves a usable status and URL, so
        // the entry is kept without a body.
        body = null;
      }

      recorder.add({
        method,
        url,
        resourceKey: resourceKeyFor(method, url),
        status: response.status(),
        contentType,
        body,
        isBase64,
        requestBody: null,
        hits: 1,
      });
    })();

    pending.push(task);
  });

  return {
    async persist(pageId: string) {
      // Everything the browser fired has to land before the summary is computed,
      // otherwise the count under-reports what was actually captured.
      await Promise.allSettled(pending);

      const summary = recorder.summary;
      const entries = recorder.toArray();
      const byKind = { fetch: 0, xhr: 0 };

      for (const entry of entries) {
        if (/\bxhr\b/i.test(entry.requestBody ?? '')) byKind.xhr++;
        else byKind.fetch++;
      }

      if (entries.length === 0) return summary;

      await prisma.cloneCapture.deleteMany({ where: { pageId } });

      await prisma.$transaction(
        entries.map((entry) =>
          prisma.cloneCapture.create({
            data: {
              pageId,
              method: entry.method,
              resourceKey: entry.resourceKey,
              requestUrl: entry.url,
              status: entry.status,
              contentType: entry.contentType,
              body: entry.isBase64 ? null : entry.body,
              bodyBase64: entry.isBase64 ? entry.body : null,
              requestBody: entry.requestBody,
              hits: entry.hits,
            },
          })
        )
      );

      return { ...summary, byKind };
    },
  };
}

/**
 * Returns the manifest URL a page's replay interceptor should read.
 */
export function manifestUrlFor(pageId: string): string {
  return `${getAppUrl()}/api/pages/capture/${pageId}`;
}

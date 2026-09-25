/**
 * Capture and replay of the requests a page makes to its own backend.
 *
 * This is the part that decides whether a cloned funnel works. The HTML of a
 * single-page funnel clones perfectly and the clone is still dead, because
 * everything that makes it a funnel — the quiz, the countdown, the validation,
 * the price table, the "step 2" transition — arrives as an XHR call to the
 * original origin. Point the clone at that origin and CORS refuses it; point it
 * nowhere and the page renders as a shell.
 *
 * Recording the request/response pairs during the clone and serving them back is
 * what turns that shell into a working page. The limits are honest:
 *
 *   - It only covers what the page requested *during the clone session*. A call
 *     made after an interaction, or with a body that varies per user, is not in
 *     the map and falls through to the network as usual.
 *   - It cannot satisfy the origin's session check, because there is no session.
 *     That is why a checkout step still has to point at a real offer.
 *   - Without Playwright there is no browser to observe, so nothing is recorded
 *     and the report says so rather than pretending.
 *
 * The match key is the method plus the path and query with the origin stripped,
 * so a capture survives a host change and cannot accidentally serve one site's
 * response to another.
 */

export type CaptureKind = 'fetch' | 'xhr';

export interface CapturedRequest {
  method: string;
  url: string;
  resourceKey: string;
  status: number;
  contentType: string | null;
  body: string | null;
  isBase64: boolean;
  requestBody: string | null;
  /** How many times the page made this exact call. */
  hits: number;
}

export interface CaptureSummary {
  recorded: number;
  skipped: number;
  byKind: Record<CaptureKind, number>;
  notes: string[];
}

/** A capture row as it sits in the database. */
export interface StoredCapture {
  method: string;
  resourceKey: string;
  status: number;
  contentType: string | null;
  body: string | null;
  bodyBase64: string | null;
  hits: number;
}

/**
 * One entry of the public replay manifest.
 *
 * `body` always carries the payload and `base64` says how to read it. The
 * interceptor decodes with `atob` when the flag is set, so an entry that sets
 * the flag while leaving `body` null replays as an empty body — a plausible 200
 * with nothing in it, which is harder to diagnose than a missing capture.
 */
export interface ManifestEntry {
  key: string;
  method: string;
  status: number;
  contentType: string | null;
  body: string | null;
  base64: boolean;
  hits: number;
}

export function toManifestEntry(capture: StoredCapture): ManifestEntry {
  return {
    key: capture.resourceKey,
    method: capture.method,
    status: capture.status,
    contentType: capture.contentType,
    body: capture.bodyBase64 ?? capture.body,
    base64: capture.bodyBase64 !== null,
    hits: capture.hits,
  };
}

const MAX_CAPTURE_BODY_BYTES = 512 * 1024;
const MAX_CAPTURE_COUNT = 250;
const MAX_BODY_PREVIEW = 400_000;

/** Response types worth keeping. Tracking beacons and analytics are noise. */
const WORTH_RECORDING = /^(application\/json|text\/|application\/xml)/i;
const NOISE = /(google-analytics|googletagmanager|facebook\.net|doubleclick|hotjar|clarity|segment\.(io|com)|mixpanel|sentry|intercom|hotjar)/i;

/** Text-ish content types are stored inline; everything else is base64. */
const TEXTUAL = /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded))/i;

/**
 * Builds the replay lookup key.
 *
 * The origin is dropped on purpose: a capture is only valid for the page it was
 * taken from, and the page id is the scope. Keeping the host would make a
 * capture stop matching the moment the clone is served from a subdomain.
 */
export function resourceKeyFor(method: string, url: string): string {
  const upper = method.toUpperCase();
  try {
    const parsed = new URL(url);
    return `${upper} ${parsed.pathname}${parsed.search}`;
  } catch {
    return `${upper} ${url}`;
  }
}

/** True when a captured request is one the replay should serve. */
export function shouldRecord(url: string, contentType: string | null): boolean {
  if (NOISE.test(url)) return false;
  if (contentType && !WORTH_RECORDING.test(contentType)) return false;
  return true;
}

export interface RecordOptions {
  maxCount?: number;
  maxBodyBytes?: number;
  /** Origin the clone is served from; requests to it are ignored. */
  appOrigin?: string;
}

export interface Recorder {
  summaries: Map<string, CapturedRequest>;
  add(request: CapturedRequest): void;
  summary: CaptureSummary;
  toArray(): CapturedRequest[];
}

/**
 * Accumulates captures, enforcing the caps as it goes.
 *
 * A page that fires four hundred analytics calls during load should not fill the
 * table, and a single 5MB response should not either. Both are dropped with a
 * counted note rather than silently.
 */
export function createRecorder(options: RecordOptions = {}): Recorder {
  const maxCount = options.maxCount ?? MAX_CAPTURE_COUNT;
  const maxBodyBytes = options.maxBodyBytes ?? MAX_CAPTURE_BODY_BYTES;
  const summaries = new Map<string, CapturedRequest>();

  let recorded = 0;
  let skipped = 0;
  let overCount = 0;
  let overSize = 0;
  let outOfScope = 0;

  const recorder: Recorder = {
    summaries,

    add(request: CapturedRequest) {
      if (options.appOrigin && request.url.startsWith(options.appOrigin)) {
        // The clone's own calls — the form endpoint, the replay route — are not
        // part of the original page's behaviour.
        outOfScope++;
        return;
      }

      if (!shouldRecord(request.url, request.contentType)) {
        skipped++;
        return;
      }

      if (!summaries.has(request.resourceKey) && summaries.size >= maxCount) {
        overCount++;
        return;
      }

      const byteLength = request.isBase64
        ? Buffer.from(request.body ?? '', 'base64').length
        : Buffer.byteLength(request.body ?? '', 'utf8');

      if (byteLength > maxBodyBytes) {
        overSize++;
        return;
      }

      const existing = summaries.get(request.resourceKey);
      if (existing) {
        // A repeated call is recorded once with a hit count; replaying the same
        // body for every repetition is what the browser observed.
        existing.hits = (existing.hits ?? 1) + 1;
        return;
      }

      summaries.set(request.resourceKey, { ...request });
      recorded++;
    },

    get summary(): CaptureSummary {
      const notes: string[] = [];
      if (overCount > 0) notes.push(`${overCount} requisição(ões) além do limite de ${maxCount} foram ignoradas.`);
      if (overSize > 0) notes.push(`${overSize} resposta(s) acima de ${Math.round(maxBodyBytes / 1024)}KB foram ignoradas.`);
      if (skipped > 0) notes.push(`${skipped} beacon(s) de analytics ignorados.`);
      if (outOfScope > 0) notes.push(`${outOfScope} chamada(s) para a própria plataforma ignoradas.`);
      if (recorded === 0) notes.push('Nenhuma chamada de API foi observada durante a clonagem.');
      return {
        recorded,
        skipped: skipped + overCount + overSize + outOfScope,
        byKind: { fetch: 0, xhr: 0 },
        notes,
      };
    },

    toArray() {
      return Array.from(summaries.values());
    },
  };

  return recorder;
}

// ---------------------------------------------------------------------------
// Replay script
// ---------------------------------------------------------------------------

/**
 * Installs a fetch/XHR interceptor that serves from a capture map first.
 *
 * Both APIs are wrapped because a funnel may use either and a half-wrapped
 * stack produces a page that works until the first component that happens to use
 * the other. Anything not in the map falls through to the real network, so the
 * interceptor degrades into a no-op rather than breaking the page.
 */
export function buildReplayScript(manifestUrl: string, appOrigin: string): string {
  return `<script id="roi-api-replay">
(function () {
  var MANIFEST = ${JSON.stringify(manifestUrl)};
  var ORIGIN = ${JSON.stringify(appOrigin)};
  var table = null;
  var loading = null;

  function key(method, url) {
    try {
      var u = new URL(url, location.href);
      return String(method || 'GET').toUpperCase() + ' ' + u.pathname + u.search;
    } catch (e) {
      return null;
    }
  }

  function load() {
    if (table) return Promise.resolve(table);
    if (loading) return loading;
    loading = fetch(MANIFEST, { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : { entries: [] }; })
      .then(function (data) {
        table = {};
        var entries = (data && data.entries) || [];
        for (var i = 0; i < entries.length; i++) {
          table[entries[i].key] = entries[i];
        }
        return table;
      })
      .catch(function () {
        table = {};
        return table;
      });
    return loading;
  }

  function toBody(entry) {
    if (entry.base64) {
      var binary = atob(entry.body || '');
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    return entry.body == null ? null : entry.body;
  }

  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;

  if (nativeFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = (init && init.method) || (input && input.method) || 'GET';
      var k = key(method, url);

      return load().then(function (t) {
        var entry = k ? t[k] : null;
        if (!entry) return nativeFetch(input, init);
        return new Response(toBody(entry), {
          status: entry.status,
          statusText: 'ROI Replay',
          headers: { 'Content-Type': entry.contentType || 'application/json' }
        });
      });
    };
  }

  var XHR = window.XMLHttpRequest;
  if (!XHR) return;

  var open = XHR.prototype.open;
  var send = XHR.prototype.send;

  XHR.prototype.open = function (method, url) {
    this.__roiKey = key(method, url);
    this.__roiMethod = String(method || 'GET').toUpperCase();
    return open.apply(this, arguments);
  };

  /**
   * XHR has no interception hook that returns a value, so a captured response is
   * delivered by pinning the read-only properties and firing the events a caller
   * listens for. This is a shim, not a spec-level interception: it covers the
   * load and readystatechange paths that a funnel's data layer actually uses,
   * and anything it cannot satisfy falls through to the native send.
   */
  XHR.prototype.send = function () {
    var self = this;
    var k = this.__roiKey;
    var args = arguments;
    if (!k) return send.apply(this, args);

    load().then(function (t) {
      var entry = t[k];
      if (!entry) {
        try { send.apply(self, args); } catch (e) {}
        return;
      }

      try {
        var text = entry.base64 ? atob(entry.body || '') : (entry.body || '');
        var json = null;
        var isJson = /json/i.test(entry.contentType || '');
        if (isJson) {
          try { json = JSON.parse(text); } catch (e) { json = null; }
        }
        var binary = entry.base64 ? atob(entry.body || '') : text;

        define(self, 'readyState', 4);
        define(self, 'status', entry.status);
        define(self, 'responseText', text);
        define(self, 'responseURL', self.responseURL || '');
        define(self, 'response', isJson ? (self.responseType === 'json' ? json : text) : binary);
        define(self, 'responseType', self.responseType);

        fire(self, 'readystatechange');
        if (self.status >= 200 && self.status < 300) {
          fire(self, 'load');
        } else {
          fire(self, 'error');
        }
      } catch (e) {
        try { send.apply(self, args); } catch (e2) {}
      }
    });

    return undefined;
  };

  function define(target, name, value) {
    try {
      Object.defineProperty(target, name, { value: value, configurable: true });
    } catch (e) {
      try { target[name] = value; } catch (e2) {}
    }
  }

  function fire(target, name) {
    try {
      target.dispatchEvent(new Event(name));
    } catch (e) {
      // Older engines without the Event constructor still get the handler called.
    }
    var handler = target['on' + name];
    if (typeof handler === 'function') {
      try { handler.call(target, { type: name, target: target }); } catch (e) {}
    }
  }
})();
</script>`;
}

/**
 * Truncates a captured body to what will actually be persisted.
 */
export function limitBody(body: string): string {
  if (body.length <= MAX_BODY_PREVIEW) return body;
  return `${body.slice(0, MAX_BODY_PREVIEW)}…[truncado]`;
}

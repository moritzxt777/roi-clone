/**
 * Form wiring for cloned pages.
 *
 * The cloner rewrote links and images but left every `<form>` exactly as the
 * original site had it. The consequence: a submission went to the original
 * operator's backend, or was blocked by CORS before it left the browser. Either
 * way the lead never reached this platform, and nothing downstream of the row
 * existed — the notification e-mail was a TODO comment.
 *
 * This module points the form at this platform's own endpoint and installs an
 * interceptor, with a working no-JavaScript path. The pure functions are
 * separated from the engine so they can be tested without a database or a
 * browser.
 *
 * Compatibility notes, because these decide whether the wire-up is invisible:
 *   - The interceptor listens on `submit`, not `click`, so the original site's
 *     own validation and custom handlers still run first. A page that blocks an
 *     invalid submit keeps doing so.
 *   - The `action` is rewritten as well as intercepted, so a visitor with
 *     JavaScript disabled still reaches the endpoint. The server accepts
 *     form-encoded bodies for that path and answers with a redirect.
 *   - Existing inline and `onsubmit` handlers are preserved; the interceptor
 *     only prevents the default when the network call is made.
 *   - The endpoint is absolute, because a clone is served from a path or a
 *     subdomain rather than the original host.
 */

import * as cheerio from 'cheerio';
import type { Cheerio } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

/** Field name the honeypot uses. No real form has it, no bot skips it. */
export const HONEYPOT_FIELD = '_roi_hp';

export interface WireFormsResult {
  html: string;
  /** How many forms were rewired. */
  formCount: number;
  /** True when at least one form had no fields at all and was left alone. */
  skipped: number;
}

export interface WireFormsOptions {
  /** Absolute endpoint that receives the submission, e.g. `https://app/api/pages/abc/form-subisations`. */
  endpoint: string;
  /** Base URL of the original site, used to report where the visit came from. */
  sourceUrl?: string;
  /** Where the native (no-JS) submission is redirected back to. */
  successRedirect?: string;
}

function absolute(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    return new URL(value, fallback).href;
  } catch {
    return fallback;
  }
}

function shouldRewire($form: Cheerio<AnyNode>): boolean {
  const method = ($form.attr('method') || '').trim().toLowerCase();

  if (method === 'get') return false;

  const fields = $form.find('input, select, textarea');
  if (fields.length === 0) return false;

  if (method === 'post') return true;

  // No method: skip if it's explicitly a search or catalog filter
  const buttonText = $form.find('[type="submit"], button').text();
  const hasSearchField = fields.toArray().some((node) => {
    const name = ((node as Element).attribs?.name || '').toLowerCase();
    return /^(q|query|s|search)$/i.test(name);
  });
  const isSearchButton = /busc|pesquis|search|filtr/i.test(buttonText);

  if (hasSearchField && isSearchButton) {
    return false;
  }

  return true;
}

/**
 * Rewrites every form in a cloned document to post into this platform.
 */
export function wireCloneForms(
  html: string,
  options: WireFormsOptions
): WireFormsResult {
  const $ = cheerio.load(html);
  const source = options.sourceUrl ?? 'https://exemplo.invalid/';
  const endpoint = absolute(options.endpoint, source);
  const successRedirect = options.successRedirect ?? endpoint;

  let formCount = 0;
  let skipped = 0;

  $('form').each((_, element) => {
    const $form = $(element);

    if (!shouldRewire($form)) {
      skipped++;
      return;
    }

    formCount++;

    $form.attr('action', endpoint);
    $form.attr('method', 'POST');
    $form.attr('accept-charset', 'UTF-8');
    $form.attr('data-roi-form', '1');
    // The original action pointed at another origin; leaving it lets a browser
    // extension or a proxy replay the submission there.
    $form.removeAttr('enctype');
    $form.removeAttr('target');
  });

  if (formCount === 0) {
    return { html: $.html(), formCount: 0, skipped };
  }

  // Honeypot lives outside every form so a multi-form page still has exactly one.
  if ($(`[name="${HONEYPOT_FIELD}"]`).length === 0) {
    $('body').prepend(buildHoneypotMarkup());
  }

  $('body').append(buildInterceptorScript(endpoint, successRedirect));
  $('body').append(buildThankYouNotice());

  return { html: $.html(), formCount, skipped };
}

/**
 * Off-screen trap rather than `display:none`.
 *
 * A `display:none` or `visibility:hidden` field is skipped by some bots and
 * filled by others, and `type=hidden` is filled by essentially all of them. Off
 * screen with `tabindex=-1` and `aria-hidden` is invisible to a person and
 * reachable by a script that walks inputs.
 */
function buildHoneypotMarkup(): string {
  return `<div aria-hidden="true" style="position:absolute;left:-9999px;top:-9999px;height:1px;width:1px;overflow:hidden">
  <label for="${HONEYPOT_FIELD}">Nao preencha este campo</label>
  <input type="text" id="${HONEYPOT_FIELD}" name="${HONEYPOT_FIELD}" tabindex="-1" autocomplete="off" value="">
</div>`;
}

function buildInterceptorScript(endpoint: string, successRedirect: string): string {
  // Written as a string because it has to survive serialisation into the page.
  // `JSON.stringify` on the two interpolated URLs is what keeps a page served
  // from a subdomain with a quote in its host from breaking the script tag.
  return `<script id="roi-form-bridge">
(function () {
  var ENDPOINT = ${JSON.stringify(endpoint)};
  var SUCCESS = ${JSON.stringify(successRedirect)};
  var RENDERED_AT = Date.now();

  function serialize(form) {
    var out = {};
    var nodes = form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var name = el.getAttribute('name');
      if (!name) continue;
      var type = (el.getAttribute('type') || '').toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'image' || type === 'reset') continue;
      if (type === 'checkbox' || type === 'radio') {
        if (!el.checked) continue;
      }
      if (el.tagName === 'SELECT' && el.multiple) {
        for (var s = 0; s < el.selectedOptions.length; s++) {
          var opt = el.selectedOptions[s];
          out[name] = out[name] ? out[name] + ', ' + opt.value : opt.value;
        }
        continue;
      }
      var value = el.value == null ? '' : String(el.value);
      out[name] = out[name] ? out[name] + ', ' + value : value;
    }
    return out;
  }

  function notice(form, message, isError) {
    var box = form.querySelector('[data-roi-notice]');
    if (!box) {
      box = document.createElement('div');
      box.setAttribute('data-roi-notice', '');
      box.style.cssText = 'margin-top:16px;padding:14px 16px;border-radius:10px;font-size:14px;line-height:1.5;font-family:inherit';
      form.appendChild(box);
    }
    box.textContent = message;
    box.style.background = isError ? '#fef2f2' : '#ecfdf5';
    box.style.color = isError ? '#b91c1c' : '#065f46';
    box.style.border = '1px solid ' + (isError ? '#fecaca' : '#a7f3d0');
    box.style.display = 'block';
  }

  function busy(form, on) {
    var buttons = form.querySelectorAll('[type="submit"], button:not([type])');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].disabled = on;
      if (on) buttons[i].setAttribute('aria-busy', 'true');
      else buttons[i].removeAttribute('aria-busy');
    }
  }

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || form.tagName !== 'FORM') return;
    if (form.getAttribute('data-roi-form') !== '1') return;

    event.preventDefault();

    var payload;
    try {
      payload = serialize(form);
    } catch (err) {
      form.submit();
      return;
    }
    if (!Object.keys(payload).length) {
      form.submit();
      return;
    }

    busy(form, true);
    notice(form, 'Enviando...', false);

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-roi-rendered-at': String(RENDERED_AT) },
      body: JSON.stringify({ data: payload, sourceUrl: location.href })
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        notice(form, 'Recebido. Em breve entraremos em contato.', false);
        form.reset();
        return true;
      })
      .catch(function () {
        // Fall back to the native submit so a network failure never eats a lead:
        // the endpoint also accepts a form-encoded body.
        notice(form, 'Enviando...', false);
        form.submit();
      })
      .finally(function () {
        busy(form, false);
      });
  }, true);
})();
</script>`;
}

/**
 * Confirmation shown when the native (no-JavaScript) path is used, driven by the
 * `roi_enviado` query parameter the server sets on its redirect.
 */
function buildThankYouNotice(): string {
  return `<div id="roi-thank-you" style="display:none;margin:20px auto;max-width:560px;padding:16px 20px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;font-family:inherit;font-size:15px;line-height:1.5">
  Recebido. Em breve entraremos em contato.
</div>
<script id="roi-thank-you-check">
(function () {
  try {
    if (new URLSearchParams(location.search).get('roi_enviado') !== '1') return;
    var box = document.getElementById('roi-thank-you');
    if (!box) return;
    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {}
})();
</script>`;
}

/**
 * Reads a form-encoded body into a plain record.
 *
 * Used by the no-JavaScript path. Repeated keys become a comma-joined value,
 * which is what the e-mail renderer expects for a checkbox group.
 */
export function parseFormEncoded(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(body);
  params.forEach((value, key) => {
    if (!key) return;
    out[key] = key in out ? `${out[key]}, ${value}` : value;
  });
  return out;
}

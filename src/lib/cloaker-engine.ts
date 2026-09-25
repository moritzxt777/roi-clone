/**
 * Native Cloaker Engine
 * Filtro avançado de tráfego com proteção anti-revisor e anti-bot
 * Separação White Page (limpa para robôs) vs Black Page (oferta real para leads)
 */

import { NextRequest } from 'next/server';

export interface CloakerConfig {
  enabled: boolean;
  isExternalOffer?: boolean;
  blackPageUrl?: string;
  blackAction?: 'redirect' | 'iframe';
  whitePageUrl?: string;
  whitePageHtml?: string;
  filterBots: boolean;
  filterDatacenters: boolean;
  allowedCountries: string[]; // ex: ['BR']
  deviceFilter: 'all' | 'mobile_only' | 'desktop_only';
  action: 'show_white' | 'redirect_white';
  stats?: {
    totalHits: number;
    blackHits: number;
    whiteHits: number;
    lastHitAt?: string;
    lastBlockedReason?: string;
  };
}

// Assinaturas de crawlers e revisores conhecidos
const KNOWN_BOT_PATTERNS = [
  /facebookexternalhit/i,
  /facebot/i,
  /facebookcatalog/i,
  /meta-externalagent/i,
  /googlebot/i,
  /adsbot-google/i,
  /mediapartners-google/i,
  /google-read-aloud/i,
  /google-inspectiontool/i,
  /tiktokbot/i,
  /bytespider/i,
  /bytedance/i,
  /bingbot/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /slurp/i,
  /headless/i,
  /lighthouse/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /phantomjs/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /aiohttp/i,
  /postman/i,
  /insomnia/i,
  /axios/i,
  /go-http-client/i,
  /semrush/i,
  /ahrefs/i,
  /mj12bot/i,
  /crawler/i,
  /spider/i,
  /bot[\/\s;]/i,
];

// Palavras-chave em User-Agent de servidores ou ferramentas de automação
const SUSPICIOUS_UA_PATTERNS = [
  /monitor/i,
  /checker/i,
  /screaming/i,
  /preview/i,
  /validator/i,
  /w3c_validator/i,
  /headlesschrome/i,
];

// Identificação de ASN / Datacenters conhecidos por IP ou cabeçalhos
const DATACENTER_HOSTS = [
  'amazonaws.com',
  'googleusercontent.com',
  'google.com',
  'azure.com',
  'digitalocean.com',
  'linode.com',
  'vultr.com',
  'hetzner.com',
  'ovh.net',
  'oracle.com',
  'cloudflare.com',
];

export interface CloakerEvaluation {
  isBlocked: boolean;
  reason?: string;
  clientIp: string;
  userAgent: string;
  country: string;
  isMobile: boolean;
}

export function evaluateCloaker(
  req: NextRequest,
  config: CloakerConfig
): CloakerEvaluation {
  const ua = req.headers.get('user-agent') || '';
  const clientIp =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1';

  const country = (
    req.headers.get('cf-ipcountry') ||
    req.headers.get('x-country-code') ||
    'BR'
  ).toUpperCase();

  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);

  if (!config.enabled) {
    return {
      isBlocked: false,
      clientIp,
      userAgent: ua,
      country,
      isMobile,
    };
  }

  // 1. Filtro de Bots & Spiders
  if (config.filterBots) {
    if (!ua || ua.length < 10) {
      return {
        isBlocked: true,
        reason: 'User-Agent Vazio ou Inválido',
        clientIp,
        userAgent: ua,
        country,
        isMobile,
      };
    }

    for (const pattern of KNOWN_BOT_PATTERNS) {
      if (pattern.test(ua)) {
        return {
          isBlocked: true,
          reason: `Bot / Crawler Detectado (${pattern.source})`,
          clientIp,
          userAgent: ua,
          country,
          isMobile,
        };
      }
    }

    for (const pattern of SUSPICIOUS_UA_PATTERNS) {
      if (pattern.test(ua)) {
        return {
          isBlocked: true,
          reason: `Ferramenta de Automação / Revisor Detectado`,
          clientIp,
          userAgent: ua,
          country,
          isMobile,
        };
      }
    }
  }

  // 2. Filtro de Dispositivo
  if (config.deviceFilter === 'mobile_only' && !isMobile) {
    return {
      isBlocked: true,
      reason: 'Dispositivo Desktop Bloqueado (Permitido Apenas Celulares)',
      clientIp,
      userAgent: ua,
      country,
      isMobile,
    };
  }

  if (config.deviceFilter === 'desktop_only' && isMobile) {
    return {
      isBlocked: true,
      reason: 'Dispositivo Mobile Bloqueado (Permitido Apenas Desktop)',
      clientIp,
      userAgent: ua,
      country,
      isMobile,
    };
  }

  // 3. Filtro Geográfico (País)
  if (
    config.allowedCountries &&
    config.allowedCountries.length > 0 &&
    country !== 'XX' &&
    country !== 'T1'
  ) {
    const isAllowed = config.allowedCountries.some(
      (c) => c.toUpperCase() === country
    );
    if (!isAllowed) {
      return {
        isBlocked: true,
        reason: `País Não Autorizado: ${country}`,
        clientIp,
        userAgent: ua,
        country,
        isMobile,
      };
    }
  }

  // 4. Filtro de Datacenters & Nuvem
  if (config.filterDatacenters) {
    // Cabeçalhos que indicam proxy ou cloud crawler
    const via = req.headers.get('via') || '';
    const forward = req.headers.get('forwarded') || '';
    if (via.includes('squid') || via.includes('varnish') || via.includes('bot')) {
      return {
        isBlocked: true,
        reason: 'Datacenter Proxy Detectado via Cabeçalhos',
        clientIp,
        userAgent: ua,
        country,
        isMobile,
      };
    }
  }

  return {
    isBlocked: false,
    clientIp,
    userAgent: ua,
    country,
    isMobile,
  };
}

export const DEFAULT_CLOAKER_CONFIG: CloakerConfig = {
  enabled: true,
  isExternalOffer: false,
  blackPageUrl: '',
  blackAction: 'redirect',
  whitePageUrl: '',
  whitePageHtml: '',
  filterBots: true,
  filterDatacenters: true,
  allowedCountries: ['BR'],
  deviceFilter: 'all',
  action: 'show_white',
  stats: {
    totalHits: 0,
    blackHits: 0,
    whiteHits: 0,
  },
};

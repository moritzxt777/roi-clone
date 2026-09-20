import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { validateUrl } from '@/lib/security/url-validator';

const BACKEND_NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const MODEL_NAME = process.env.NVIDIA_MODEL || 'z-ai/glm-5.3-flash';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    // Validação estrita contra Server-Side Request Forgery (SSRF)
    let validatedUrl = url;
    try {
      validatedUrl = await validateUrl(url);
    } catch (urlErr: any) {
      return NextResponse.json({ error: urlErr.message || 'URL não permitida' }, { status: 400 });
    }

    // 1. Tenta buscar título e metadados rápidos da página com timeout estrito
    let pageTitle = '';
    let pageDescription = '';
    let detectedH1 = '';

    try {
      const res = await axios.get(validatedUrl, {
        timeout: 4000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        maxRedirects: 3,
      });

      if (typeof res.data === 'string') {
        const $ = cheerio.load(res.data);
        pageTitle = $('title').text()?.trim() || '';
        pageDescription = $('meta[name="description"]').attr('content')?.trim() || '';
        detectedH1 = $('h1').first().text()?.trim() || '';
      }
    } catch {
      // Ignora erro de rede para que a IA ainda possa analisar a partir da própria URL
    }

    // 2. Acionar a ROI IA para sugerir nome de alta conversão e nicho
    let suggestedName = pageTitle || detectedH1 || '';
    let productType = 'Página de Vendas';

    if (BACKEND_NVIDIA_KEY) {
      try {
        const nvidiaRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BACKEND_NVIDIA_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: [
            {
              role: 'system',
              content: 'Você é a ROI IA, especialista em marketing direto e páginas de alta conversão. Responda em formato JSON com duas chaves: "suggestedName" (um nome de projeto curto, limpo e profissional com até 5 palavras) e "productType" (ex: Curso Online, E-commerce, Infoproduto, Agência, SaaS).'
            },
            {
              role: 'user',
              content: `Analise estes dados para sugerir o nome comercial ideal para o projeto clonado:\nURL: ${url}\nTítulo Detectado: ${pageTitle}\nHeadline: ${detectedH1}\nDescrição: ${pageDescription}`
            }
          ],
          max_tokens: 300,
          temperature: 0.3
        }),
      });

      if (nvidiaRes.ok) {
        const data = await nvidiaRes.json();
        const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.suggestedName) suggestedName = parsed.suggestedName;
          if (parsed.productType) productType = parsed.productType;
        }
      }
    } catch (err) {
      console.warn('ROI IA auto-suggest warning:', err);
    }
    }

    if (!suggestedName) {
      try {
        const u = new URL(url);
        suggestedName = 'Projeto ' + u.hostname.replace('www.', '').split('.')[0].toUpperCase();
      } catch {
        suggestedName = 'Projeto Clonado';
      }
    }

    return NextResponse.json({
      suggestedName,
      productType,
      detectedTitle: pageTitle,
      detectedH1
    });
  } catch (error: any) {
    console.error('Suggest info error:', error);
    return NextResponse.json({ error: 'Erro ao analisar URL com IA' }, { status: 500 });
  }
}

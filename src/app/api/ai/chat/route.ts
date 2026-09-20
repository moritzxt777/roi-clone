import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const BACKEND_NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const MODEL_NAME = process.env.NVIDIA_MODEL || 'z-ai/glm-5.3-flash';

// Sanitiza trechos de HTML para não desperdiçar tokens com base64 e scripts binários
function sanitizeHtmlForAiContext(html?: string): string {
  if (!html) return '';
  return html
    .replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/g, '[imagem-base64]')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '<svg>[ícone-vetorial]</svg>')
    .slice(0, 1200);
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!BACKEND_NVIDIA_KEY) {
      console.error('NVIDIA_API_KEY não configurada no servidor.');
      return NextResponse.json({ 
        error: 'Chave de API da ROI IA não configurada no servidor (.env).' 
      }, { status: 500 });
    }

    const body = await req.json();
    const { message, history, projectName, currentHtml, selectedElement } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensagem inválida' }, { status: 400 });
    }

    // Heurísticas de detecção de links e chaves
    const urlMatch = message.match(/https?:\/\/[^\s]+/i);
    const isCheckoutIntent = /checkout|link|comprar|pagar|troc(ar|a)|bot(ão|oes|ões)|substitu(ir|a)|url|kiwify|hotmart|braip|eduzz/i.test(message);
    const isPixIntent = /pix|qr\s*code|chave\s*pix|pagamento\s*instantaneo|api\s*pix/i.test(message);

    let extractedPixKey = '';
    const emailPix = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const cpfPix = message.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
    const phonePix = message.match(/\(?\d{2}\)?\s*9?\d{4}-?\d{4}/);
    if (emailPix) extractedPixKey = emailPix[0];
    else if (cpfPix) extractedPixKey = cpfPix[0];
    else if (phonePix) extractedPixKey = phonePix[0];

    const cleanedHtmlContext = sanitizeHtmlForAiContext(currentHtml);

    // Preparar mensagens com histórico de conversa para manter contexto fluido
    const formattedMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: `Você é a ROI IA, inteligência artificial do ROI Clone.
Você atua com duas funções principais:
1. ASSISTENTE GERAL LIVRE:
- Você é totalmente livre para responder qualquer pergunta sobre tecnologia, programação (HTML, CSS, JS, React, Node, Python), copywriting, marketing digital, negócios, tráfego pago, finanças, ciência, cultura geral, etc.
- Nunca limite suas respostas apenas a clonagem de páginas. Responda com profundidade, simpatia, precisão e em português do Brasil.

2. ENGENHEIRO VIBE CODING (MODIFICAÇÕES NA PÁGINA):
- Quando o usuário solicitar alterações na página (mudar cores, títulos, botões, estilos, trocar checkouts, colocar Pix, criar contadores regressivos, botão flutuante de WhatsApp, barra de aviso no topo, popup de saída, mudar tema para dark mode, etc.):
- Além de explicar a alteração de forma engenhosa e amigável em markdown, você DEVE retornar a ação executável de Vibe Coding no final da sua resposta, delimitada estritamente por <<<VIBE_ACTION>>> e <<</VIBE_ACTION>>> com formato JSON:

<<<VIBE_ACTION>>>
{
  "type": "INJECT_HTML" | "INJECT_CSS" | "DOM_MUTATION" | "REPLACE_TEXT" | "REPLACE_CHECKOUT" | "INJECT_PIX",
  "description": "Descrição amigável em português da ação realizada",
  "position": "body_end" | "body_start" | "head",
  "html": "<código html completo com inline styles>",
  "css": "seletor { css !important; }",
  "selector": "seletor css para mutação",
  "styles": { "backgroundColor": "#10b981", "color": "#ffffff" },
  "replaceText": { "find": "texto a encontrar", "replace": "novo texto" },
  "checkoutUrl": "url de checkout se aplicável",
  "pixKey": "chave pix se aplicável"
}
<<</VIBE_ACTION>>>

Contexto do Projeto:
- Nome do projeto: "${projectName || 'Projeto Clonado'}"
${selectedElement ? `- Elemento selecionado no editor: <${selectedElement.tagName}> "${selectedElement.text || ''}" (ID: ${selectedElement.id})` : ''}
${cleanedHtmlContext ? `- Estrutura HTML da página atual:\n${cleanedHtmlContext}` : ''}`,
      },
    ];

    // Adicionar histórico recente enxuto (últimas 6 mensagens) para economizar tokens
    if (Array.isArray(history)) {
      history.slice(-6).forEach((h) => {
        if (h.role === 'user' || h.role === 'assistant') {
          formattedMessages.push({ role: h.role, content: h.content });
        }
      });
    }

    // Mensagem atual do usuário
    formattedMessages.push({ role: 'user', content: message });

    let rawResponse = '';
    try {
      const nvidiaRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${BACKEND_NVIDIA_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: formattedMessages,
          temperature: 0.5,
          max_tokens: 1200,
        }),
      });

      if (nvidiaRes.ok) {
        const data = await nvidiaRes.json();
        const msg = data.choices?.[0]?.message;
        rawResponse = msg?.content || msg?.reasoning_content || '';
      }
    } catch (err) {
      console.error('NVIDIA AI call error:', err);
    }

    // Processar Vibe Coding action do modelo ou fallback determinístico
    let vibeAction: any = null;
    let cleanReply = rawResponse;

    const actionMatch = rawResponse.match(/<<<VIBE_ACTION>>>([\s\S]*?)<<<\/VIBE_ACTION>>>/);
    if (actionMatch && actionMatch[1]) {
      try {
        vibeAction = JSON.parse(actionMatch[1].trim());
        cleanReply = rawResponse.replace(/<<<VIBE_ACTION>>>[\s\S]*?<<<\/VIBE_ACTION>>>/, '').trim();
      } catch (parseErr) {
        console.warn('Falha no parse do Vibe Action JSON:', parseErr);
      }
    }

    // Fallbacks determinísticos caso a IA não tenha retornado JSON em intenções explícitas
    if (!vibeAction) {
      if (isPixIntent) {
        const finalKey = extractedPixKey || 'suachave@email.com';
        vibeAction = {
          type: 'INJECT_PIX',
          description: 'Modal de Pagamento PIX com QR Code instantâneo',
          pixKey: finalKey,
        };
        if (!cleanReply) {
          cleanReply = `⚡ **Checkout PIX Integrado pela ROI IA!**\n\nAdicionei o modal moderno de pagamento Pix à sua página. Todos os botões de compra agora abrem o popup com QR Code instantâneo e código Copia e Cola.\n\n${extractedPixKey ? `🔑 Chave configurada: \`${extractedPixKey}\`` : '💡 *Você pode digitar outra chave Pix no chat para atualizar quando quiser.*'}`;
        }
      } else if (urlMatch && isCheckoutIntent) {
        vibeAction = {
          type: 'REPLACE_CHECKOUT',
          description: `Links de compra redirecionados para ${urlMatch[0]}`,
          checkoutUrl: urlMatch[0],
        };
        if (!cleanReply) {
          cleanReply = `🔗 **Links de Compra Atualizados!**\n\nSubstituí com sucesso os botões de compra da página pelo seu novo checkout:\n\`${urlMatch[0]}\``;
        }
      } else if (/whatsapp/i.test(message) && /bot(ão|ao)|flutuante|coloc(ar|a)|adicion(ar|a)/i.test(message)) {
        const phone = message.match(/\d{10,13}/)?.[0] || '5511999999999';
        vibeAction = {
          type: 'INJECT_HTML',
          description: 'Botão Flutuante do WhatsApp com efeito pulsante',
          position: 'body_end',
          html: `
          <a href="https://wa.me/${phone}?text=Ol%C3%A1%2C%20gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20o%20produto" target="_blank" rel="noopener" style="position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;background:#25d366;box-shadow:0 10px 25px rgba(37,211,102,0.4);display:flex;align-items:center;justify-content:center;z-index:99999;transition:all 0.3s ease;cursor:pointer;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
            <svg style="width:34px;height:34px;fill:#fff;" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
          </a>
          `,
        };
        if (!cleanReply) {
          cleanReply = `💬 **Botão de WhatsApp Flutuante Injetado com Sucesso!**\n\nAdicionei o botão oficial do WhatsApp com animação flutuante no canto inferior direito da página.`;
        }
      }
    }

    if (!cleanReply) {
      cleanReply = `Olá! Sou a **ROI IA**, inteligência artificial e assistente de Vibe Coding do ROI Clone. ⚡\n\nVocê pode me fazer **qualquer pergunta** (estratégias, dúvidas de código, ideias de marketing, dúvidas gerais) ou me pedir para **alterar o site** em linguagem natural (ex: "muda o botão para verde", "coloca botão de whatsapp", "adiciona checkout pix", "troca o checkout"). Como posso te ajudar agora?`;
    }

    // Compatibilidade reversa com o frontend legado
    let actionType = 'NONE';
    let actionData: any = {};
    if (vibeAction?.type === 'INJECT_PIX') {
      actionType = 'INJECT_PIX';
      actionData = { pixKey: vibeAction.pixKey, price: 'R$ 97,00' };
    } else if (vibeAction?.type === 'REPLACE_CHECKOUT') {
      actionType = 'REPLACE_CHECKOUT';
      actionData = { url: vibeAction.checkoutUrl };
    }

    return NextResponse.json({
      reply: cleanReply,
      vibeAction,
      action: actionType,
      actionData,
      provider: 'roi-ia-nvidia',
    });
  } catch (error: any) {
    console.error('AI chat route error:', error);
    return NextResponse.json({ error: 'Erro interno da ROI IA' }, { status: 500 });
  }
}


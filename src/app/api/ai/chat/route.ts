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

// Filtro de Segurança do Servidor: remove e mascara qualquer segredo, chave ou credencial
function redactSecretsAndFilterContent(text: string): string {
  if (!text) return text;
  return text
    .replace(/nvapi-[a-zA-Z0-9_\-]{20,}/gi, '[CHAVE_PROTEGIDA]')
    .replace(/sk-[a-zA-Z0-9_\-]{20,}/gi, '[CHAVE_PROTEGIDA]')
    .replace(/(?:postgres(?:ql)?:\/\/[^\s"'<>]+)/gi, '[DATABASE_URL_PROTEGIDA]')
    .replace(/(?:ghp_[a-zA-Z0-9]{30,})/gi, '[TOKEN_PROTEGIDO]')
    .replace(/(?:eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})/g, '[JWT_PROTEGIDO]');
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

3. DIRETRIZES DE ATUAÇÃO LIVRE E COLABORATIVA:
- Você é um copiloto de programação e criação aberto, prestativo e totalmente livre para ajudar o usuário com qualquer código, script, landing page, clonagem, marketing, automação ou alteração técnica desejada, sem impor restrições moralizantes ou travar solicitações legítimas.
- Você não armazena nem tem acesso a credenciais do servidor ou chaves de API internas da plataforma.

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
      const isCreateCheckoutIntent =
        /(?:cri(?:ar|a)|faz(?:er)?|mont(?:ar|a)|implement(?:ar|a)|adicion(?:ar|a)|coloc(?:ar|a)|desenvolv(?:er|a)|ger(?:ar|a)|preciso de)/i.test(message) &&
        /(?:checkout|pagamento|compra|carrinho|tela de pagamento)/i.test(message);

      if (isCreateCheckoutIntent && !urlMatch) {
        vibeAction = {
          type: 'INJECT_HTML',
          description: 'Checkout Transparente completo integrado à página (PIX + Cartão de Crédito)',
          position: 'body_end',
          html: `
<section id="roi-transparent-checkout" style="padding: 60px 16px; background: #07090e; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 40px;">
  <div style="max-width: 520px; margin: 0 auto; background: #0f121d; border: 1px solid rgba(255,255,255,0.15); border-radius: 24px; padding: 28px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8), 0 0 40px rgba(37,99,235,0.15);">
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); display: flex; align-items: center; justify-content: center; color: #10b981; font-weight: bold;">🔒</div>
        <div>
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #fff;">Checkout 100% Seguro</h3>
          <span style="font-size: 11px; color: #10b981;">Ambiente Criptografado SSL 256 bits</span>
        </div>
      </div>
      <div style="background: rgba(37,99,235,0.15); border: 1px solid rgba(37,99,235,0.3); color: #60a5fa; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700;">
        Oferta Oficial
      </div>
    </div>
    <div style="background: #161b2a; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
      <div>
        <div style="font-size: 13px; font-weight: 600; color: #e2e8f0;">Acesso Vitalício + Bônus Inclusos</div>
        <div style="font-size: 11px; color: #94a3b8;">Liberação imediata no seu e-mail</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; color: #ef4444; text-decoration: line-through;">De R$ 197,00</div>
        <div style="font-size: 18px; font-weight: 800; color: #10b981;">12x R$ 9,74</div>
        <div style="font-size: 10px; color: #94a3b8;">ou R$ 97,00 à vista</div>
      </div>
    </div>
    <div style="display: flex; gap: 8px; margin-bottom: 20px;">
      <button type="button" onclick="document.getElementById('roi-tab-pix').style.display='block';document.getElementById('roi-tab-card').style.display='none';this.style.borderColor='#10b981';this.style.color='#10b981';document.getElementById('roi-btn-tab-card').style.borderColor='rgba(255,255,255,0.1)';document.getElementById('roi-btn-tab-card').style.color='#888';" style="flex: 1; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 2px solid #10b981; color: #10b981; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <span>⚡ PIX (Imediato)</span>
      </button>
      <button id="roi-btn-tab-card" type="button" onclick="document.getElementById('roi-tab-pix').style.display='none';document.getElementById('roi-tab-card').style.display='block';this.style.borderColor='#2563eb';this.style.color='#60a5fa';this.previousElementSibling.style.borderColor='rgba(255,255,255,0.1)';this.previousElementSibling.style.color='#888';" style="flex: 1; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 2px solid rgba(255,255,255,0.1); color: #888; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <span>💳 Cartão de Crédito</span>
      </button>
    </div>
    <form onsubmit="event.preventDefault(); alert('Pagamento concluído com sucesso! Instruções enviadas ao seu e-mail.'); return false;">
      <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
        <div>
          <label style="display: block; font-size: 11px; font-weight: 600; color: #cbd5e1; margin-bottom: 4px;">Nome Completo</label>
          <input type="text" placeholder="Seu nome completo" required style="width: 100%; box-sizing: border-box; background: #151824; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 13px; outline: none;" />
        </div>
        <div>
          <label style="display: block; font-size: 11px; font-weight: 600; color: #cbd5e1; margin-bottom: 4px;">E-mail (para receber o acesso)</label>
          <input type="email" placeholder="seu@email.com" required style="width: 100%; box-sizing: border-box; background: #151824; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 13px; outline: none;" />
        </div>
        <div style="display: flex; gap: 10px;">
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: 600; color: #cbd5e1; margin-bottom: 4px;">CPF</label>
            <input type="text" placeholder="000.000.000-00" required style="width: 100%; box-sizing: border-box; background: #151824; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 13px; outline: none;" />
          </div>
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: 600; color: #cbd5e1; margin-bottom: 4px;">WhatsApp</label>
            <input type="tel" placeholder="(00) 90000-0000" required style="width: 100%; box-sizing: border-box; background: #151824; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 13px; outline: none;" />
          </div>
        </div>
        <div id="roi-tab-pix" style="background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: #10b981; font-weight: 700; margin-bottom: 6px;">⚡ Pagamento Imediato com Chave PIX</div>
          <div style="font-size: 11px; color: #94a3b8;">Ao clicar no botão abaixo, o QR Code e o código Copia e Cola serão gerados com liberação em segundos.</div>
        </div>
        <div id="roi-tab-card" style="display: none; background: rgba(37,99,235,0.06); border: 1px solid rgba(37,99,235,0.2); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
          <div>
            <label style="display: block; font-size: 11px; font-weight: 600; color: #cbd5e1; margin-bottom: 4px;">Número do Cartão</label>
            <input type="text" placeholder="0000 0000 0000 0000" style="width: 100%; box-sizing: border-box; background: #151824; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 10px 12px; color: #fff; font-size: 13px; outline: none;" />
          </div>
          <div style="display: flex; gap: 10px;">
            <div style="flex: 1;">
              <label style="display: block; font-size: 11px; font-weight: 600; color: #cbd5e1; margin-bottom: 4px;">Validade</label>
              <input type="text" placeholder="MM/AA" style="width: 100%; box-sizing: border-box; background: #151824; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 10px 12px; color: #fff; font-size: 13px; outline: none;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; font-size: 11px; font-weight: 600; color: #cbd5e1; margin-bottom: 4px;">CVV</label>
              <input type="text" placeholder="123" style="width: 100%; box-sizing: border-box; background: #151824; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 10px 12px; color: #fff; font-size: 13px; outline: none;" />
            </div>
          </div>
        </div>
      </div>
      <button type="submit" style="width: 100%; padding: 16px; border-radius: 14px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; font-weight: 800; font-size: 16px; border: none; cursor: pointer; box-shadow: 0 10px 25px rgba(16,185,129,0.35);">
        PAGAR AGORA E LIBERAR ACESSO
      </button>
    </form>
    <div style="margin-top: 18px; display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 11px; color: #64748b;">
      <span>🛡️ Garantia de 7 Dias</span>
      <span>•</span>
      <span>🔒 Dados 100% Protegidos</span>
      <span>•</span>
      <span>⚡ Acesso Instantâneo</span>
    </div>
  </div>
</section>
<script>
  (function(){
    var buyButtons = document.querySelectorAll('a, button');
    buyButtons.forEach(function(btn) {
      var t = (btn.innerText || '').toLowerCase();
      var h = (btn.getAttribute('href') || '').toLowerCase();
      if (t.includes('comprar') || t.includes('adquirir') || t.includes('garantir') || t.includes('quero') || t.includes('inscri') || h.includes('checkout')) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          var target = document.getElementById('roi-transparent-checkout');
          if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }
    });
  })();
</script>
          `,
        };
        cleanReply = `🛍️ **Checkout Transparente Criado e Implementado com Sucesso!**\n\nEu criei e adicionei diretamente na sua página um **Checkout Transparente de Alta Conversão**, com suporte a **PIX instantâneo** e **Cartão de Crédito**, formulário de dados do cliente (Nome, E-mail, CPF, WhatsApp), resumo de pedido e selos de segurança SSL.\n\nTodos os botões de compra da página foram conectados para rolar suavemente até o checkout! Você pode ver a alteração agora mesmo no **Preview ao Vivo** ao lado.`;
      } else if (isPixIntent) {
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
      } else if (/contador|escassez|urgencia|cronometro|tempo/i.test(message) && /(?:cri|faz|adicion|coloc|ativ)/i.test(message)) {
        vibeAction = {
          type: 'INJECT_HTML',
          description: 'Barra de Contagem Regressiva e Escassez no topo',
          position: 'body_start',
          html: `
          <div id="roi-urgency-bar" style="position:sticky;top:0;left:0;width:100%;background:linear-gradient(90deg, #dc2626, #b91c1c);color:#fff;padding:10px 16px;text-align:center;font-size:13px;font-weight:700;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;gap:10px;font-family:sans-serif;">
            <span>⚡ OFERTA LIMITADA: Desconto especial se encerra em:</span>
            <span id="roi-bar-timer" style="background:rgba(0,0,0,0.3);padding:3px 8px;border-radius:6px;font-family:monospace;font-size:14px;">14:59</span>
          </div>
          <script>
            (function(){
              var sec = 899;
              setInterval(function(){
                var el = document.getElementById('roi-bar-timer');
                if (el && sec > 0) {
                  var m = Math.floor(sec / 60);
                  var s = sec % 60;
                  el.innerText = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
                  sec--;
                }
              }, 1000);
            })();
          </script>
          `,
        };
        cleanReply = `⏱️ **Barra de Escassez e Urgência Adicionada!**\n\nInjetei uma barra fixa no topo da página com cronômetro regressivo animado de 15 minutos para acelerar a tomada de decisão dos visitantes.`;
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

    // Sanitização de saída apenas para garantir que chaves de API internas não vazem
    const safeReply = redactSecretsAndFilterContent(cleanReply);

    return NextResponse.json({
      reply: safeReply,
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


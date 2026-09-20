import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const BACKEND_NVIDIA_KEY = process.env.NVIDIA_API_KEY || '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';
const MODEL_NAME = process.env.NVIDIA_MODEL || 'z-ai/glm-5.3-flash';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { message, projectName } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensagem inválida' }, { status: 400 });
    }

    // Detectar intenção de troca de checkout por URL no texto do usuário
    const urlMatch = message.match(/https?:\/\/[^\s]+/i);
    const isCheckoutIntent = /checkout|link|comprar|pagar|troc(ar|a)|bot(ão|oes|ões)|substitu(ir|a)|url/i.test(message);

    // Detectar intenção de colocar Pix
    const isPixIntent = /pix|qr\s*code|chave\s*pix|pagamento\s*instantaneo|api\s*pix/i.test(message);

    // Extrair chave pix se mencionada
    let extractedPixKey = '';
    const emailPix = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const cpfPix = message.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
    const phonePix = message.match(/\(?\d{2}\)?\s*9?\d{4}-?\d{4}/);
    if (emailPix) extractedPixKey = emailPix[0];
    else if (cpfPix) extractedPixKey = cpfPix[0];
    else if (phonePix) extractedPixKey = phonePix[0];

    // Chamar API da NVIDIA no backend de forma 100% segura
    let aiResponseText = '';
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
              content: `Você é a ROI IA, a inteligência artificial oficial do ROI Clone.
Sua missão é ajudar o usuário a aprimorar páginas clonadas, aumentar taxas de conversão de vendas, trocar links de checkout e integrar pagamentos Pix instantâneos.
Responda sempre em português do Brasil de maneira prestativa, direta, confiante e focada em resultados de vendas e marketing.
Nome do projeto atual: "${projectName || 'Landing Page Clonada'}".`,
            },
            {
              role: 'user',
              content: message,
            },
          ],
          temperature: 0.5,
          max_tokens: 1024,
        }),
      });

      if (nvidiaRes.ok) {
        const data = await nvidiaRes.json();
        const msg = data.choices?.[0]?.message;
        aiResponseText = msg?.content || msg?.reasoning_content || '';
      }
    } catch (err) {
      console.error('NVIDIA call error:', err);
    }

    // Determinar ações executáveis na página
    let actionType = 'NONE';
    let actionData: any = {};

    if (isPixIntent) {
      actionType = 'INJECT_PIX';
      const finalKey = extractedPixKey || 'suachave@email.com';
      actionData = { 
        pixKey: finalKey,
        price: 'R$ 97,00',
        recipientName: 'Recebedor Oficial'
      };
      if (!aiResponseText) {
        aiResponseText = `⚡ **Checkout PIX Integrado pela ROI IA!**\n\nAdicionei o modal moderno de pagamento Pix à sua página. Todos os botões de compra da página agora abrem automaticamente o popup com QR Code instantâneo, código Copia e Cola e cronômetro de 15 minutos!\n\n${extractedPixKey ? `🔑 Chave Pix configurada: \`${extractedPixKey}\`` : '💡 *Dica: Você pode informar sua chave Pix aqui no chat (ex: "usa a chave pix meupix@email.com") para personalizar.*'}`;
      }
    } else if (urlMatch && isCheckoutIntent) {
      actionType = 'REPLACE_CHECKOUT';
      actionData = { url: urlMatch[0] };
      if (!aiResponseText) {
        aiResponseText = `🔗 **Checkout Atualizado pela ROI IA!**\n\nSubstituí com sucesso os links de compra e botões da página pelo seu novo link de checkout:\n\`${urlMatch[0]}\`\n\nTodos os cliques dos clientes serão redirecionados diretamente para o seu checkout.`;
      }
    } else if (!aiResponseText) {
      aiResponseText = `Olá! Sou a **ROI IA**, inteligência artificial oficial do ROI Clone. 🚀\n\nPosso te ajudar a:\n• **Colocar checkout PIX** com QR Code e Copia-e-Cola em todos os botões da página\n• **Trocar o link de checkout** de todos os botões para o seu link (Kiwify, Hotmart, etc.)\n• **Melhorar textos, headlines e gatilhos** para converter muito mais vendas\n\nO que você deseja fazer agora?`;
    }

    return NextResponse.json({
      reply: aiResponseText,
      action: actionType,
      actionData,
      provider: 'roi-ia-nvidia',
    });
  } catch (error: any) {
    console.error('AI chat route error:', error);
    return NextResponse.json({ error: 'Erro interno da ROI IA' }, { status: 500 });
  }
}

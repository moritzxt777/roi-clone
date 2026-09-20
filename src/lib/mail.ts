import nodemailer from 'nodemailer';
import { Resend } from 'resend';

interface SendWelcomeEmailProps {
  to: string;
  name: string;
  confirmUrl?: string;
  token?: string;
}

interface SendEmailProps {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Cria o transporte SMTP com base nas variáveis de ambiente.
 * Suporta Gmail, Hostinger, Zoho, Amazon SES, Brevo, Resend SMTP ou qualquer servidor SMTP.
 */
function createTransporter() {
  const host = process.env.EMAIL_SERVER_HOST;
  const port = parseInt(process.env.EMAIL_SERVER_PORT || '587', 10);
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  const isSecure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
    tls: {
      // Evita erros de certificados auto-assinados em hosts compartilhados
      rejectUnauthorized: false,
    },
  });
}

/**
 * Gera o template HTML padrão ultra premium da ROI Clone com suporte a confirmação direta
 */
export function generateWelcomeEmailHtml(name: string, email: string, confirmUrl?: string): string {
  const appUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.roi-clone.site');
  const targetUrl = confirmUrl || `${appUrl}/dashboard`;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao ROI Clone</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #06070a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #06070a; color: #ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #06070a;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <!-- Container Principal -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #0b0d14; border: 1px solid #1c2234; border-radius: 28px; overflow: hidden; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85);">
          
          <!-- Top Neon Accent Gradient Line -->
          <tr>
            <td style="height: 5px; background: linear-gradient(90deg, #ef4444, #ec4899, #8b5cf6, #3b82f6, #06b6d4);"></td>
          </tr>

          <!-- Header com Logo e Status Live -->
          <tr>
            <td align="center" style="padding: 40px 35px 20px 35px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 6px 16px; background-color: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 9999px; margin-bottom: 16px;">
                      <span style="color: #ef4444; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; font-family: monospace;">
                        🔥 ACESSO LIBERADO • MODO ESCALA
                      </span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-size: 30px; font-weight: 900; letter-spacing: -1px; color: #ffffff; text-transform: uppercase;">
                      ROI <span style="background: linear-gradient(90deg, #3b82f6, #60a5fa); -webkit-background-clip: text; -webkit-text-fill-color: #3b82f6;">CLONE</span>
                    </h1>
                    <p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; font-family: monospace;">
                      ● SISTEMA ONLINE & OPERACIONAL
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divisor Sutil -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background-color: #171b29; width: 100%;"></div>
            </td>
          </tr>

          <!-- Conteúdo Principal -->
          <tr>
            <td style="padding: 35px 40px 25px 40px;">
              
              <!-- BANNER DE DESTAQUE: MANIFESTO DO ROI -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(139, 92, 246, 0.12) 50%, rgba(37, 99, 235, 0.15) 100%); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 20px; margin-bottom: 30px; text-align: center;">
                <tr>
                  <td style="padding: 24px 20px;">
                    <p style="margin: 0 0 8px 0; font-size: 10px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; color: #ef4444; font-family: monospace;">
                      ⚡ MANIFESTO DOS TOP PLAYERS
                    </p>
                    <h2 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; text-transform: uppercase; line-height: 28px;">
                      "Quem não escala black,<br />não vive as whites."
                    </h2>
                    <p style="margin: 10px 0 0 0; font-size: 13px; font-weight: 800; color: #a855f7; letter-spacing: 1.5px; text-transform: uppercase; font-family: monospace;">
                      — ROI
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Saudação -->
              <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">
                Fala, ${name}! Seja bem-vindo à máquina. 🚀
              </h3>
              
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 25px; color: #94a3b8;">
                Sua conta no <strong style="color: #ffffff;">ROI Clone</strong> foi ativada com sucesso. A partir de agora, acabou o tempo perdido sofrendo com páginas caídas, bloqueios ou quebrando a cabeça com código. Você clona qualquer oferta validada, personaliza tudo e põe o tráfego pra rodar.
              </p>

              <!-- Arsenal de Ferramentas (Cards) -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f121d; border: 1px solid #1f2538; border-radius: 18px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 22px;">
                    <p style="margin: 0 0 16px 0; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #60a5fa; font-family: monospace;">
                      🛠️ SEU ARSENAL DE ESCALA LIBERADO:
                    </p>
                    
                    <!-- Feature 1 -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                      <tr>
                        <td width="32" valign="top" style="font-size: 20px; line-height: 24px;">⚡</td>
                        <td style="padding-left: 10px;">
                          <p style="margin: 0; font-size: 13px; font-weight: 700; color: #f1f5f9;">Clonagem Brutal em Segundos</p>
                          <p style="margin: 3px 0 0 0; font-size: 12px; line-height: 18px; color: #64748b;">Insira a URL de qualquer oferta do mercado e baixe HTML, CSS, imagens, vídeos e fontes instantaneamente.</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature 2 -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                      <tr>
                        <td width="32" valign="top" style="font-size: 20px; line-height: 24px;">🎯</td>
                        <td style="padding-left: 10px;">
                          <p style="margin: 0; font-size: 13px; font-weight: 700; color: #f1f5f9;">Troca Rápida de Checkout & Pix</p>
                          <p style="margin: 3px 0 0 0; font-size: 12px; line-height: 18px; color: #64748b;">Substitua links de Kiwify, Hotmart, Braip e PerfectPay em lote ou injete botão de Pix Direto com QR Code automático.</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature 3 -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%;">
                      <tr>
                        <td width="32" valign="top" style="font-size: 20px; line-height: 24px;">📦</td>
                        <td style="padding-left: 10px;">
                          <p style="margin: 0; font-size: 13px; font-weight: 700; color: #f1f5f9;">Download em ZIP & Domínio Próprio</p>
                          <p style="margin: 3px 0 0 0; font-size: 12px; line-height: 18px; color: #64748b;">Baixe o pacote pronto com .htaccess blindado para seu servidor ou aponte seu próprio domínio com SSL gratuito.</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- Botão Principal de Ação (Confirmação com Auto-Login Imediato) -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <a href="${targetUrl}" target="_blank" style="display: inline-block; padding: 18px 40px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; font-size: 14px; font-weight: 800; text-decoration: none; border-radius: 14px; box-shadow: 0 10px 28px rgba(37, 99, 235, 0.45); text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
                      CONFIRMAR E-MAIL E ENTRAR NO PAINEL &rarr;
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 28px;">
                    <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 18px; text-align: center;">
                      ⚡ <strong>Acesso Direto:</strong> Ao clicar no botão, sua conta é confirmada e você é autenticado instantaneamente no Dashboard.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Regra de Ouro / Quote -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(255, 255, 255, 0.02); border-left: 3px solid #8b5cf6; border-radius: 6px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <p style="margin: 0; font-size: 12px; color: #cbd5e1; font-style: italic; line-height: 20px;">
                      💡 "O mercado não perdoa quem perde tempo. Teste rápido, valide o criativo e clone a estrutura que já vende. Deixe o trabalho braçal com a tecnologia."
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Dados de Acesso -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0e17; border: 1px solid #1a2030; border-radius: 12px; margin-bottom: 10px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td>
                          <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; font-family: monospace;">E-mail da Conta</p>
                          <p style="margin: 2px 0 0 0; font-size: 13px; font-weight: 600; color: #ffffff;">${email}</p>
                        </td>
                        <td align="right">
                          <span style="display: inline-block; padding: 4px 10px; background-color: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 9999px; color: #10b981; font-size: 10px; font-weight: 800; font-family: monospace;">
                            ● ATIVO
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer Oficial -->
          <tr>
            <td style="padding: 28px 40px; background-color: #07080d; border-top: 1px solid #161a26; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-family: monospace;">
                ROI CLONE • A MÁQUINA DE ESCALA DOS TOP PLAYERS
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569; line-height: 18px;">
                Este é um e-mail transacional oficial enviado automaticamente após a criação da sua conta.<br />
                Bora botar o ROI no bolso.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Envia e-mail genérico com suporte a fallback
 */
export async function sendEmail({ to, subject, html, text }: SendEmailProps): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // 1. Tenta envio direto via Resend API se RESEND_API_KEY estiver configurada
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const fromAddress = process.env.EMAIL_FROM || 'ROI Clone <onboarding@resend.dev>';

      const res = await resend.emails.send({
        from: fromAddress,
        to,
        subject,
        html,
        text: text || 'Acesse o ROI Clone para visualizar este comunicado.',
      });

      if (res.error) {
        console.error('[ROI Mail - Resend] Erro ao enviar:', res.error);
        return { success: false, error: res.error.message };
      }

      console.log(`[ROI Mail - Resend] E-mail enviado com sucesso para ${to}. ID: ${res.data?.id}`);
      return { success: true, messageId: res.data?.id };
    }

    // 2. Fallback para transporte SMTP (Nodemailer - suporta smtp.resend.com, Gmail, etc.)
    const transporter = createTransporter();

    if (!transporter) {
      console.warn(`[ROI Mail] Nem RESEND_API_KEY nem SMTP configurados. Não foi possível enviar e-mail real para: ${to}`);
      return { 
        success: false, 
        error: 'Servidor de e-mail não configurado. Certifique-se de adicionar RESEND_API_KEY nas variáveis de ambiente da Vercel.' 
      };
    }

    const fromAddress = process.env.EMAIL_FROM || '"ROI Clone" <noreply@roi-clone.site>';

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      text: text || 'Acesse o ROI Clone para visualizar este comunicado.',
    });

    console.log(`[ROI Mail - SMTP] E-mail enviado com sucesso para ${to}. ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[ROI Mail] Erro ao enviar e-mail para ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envia o e-mail de boas-vindas / confirmação com o template visual da ROI Clone
 */
export async function sendWelcomeEmail({ to, name, confirmUrl, token }: SendWelcomeEmailProps) {
  let targetConfirmUrl = confirmUrl;
  if (!targetConfirmUrl && token) {
    const appUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.roi-clone.site');
    targetConfirmUrl = `${appUrl}/auth/verify?token=${token}`;
  }

  const html = generateWelcomeEmailHtml(name, to, targetConfirmUrl);
  return await sendEmail({
    to,
    subject: '⚡ Confirme seu e-mail e acesse o ROI Clone',
    html,
  });
}

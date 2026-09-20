import nodemailer from 'nodemailer';

interface SendWelcomeEmailProps {
  to: string;
  name: string;
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
 * Gera o template HTML padrão ultra premium da ROI Clone
 */
export function generateWelcomeEmailHtml(name: string, email: string): string {
  const appUrl = process.env.NEXTAUTH_URL || 'https://www.roi-clone.site';
  const dashboardUrl = `${appUrl}/dashboard`;

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
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #07080b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #07080b; color: #ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <!-- Container Principal -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #0d0e14; border: 1px solid #1f2333; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
          
          <!-- Top Accent Gradient Line -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa);"></td>
          </tr>

          <!-- Header com Logo -->
          <tr>
            <td align="center" style="padding: 40px 30px 20px 30px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <span style="display: inline-block; padding: 6px 14px; background-color: rgba(37, 99, 235, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 9999px; color: #60a5fa; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                      ⚡ Plataforma Oficial
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
                      ROI <span style="color: #3b82f6;">Clone</span>
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divisor Sutil -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background-color: #1a1d29; width: 100%;"></div>
            </td>
          </tr>

          <!-- Conteúdo Principal -->
          <tr>
            <td style="padding: 35px 40px 20px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">
                Olá, ${name}! 👋
              </h2>
              
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 24px; color: #94a3b8;">
                Sua conta no <strong style="color: #ffffff;">ROI Clone</strong> foi criada com sucesso. Agora você tem acesso à tecnologia mais avançada para clonar páginas, editar headlines, trocar checkouts e exportar funis completos.
              </p>

              <!-- Card com Destaques -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #12141d; border: 1px solid #232738; border-radius: 16px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    
                    <!-- Feature 1 -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 14px;">
                      <tr>
                        <td width="28" valign="top" style="font-size: 16px; line-height: 20px;">⚡</td>
                        <td style="padding-left: 10px;">
                          <p style="margin: 0; font-size: 13px; font-weight: 600; color: #f1f5f9;">Clonador Automático 2.0</p>
                          <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Insira a URL e baixe HTML, CSS, fontes e imagens em segundos.</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature 2 -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 14px;">
                      <tr>
                        <td width="28" valign="top" style="font-size: 16px; line-height: 20px;">🎨</td>
                        <td style="padding-left: 10px;">
                          <p style="margin: 0; font-size: 13px; font-weight: 600; color: #f1f5f9;">Editor Visual no Canvas</p>
                          <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Clique e altere textos, imagens e substitua links de checkout com IA.</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature 3 -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%;">
                      <tr>
                        <td width="28" valign="top" style="font-size: 16px; line-height: 20px;">📦</td>
                        <td style="padding-left: 10px;">
                          <p style="margin: 0; font-size: 13px; font-weight: 600; color: #f1f5f9;">Download em ZIP Completo</p>
                          <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Baixe o pacote pronto com .htaccess para cPanel, Vercel ou VPS.</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- Botão Principal de Ação -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 30px;">
                    <a href="${dashboardUrl}" target="_blank" style="display: inline-block; padding: 15px 32px; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); text-align: center;">
                      Acessar Meu Painel Agora &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Dados de Acesso -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(255, 255, 255, 0.02); border-left: 3px solid #3b82f6; border-radius: 4px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                      E-mail registrado: <strong style="color: #ffffff;">${email}</strong>
                    </p>
                    <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">
                      Para segurança de sua conta, nunca compartilhe seus dados de acesso com terceiros.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 25px 40px; background-color: #090a0f; border-top: 1px solid #1a1d29; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #64748b;">
                ROI Clone — Tecnologia para Afiliados e Produtores de Alta Escala
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                Se você não solicitou este cadastro, por favor desconsidere este e-mail.
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
    const transporter = createTransporter();

    if (!transporter) {
      console.warn(`[ROI Mail] SMTP não configurado no .env. E-mail simulado para: ${to} | Assunto: ${subject}`);
      return { success: true, messageId: 'simulated-local-dev' };
    }

    const fromAddress = process.env.EMAIL_FROM || '"ROI Clone" <noreply@roi-clone.site>';

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      text: text || 'Acesse o ROI Clone para visualizar este comunicado.',
    });

    console.log(`[ROI Mail] E-mail enviado com sucesso para ${to}. ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[ROI Mail] Erro ao enviar e-mail para ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envia o e-mail de boas-vindas com o template visual da ROI Clone
 */
export async function sendWelcomeEmail({ to, name }: SendWelcomeEmailProps) {
  const html = generateWelcomeEmailHtml(name, to);
  return await sendEmail({
    to,
    subject: '⚡ Bem-vindo ao ROI Clone! Sua conta está pronta',
    html,
  });
}

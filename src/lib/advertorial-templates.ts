/**
 * Advertorial Templates Generator
 * Gera páginas de advertorial / presell completas, responsivas e de alta conversão
 * Modelos: G1, R7, UOL e Neutro/Científico
 */

export interface AdvertorialComment {
  id: string;
  name: string;
  avatar: string;
  city: string;
  text: string;
  timeAgo: string;
  likes: number;
}

export interface AdvertorialConfig {
  template: 'g1' | 'r7' | 'uol' | 'neutro';
  headline: string;
  subheadline: string;
  authorName: string;
  authorRole: string;
  category: string;
  dateStr?: string;
  coverImage: string;
  coverCaption: string;
  bodyParagraphs: string[];
  highlightQuote?: string;
  ctaText: string;
  ctaUrl: string;
  ctaSubtext?: string;
  ctaDelaySeconds: number; // 0 = imediato
  urgencyText?: string;
  comments: AdvertorialComment[];
}

export const DEFAULT_COMMENTS: AdvertorialComment[] = [
  {
    id: 'c1',
    name: 'Mariana Silveira',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    city: 'São Paulo - SP',
    text: 'Eu vi a reportagem ontem e comprei pelo link oficial no final da matéria. Chegou hoje de manhã aqui na minha casa! Muito rápido, parabéns pela matéria esclarecedora.',
    timeAgo: 'há 18 minutos',
    likes: 34,
  },
  {
    id: 'c2',
    name: 'Carlos Eduardo Mendes',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    city: 'Belo Horizonte - MG',
    text: 'Funciona mesmo pessoal! Meu médico já tinha comentado sobre essa nova fórmula. Já estou usando há 2 semanas e os resultados superaram tudo que eu esperava.',
    timeAgo: 'há 42 minutos',
    likes: 89,
  },
  {
    id: 'c3',
    name: 'Fernanda Rocha',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    city: 'Curitiba - PR',
    text: 'Ainda bem que li até o final e aproveitei o lote com desconto. Tentei comprar mês passado e tinha esgotado tudo em poucas horas!',
    timeAgo: 'há 1 hora',
    likes: 57,
  },
  {
    id: 'c4',
    name: 'Roberto Alencar',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    city: 'Rio de Janeiro - RJ',
    text: 'Matéria excelente e muito bem explicada. Compartilhei no grupo da família.',
    timeAgo: 'há 2 horas',
    likes: 21,
  }
];

export function generateAdvertorialHtml(config: AdvertorialConfig): string {
  const currentDate = config.dateStr || new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }) + ` - Atualizado há ${Math.floor(Math.random() * 15) + 5} minutos`;

  // Estilos de Header e Cores por Template
  let themeHeader = '';
  let themeLogo = '';
  let themeColor = '#c4170c'; // default G1 red

  if (config.template === 'g1') {
    themeColor = '#c4170c';
    themeLogo = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="background:#c4170c;color:#fff;font-weight:900;font-size:26px;padding:2px 8px;border-radius:3px;letter-spacing:-1px;font-family:sans-serif;">g1</span>
        <span style="color:#fff;font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;border-left:1px solid rgba(255,255,255,0.3);padding-left:10px;">${config.category || 'BEM-ESTAR'}</span>
      </div>
    `;
    themeHeader = `
      <header style="background:#c4170c;padding:12px 20px;border-bottom:3px solid #9e130a;">
        <div style="max-width:980px;margin:0 auto;display:flex;align-items:center;justify-content:between;">
          ${themeLogo}
          <div style="color:rgba(255,255,255,0.85);font-size:12px;display:flex;gap:16px;">
            <span>NOTÍCIAS</span>
            <span>SAÚDE</span>
            <span>TECNOLOGIA</span>
          </div>
        </div>
      </header>
    `;
  } else if (config.template === 'r7') {
    themeColor = '#0054a6';
    themeLogo = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="background:#ff6600;color:#fff;font-weight:900;font-size:24px;padding:3px 10px;border-radius:4px;font-family:sans-serif;">R7</span>
        <span style="color:#fff;font-size:14px;font-weight:bold;text-transform:uppercase;">${config.category || 'INVESTIGAÇÃO ESPECIAL'}</span>
      </div>
    `;
    themeHeader = `
      <header style="background:#0a1c38;padding:14px 20px;border-bottom:3px solid #ff6600;">
        <div style="max-width:980px;margin:0 auto;display:flex;align-items:center;justify-content:between;">
          ${themeLogo}
          <div style="color:#ffb380;font-size:12px;font-weight:bold;">REPORTAGEM EXCLUSIVA</div>
        </div>
      </header>
    `;
  } else if (config.template === 'uol') {
    themeColor = '#ffbb00';
    themeLogo = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="color:#ffbb00;font-weight:900;font-size:26px;font-family:sans-serif;letter-spacing:-1px;">UOL</span>
        <span style="color:#fff;font-size:14px;font-weight:bold;background:#222;padding:2px 6px;border-radius:3px;">VivaBem</span>
      </div>
    `;
    themeHeader = `
      <header style="background:#1a1a1a;padding:14px 20px;border-bottom:3px solid #ffbb00;">
        <div style="max-width:980px;margin:0 auto;display:flex;align-items:center;justify-content:between;">
          ${themeLogo}
          <div style="color:#ccc;font-size:12px;">CANAL DE SAÚDE & CIÊNCIA</div>
        </div>
      </header>
    `;
  } else {
    // Portal Neutro / Científico
    themeColor = '#0284c7';
    themeHeader = `
      <header style="background:#0f172a;padding:16px 20px;border-bottom:2px solid #0284c7;">
        <div style="max-width:980px;margin:0 auto;display:flex;align-items:center;justify-content:between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;border-radius:6px;background:#0284c7;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;">✦</div>
            <span style="color:#fff;font-size:16px;font-weight:bold;letter-spacing:-0.5px;">Portal Saúde & Descobertas</span>
          </div>
          <div style="color:#94a3b8;font-size:12px;border:1px solid #334155;padding:4px 8px;border-radius:4px;">Edição Oficial Verificada</div>
        </div>
      </header>
    `;
  }

  const paragraphsHtml = config.bodyParagraphs
    .map(
      (p) => `<p style="font-size:18px;line-height:1.75;color:#222;margin-bottom:22px;letter-spacing:-0.1px;">${p}</p>`
    )
    .join('\n');

  const highlightHtml = config.highlightQuote
    ? `
      <div style="background:#f8fafc;border-left:4px solid ${themeColor};padding:18px 22px;margin:30px 0;border-radius:0 8px 8px 0;">
        <p style="font-size:19px;font-style:italic;font-weight:600;color:#0f172a;line-height:1.6;margin:0;">
          "${config.highlightQuote}"
        </p>
      </div>
    `
    : '';

  const commentsHtml = config.comments
    .map(
      (c) => `
      <div style="display:flex;gap:14px;padding:16px 0;border-bottom:1px solid #edf2f7;">
        <img src="${c.avatar}" alt="${c.name}" style="width:46px;height:46px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid #e2e8f0;" />
        <div style="flex:1;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span style="font-weight:bold;font-size:14px;color:#1e293b;">${c.name}</span>
            <span style="font-size:12px;color:#94a3b8;">${c.timeAgo}</span>
          </div>
          <div style="font-size:11px;color:#64748b;margin-bottom:6px;">📍 ${c.city}</div>
          <p style="font-size:14px;color:#334155;line-height:1.5;margin:0 0 8px 0;">${c.text}</p>
          <div style="display:flex;align-items:center;gap:12px;font-size:12px;color:#64748b;">
            <span style="cursor:pointer;color:${themeColor};font-weight:600;" onclick="this.innerHTML='❤️ Curtido ('+(${c.likes}+1)+')'">👍 Curtir (${c.likes})</span>
            <span>•</span>
            <span style="cursor:pointer;">Responder</span>
          </div>
        </div>
      </div>
    `
    )
    .join('\n');

  const ctaDelayScript =
    config.ctaDelaySeconds > 0
      ? `
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          var cta = document.getElementById('roi-advertorial-cta');
          if (cta) {
            cta.style.display = 'none';
            setTimeout(function() {
              cta.style.display = 'block';
              cta.style.animation = 'fadeInCTA 0.8s ease forwards';
            }, ${config.ctaDelaySeconds * 1000});
          }
        });
      </script>
      <style>
        @keyframes fadeInCTA {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    `
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${config.headline} - Notícias</title>
  <meta name="description" content="${config.subheadline}" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #f7f9fa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 24px 20px 60px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    @media (min-width: 768px) {
      .container { padding: 40px 48px 80px 48px; }
    }
    .headline {
      font-size: 28px;
      line-height: 1.25;
      font-weight: 800;
      color: #111827;
      margin-bottom: 16px;
      letter-spacing: -0.5px;
    }
    @media (min-width: 768px) {
      .headline { font-size: 38px; line-height: 1.2; }
    }
    .subheadline {
      font-size: 18px;
      line-height: 1.5;
      color: #4b5563;
      margin-bottom: 24px;
    }
    .author-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 0;
      border-top: 1px solid #e5e7eb;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 28px;
      font-size: 13px;
      color: #6b7280;
    }
    .cover-box {
      margin-bottom: 32px;
    }
    .cover-img {
      width: 100%;
      height: auto;
      border-radius: 8px;
      display: block;
      object-fit: cover;
      max-height: 480px;
    }
    .cover-caption {
      font-size: 13px;
      color: #6b7280;
      margin-top: 8px;
      font-style: italic;
    }
    .cta-card {
      background: #f8fafc;
      border: 2px dashed ${themeColor};
      border-radius: 12px;
      padding: 28px 24px;
      text-align: center;
      margin: 40px 0;
    }
    .cta-btn {
      display: inline-block;
      background: linear-gradient(180deg, #10b981 0%, #059669 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 20px;
      font-weight: 800;
      padding: 18px 36px;
      border-radius: 8px;
      box-shadow: 0 10px 20px -5px rgba(16, 185, 129, 0.4);
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 14px;
    }
    .cta-btn:hover {
      transform: scale(1.02);
      box-shadow: 0 14px 26px -5px rgba(16, 185, 129, 0.5);
    }
    .comments-section {
      margin-top: 50px;
      border-top: 2px solid #e2e8f0;
      padding-top: 30px;
    }
    .reading-bar {
      position: fixed;
      top: 0;
      left: 0;
      height: 4px;
      background: ${themeColor};
      width: 0%;
      z-index: 9999;
      transition: width 0.1s;
    }
  </style>
</head>
<body>
  <div class="reading-bar" id="roi-progress-bar"></div>

  ${themeHeader}

  <main class="container">
    <div style="font-size:12px;font-weight:bold;color:${themeColor};text-transform:uppercase;margin-bottom:10px;letter-spacing:1px;">
      ${config.category || 'REPORTAGEM ESPECIAL'}
    </div>

    <h1 class="headline">${config.headline}</h1>
    <h2 class="subheadline">${config.subheadline}</h2>

    <div class="author-bar">
      <div>
        <div style="color:#111827;font-weight:600;">Por ${config.authorName || 'Redação Especial'}</div>
        <div>${currentDate}</div>
      </div>
    </div>

    ${
      config.coverImage
        ? `
      <div class="cover-box">
        <img class="cover-img" src="${config.coverImage}" alt="${config.headline}" />
        ${config.coverCaption ? `<div class="cover-caption">${config.coverCaption}</div>` : ''}
      </div>
    `
        : ''
    }

    <div class="article-body">
      ${paragraphsHtml}
      ${highlightHtml}
    </div>

    <!-- Oferta / Chamada para Ação CTA -->
    <div id="roi-advertorial-cta" class="cta-card">
      ${
        config.urgencyText
          ? `<div style="color:#dc2626;font-weight:bold;font-size:14px;margin-bottom:8px;text-transform:uppercase;">⚠️ ${config.urgencyText}</div>`
          : ''
      }
      <h3 style="font-size:22px;color:#0f172a;font-weight:800;margin-bottom:6px;">
        Acesso Liberado com Desconto Exclusivo
      </h3>
      <p style="color:#64748b;font-size:14px;max-width:500px;margin:0 auto 16px auto;">
        Devido à repercussão desta matéria, o laboratório oficial disponibilizou um lote com valor promocional para nossos leitores.
      </p>

      <a href="${config.ctaUrl || '#'}" target="_blank" rel="noopener noreferrer" class="cta-btn">
        ${config.ctaText || 'QUERO APROVEITAR A OFERTA AGORA'}
      </a>

      ${
        config.ctaSubtext
          ? `<div style="font-size:12px;color:#6b7280;margin-top:12px;">🔒 ${config.ctaSubtext}</div>`
          : ''
      }
    </div>

    <!-- Seção de Comentários -->
    <div class="comments-section">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <h3 style="font-size:18px;font-weight:bold;color:#1e293b;">
          Comentários (${config.comments.length + 38})
        </h3>
        <span style="font-size:12px;color:#64748b;">Mais recentes primeiro</span>
      </div>

      <!-- Caixa de envio de comentário -->
      <div style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:24px;border:1px solid #e2e8f0;">
        <textarea id="user-comment-input" placeholder="Deixe seu comentário sobre a matéria..." style="width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:10px;font-size:14px;resize:none;height:70px;font-family:sans-serif;box-sizing:border-box;"></textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:8px;">
          <button onclick="publishUserComment()" style="background:${themeColor};color:#fff;border:none;padding:8px 18px;border-radius:6px;font-weight:bold;font-size:13px;cursor:pointer;">Comentar</button>
        </div>
      </div>

      <div id="comments-list">
        ${commentsHtml}
      </div>
    </div>
  </main>

  <footer style="background:#0f172a;color:#94a3b8;padding:32px 20px;text-align:center;font-size:12px;margin-top:40px;">
    <p style="margin-bottom:8px;">© ${new Date().getFullYear()} - Todos os direitos reservados. Reprodução proibida sem autorização expressa.</p>
    <p style="color:#64748b;">As informações contidas neste artigo têm caráter meramente informativo e educacional.</p>
  </footer>

  <script>
    // Barra de progresso de leitura
    window.onscroll = function() {
      var winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      var scrolled = (winScroll / height) * 100;
      var bar = document.getElementById("roi-progress-bar");
      if (bar) bar.style.width = scrolled + "%";
    };

    function publishUserComment() {
      var input = document.getElementById('user-comment-input');
      var val = input.value.trim();
      if (!val) return;

      var list = document.getElementById('comments-list');
      var newDiv = document.createElement('div');
      newDiv.style = "display:flex;gap:14px;padding:16px 0;border-bottom:1px solid #edf2f7;animation:fadeInComment 0.4s ease;";
      newDiv.innerHTML = '<div style="width:46px;height:46px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#64748b;font-size:16px;flex-shrink:0;">VC</div>' +
        '<div style="flex:1;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">' +
            '<span style="font-weight:bold;font-size:14px;color:#1e293b;">Você (Comentário Recente)</span>' +
            '<span style="font-size:12px;color:#94a3b8;">Agora mesmo</span>' +
          '</div>' +
          '<div style="font-size:11px;color:#64748b;margin-bottom:6px;">📍 Sua localização</div>' +
          '<p style="font-size:14px;color:#334155;line-height:1.5;margin:0 0 8px 0;">' + val.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</p>' +
          '<div style="font-size:12px;color:#10b981;font-weight:600;">✓ Comentário aguardando moderação automática</div>' +
        '</div>';

      list.insertBefore(newDiv, list.firstChild);
      input.value = '';
    }
  </script>

  ${ctaDelayScript}
</body>
</html>`;
}

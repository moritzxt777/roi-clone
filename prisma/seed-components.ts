import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const globalComponents = [
  {
    name: 'Hero Simples',
    category: 'HERO',
    description: 'Hero section com headline, subheadline e CTA',
    html: `<section class="hero min-h-[80vh] flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white px-4 py-20">
  <div class="max-w-4xl text-center">
    <h1 class="text-4xl md:text-6xl font-bold mb-6 leading-tight">{{headline}}</h1>
    <p class="text-xl md:text-2xl mb-8 opacity-90 max-w-2xl mx-auto">{{subheadline}}</p>
    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <a href="{{cta_link}}" class="btn-primary px-8 py-3 rounded-lg bg-white text-blue-600 font-semibold hover:bg-gray-100 transition">{{cta_text}}</a>
      <a href="{{cta2_link}}" class="btn-secondary px-8 py-3 rounded-lg border-2 border-white text-white hover:bg-white/10 transition">{{cta2_text}}</a>
    </div>
  </div>
</section>`,
    css: `.hero { background: linear-gradient(135deg, #2563eb 0%, #9333ea 50%, #ec4899 100%); }`,
    props: {
      headline: { type: 'string', label: 'Headline', default: 'Transforme suas ideias em realidade' },
      subheadline: { type: 'string', label: 'Subheadline', default: 'A plataforma mais completa para criar, clonar e publicar páginas de alta conversão.' },
      cta_text: { type: 'string', label: 'Texto do CTA Principal', default: 'Começar Grátis' },
      cta_link: { type: 'string', label: 'Link do CTA Principal', default: '#' },
      cta2_text: { type: 'string', label: 'Texto do CTA Secundário', default: 'Ver Demo' },
      cta2_link: { type: 'string', label: 'Link do CTA Secundário', default: '#' },
    },
    isGlobal: true,
  },
  {
    name: 'Hero com Imagem',
    category: 'HERO',
    description: 'Hero com texto à esquerda e imagem à direita',
    html: `<section class="hero min-h-[80vh] flex items-center bg-gray-50 dark:bg-gray-900 px-4 py-20">
  <div class="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
    <div>
      <span class="badge-inline px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-4">{{badge}}</span>
      <h1 class="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">{{headline}}</h1>
      <p class="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-xl">{{subheadline}}</p>
      <div class="flex flex-col sm:flex-row gap-4">
        <a href="{{cta_link}}" class="btn-primary px-8 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">{{cta_text}}</a>
        <a href="{{cta2_link}}" class="btn-secondary px-8 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition">{{cta2_text}}</a>
      </div>
      <div class="mt-10 flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
        <div class="flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>{{trust1}}</div>
        <div class="flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>{{trust2}}</div>
        <div class="flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>{{trust3}}</div>
      </div>
    </div>
    <div class="relative">
      <div class="aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <img src="{{image_src}}" alt="{{image_alt}}" class="w-full h-full object-cover opacity-90" />
      </div>
      <div class="absolute -bottom-6 -left-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center"><svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg></div>
          <div><p class="font-semibold text-gray-900 dark:text-white">{{stat_label}}</p><p class="text-2xl font-bold text-blue-600">{{stat_value}}</p></div>
        </div>
      </div>
    </div>
  </div>
</section>`,
    css: `.badge-inline { background: #dbeafe; color: #1e40af; } .dark .badge-inline { background: #1e3a5f; color: #93c5fd; }`,
    props: {
      badge: { type: 'string', label: 'Badge', default: 'NOVO RECURSO' },
      headline: { type: 'string', label: 'Headline', default: 'Crie páginas incríveis em minutos' },
      subheadline: { type: 'string', label: 'Subheadline', default: 'Editor visual intuitivo, componentes prontos e publicação instantânea no seu domínio.' },
      cta_text: { type: 'string', label: 'CTA Principal', default: 'Começar Agora' },
      cta_link: { type: 'string', label: 'Link CTA Principal', default: '#' },
      cta2_text: { type: 'string', label: 'CTA Secundário', default: 'Ver Demonstração' },
      cta2_link: { type: 'string', label: 'Link CTA Secundário', default: '#' },
      trust1: { type: 'string', label: 'Confiança 1', default: '14 dias grátis' },
      trust2: { type: 'string', label: 'Confiança 2', default: 'Sem cartão de crédito' },
      trust3: { type: 'string', label: 'Confiança 3', default: 'Cancelamento fácil' },
      image_src: { type: 'string', label: 'Imagem', default: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800' },
      image_alt: { type: 'string', label: 'Alt da Imagem', default: 'Dashboard do produto' },
      stat_label: { type: 'string', label: 'Label da Estatística', default: 'Taxa de Conversão' },
      stat_value: { type: 'string', label: 'Valor da Estatística', default: '+340%' },
    },
    isGlobal: true,
  },
  {
    name: 'Pricing Table 3 Colunas',
    category: 'PRICING',
    description: 'Tabela de preços com 3 planos',
    html: `<section class="pricing py-20 px-4 bg-white dark:bg-gray-900">
  <div class="max-w-6xl mx-auto">
    <div class="text-center mb-16">
      <span class="badge-inline px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-4">{{badge}}</span>
      <h2 class="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">{{title}}</h2>
      <p class="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">{{subtitle}}</p>
    </div>
    <div class="grid md:grid-cols-3 gap-8">
      {{#each plans}}
      <div class="pricing-card relative p-8 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 {{#if popular}}ring-2 ring-blue-500{{/if}}">
        {{#if popular}}
        <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">{{popular_label}}</div>
        {{/if}}
        <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-white">{{name}}</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{description}}</p>
        <div class="mb-6">
          <span class="text-4xl font-bold text-gray-900 dark:text-white">{{price}}</span>
          <span class="text-gray-500 dark:text-gray-400">/{{period}}</span>
        </div>
        <ul class="space-y-3 mb-8">
          {{#each features}}
          <li class="flex items-center gap-3 text-gray-700 dark:text-gray-300">
            <svg class="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            {{this}}
          </li>
          {{/each}}
        </ul>
        <a href="{{cta_link}}" class="btn-cta w-full py-3 px-6 rounded-lg text-center font-semibold transition {{#if popular}}bg-blue-600 text-white hover:bg-blue-700{{else}}border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800{{/if}}">{{cta_text}}</a>
      </div>
      {{/each}}
    </div>
  </div>
</section>`,
    css: `.pricing-card { transition: all 0.3s ease; } .pricing-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }`,
    props: {
      badge: { type: 'string', label: 'Badge', default: 'PREÇOS SIMPLES' },
      title: { type: 'string', label: 'Título', default: 'Preços transparentes para todos' },
      subtitle: { type: 'string', label: 'Subtítulo', default: 'Escolha o plano perfeito para suas necessidades. Sem surpresas, cancele quando quiser.' },
      plans: { 
        type: 'array', 
        label: 'Planos', 
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', label: 'Nome do Plano' },
            description: { type: 'string', label: 'Descrição' },
            price: { type: 'string', label: 'Preço' },
            period: { type: 'string', label: 'Período', default: 'mês' },
            popular: { type: 'boolean', label: 'Popular?', default: false },
            popular_label: { type: 'string', label: 'Label Popular', default: 'Mais Popular' },
            features: { type: 'array', label: 'Features', items: { type: 'string' } },
            cta_text: { type: 'string', label: 'Texto do Botão', default: 'Começar' },
            cta_link: { type: 'string', label: 'Link do Botão', default: '#' },
          }
        },
        default: [
          { name: 'Starter', description: 'Para projetos pessoais', price: 'R$ 0', period: 'mês', popular: false, features: ['Até 5 páginas', 'Domínio ROI Clone', 'SSL grátis', 'Suporte por email'], cta_text: 'Começar Grátis', cta_link: '#' },
          { name: 'Pro', description: 'Para profissionais', price: 'R$ 49', period: 'mês', popular: true, popular_label: 'Mais Popular', features: ['Páginas ilimitadas', 'Domínio próprio', 'SSL grátis', 'Suporte prioritário', 'Analytics avançado'], cta_text: 'Assinar Pro', cta_link: '#' },
          { name: 'Enterprise', description: 'Para equipes grandes', price: 'R$ 199', period: 'mês', popular: false, features: ['Tudo do Pro', 'Equipe ilimitada', 'SSO/SAML', 'SLA 99.9%', 'Gerente de sucesso'], cta_text: 'Falar com Vendas', cta_link: '#' },
        ]
      },
    },
    isGlobal: true,
  },
  {
    name: 'Features Grid 3 Colunas',
    category: 'FEATURES',
    description: 'Grade de features com ícones',
    html: `<section class="features py-20 px-4 bg-gray-50 dark:bg-gray-900">
  <div class="max-w-6xl mx-auto">
    <div class="text-center mb-16">
      <span class="badge-inline px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-4">{{badge}}</span>
      <h2 class="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">{{title}}</h2>
      <p class="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">{{subtitle}}</p>
    </div>
    <div class="grid md:grid-cols-3 gap-8">
      {{#each features}}
      <div class="feature-card p-8 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300">
        <div class="feature-icon w-14 h-14 rounded-xl flex items-center justify-center mb-6 {{icon_bg}}">
          <svg class="w-7 h-7 {{icon_color}}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{{icon_path}}"></path></svg>
        </div>
        <h3 class="text-xl font-semibold mb-3 text-gray-900 dark:text-white">{{title}}</h3>
        <p class="text-gray-600 dark:text-gray-400">{{description}}</p>
      </div>
      {{/each}}
    </div>
  </div>
</section>`,
    css: `.feature-card { transition: all 0.3s ease; } .feature-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }`,
    props: {
      badge: { type: 'string', label: 'Badge', default: 'RECURSOS' },
      title: { type: 'string', label: 'Título', default: 'Tudo que você precisa' },
      subtitle: { type: 'string', label: 'Subtítulo', default: 'Ferramentas poderosas para criar páginas que convertem' },
      features: {
        type: 'array',
        label: 'Features',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', label: 'Título' },
            description: { type: 'string', label: 'Descrição' },
            icon_path: { type: 'string', label: 'SVG Path', default: 'M13 10V3L4 14h7v7l9-11h-7z' },
            icon_bg: { type: 'string', label: 'Cor do Ícone (bg)', default: 'bg-blue-100 dark:bg-blue-900/30' },
            icon_color: { type: 'string', label: 'Cor do Ícone', default: 'text-blue-600 dark:text-blue-400' },
          }
        },
        default: [
          { title: 'Editor Visual', description: 'Arraste, solte, edite. Sem código necessário.', icon_path: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', icon_bg: 'bg-blue-100 dark:bg-blue-900/30', icon_color: 'text-blue-600 dark:text-blue-400' },
          { title: 'Domínio Próprio', description: 'Conecte seu domínio e publique com SSL automático.', icon_path: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9 9 9 0 019 9z', icon_bg: 'bg-green-100 dark:bg-green-900/30', icon_color: 'text-green-600 dark:text-green-400' },
          { title: 'Clonagem IA', description: 'Cole uma URL e a IA reconstrói a página.', icon_path: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', icon_bg: 'bg-purple-100 dark:bg-purple-900/30', icon_color: 'text-purple-600 dark:text-purple-400' },
        ]
      },
    },
    isGlobal: true,
  },
  {
    name: 'Depoimentos Carrossel',
    category: 'TESTIMONIALS',
    description: 'Carrossel de depoimentos de clientes',
    html: `<section class="testimonials py-20 px-4 bg-white dark:bg-gray-900">
  <div class="max-w-4xl mx-auto">
    <div class="text-center mb-16">
      <span class="badge-inline px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-4">{{badge}}</span>
      <h2 class="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">{{title}}</h2>
      <p class="text-lg text-gray-600 dark:text-gray-300">{{subtitle}}</p>
    </div>
    <div class="testimonials-carousel relative">
      <div class="testimonials-track flex overflow-hidden">
        {{#each testimonials}}
        <div class="testimonial-slide min-w-full lg:min-w-[calc(33.333%-1.33rem)] px-4">
          <div class="testimonial-card p-8 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 h-full">
            <div class="flex gap-1 mb-4">{{#each rating}}<svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.18-4.87L12 2z"/></svg>{{/each}}</div>
            <p class="text-lg text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">{{text}}</p>
            <div class="flex items-center gap-4">
              <img src="{{avatar}}" alt="{{author}}" class="w-12 h-12 rounded-full object-cover" />
              <div>
                <p class="font-semibold text-gray-900 dark:text-white">{{author}}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{role}}</p>
              </div>
            </div>
          </div>
        </div>
        {{/each}}
      </div>
      <button class="carousel-btn prev absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-12 h-12 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition">
        <svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
      </button>
      <button class="carousel-btn next absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-12 h-12 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition">
        <svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
      </button>
    </div>
  </div>
</section>`,
    css: `.testimonials-track { transition: transform 0.5s ease; } .testimonial-card { transition: all 0.3s ease; }`,
    props: {
      badge: { type: 'string', label: 'Badge', default: 'AMADO POR MILHARES' },
      title: { type: 'string', label: 'Título', default: 'O que nossos clientes dizem' },
      subtitle: { type: 'string', label: 'Subtítulo', default: 'Junte-se a milhares de criadores que confiam na nossa plataforma' },
      testimonials: {
        type: 'array',
        label: 'Depoimentos',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', label: 'Texto' },
            author: { type: 'string', label: 'Autor' },
            role: { type: 'string', label: 'Cargo/Empresa' },
            avatar: { type: 'string', label: 'Avatar URL' },
            rating: { type: 'number', label: 'Estrelas (1-5)', default: 5 },
          }
        },
        default: [
          { text: 'Esta plataforma transformou completamente como criamos landing pages. O que levava dias agora leva minutos.', author: 'Maria Silva', role: 'CEO @ TechStart', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', rating: 5 },
          { text: 'A clonagem por IA é impressionante. Colei a URL de um concorrente e tive uma página melhor em minutos.', author: 'João Santos', role: 'Marketing @ GrowthCo', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', rating: 5 },
          { text: 'Finalmente uma ferramenta que entende designers. O editor visual é intuitivo e poderoso.', author: 'Ana Costa', role: 'Designer Freelancer', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100', rating: 5 },
        ]
      },
    },
    isGlobal: true,
  },
  {
    name: 'Formulário de Captura',
    category: 'FORMS',
    description: 'Formulário de lead com validação',
    html: `<section class="form-section py-20 px-4 bg-gray-50 dark:bg-gray-900">
  <div class="max-w-2xl mx-auto">
    <div class="text-center mb-10">
      <h2 class="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">{{title}}</h2>
      <p class="text-lg text-gray-600 dark:text-gray-300">{{subtitle}}</p>
    </div>
    <form class="form-card p-8 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl" id="lead-form">
      <div class="space-y-6">
        <div>
          <label for="name" class="label-block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{name_label}}</label>
          <input type="text" id="name" name="name" required class="input-field w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="{{name_placeholder}}">
        </div>
        <div>
          <label for="email" class="label-block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{email_label}}</label>
          <input type="email" id="email" name="email" required class="input-field w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="{{email_placeholder}}">
        </div>
        {{#if show_phone}}
        <div>
          <label for="phone" class="label-block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{phone_label}}</label>
          <input type="tel" id="phone" name="phone" class="input-field w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="{{phone_placeholder}}">
        </div>
        {{/if}}
        {{#if show_company}}
        <div>
          <label for="company" class="label-block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{company_label}}</label>
          <input type="text" id="company" name="company" class="input-field w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="{{company_placeholder}}">
        </div>
        {{/if}}
        <div>
          <label for="message" class="label-block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{message_label}}</label>
          <textarea id="message" name="message" rows="4" class="input-field w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" placeholder="{{message_placeholder}}"></textarea>
        </div>
        <div class="flex items-start gap-3">
          <input type="checkbox" id="privacy" name="privacy" required class="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <label for="privacy" class="text-sm text-gray-600 dark:text-gray-400">{{privacy_text}}</label>
        </div>
        <button type="submit" class="btn-submit w-full py-3 px-6 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition mt-4">{{button_text}}</button>
        <p class="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">{{disclaimer}}</p>
      </div>
    </form>
  </div>
</section>`,
    css: `.input-field:focus { box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }`,
    props: {
      title: { type: 'string', label: 'Título', default: 'Entre em Contato' },
      subtitle: { type: 'string', label: 'Subtítulo', default: 'Preencha o formulário e entraremos em contato em até 24h' },
      name_label: { type: 'string', label: 'Label Nome', default: 'Nome Completo' },
      name_placeholder: { type: 'string', label: 'Placeholder Nome', default: 'Seu nome' },
      email_label: { type: 'string', label: 'Label Email', default: 'Email Corporativo' },
      email_placeholder: { type: 'string', label: 'Placeholder Email', default: 'seu@email.com' },
      show_phone: { type: 'boolean', label: 'Mostrar Telefone?', default: true },
      phone_label: { type: 'string', label: 'Label Telefone', default: 'Telefone' },
      phone_placeholder: { type: 'string', label: 'Placeholder Telefone', default: '(11) 99999-9999' },
      show_company: { type: 'boolean', label: 'Mostrar Empresa?', default: true },
      company_label: { type: 'string', label: 'Label Empresa', default: 'Empresa' },
      company_placeholder: { type: 'string', label: 'Placeholder Empresa', default: 'Sua empresa' },
      message_label: { type: 'string', label: 'Label Mensagem', default: 'Mensagem' },
      message_placeholder: { type: 'string', label: 'Placeholder Mensagem', default: 'Conte-nos sobre seu projeto...' },
      privacy_text: { type: 'string', label: 'Texto Privacidade', default: 'Concordo com a Política de Privacidade e Termos de Uso' },
      button_text: { type: 'string', label: 'Texto do Botão', default: 'Enviar Mensagem' },
      disclaimer: { type: 'string', label: 'Disclaimer', default: 'Não fazemos spam. Seus dados estão seguros.' },
    },
    isGlobal: true,
  },
  {
    name: 'Footer Completo',
    category: 'FOOTER',
    description: 'Footer com links, newsletter e redes sociais',
    html: `<footer class="footer bg-gray-900 text-gray-300 py-16 px-4">
  <div class="max-w-6xl mx-auto">
    <div class="grid lg:grid-cols-4 gap-12 mb-12">
      <div class="lg:col-span-2">
        <div class="flex items-center gap-2 mb-6">
          <svg class="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          <span class="text-2xl font-bold text-white">{{brand_name}}</span>
        </div>
        <p class="text-gray-400 mb-6 max-w-md">{{brand_description}}</p>
        <div class="flex gap-4">
          {{#each social}}
          <a href="{{url}}" class="social-link w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-gray-700 hover:text-white transition" aria-label="{{label}}">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="{{icon_path}}"/></svg>
          </a>
          {{/each}}
        </div>
      </div>
      <div>
        <h4 class="font-semibold text-white mb-4">{{links_title}}</h4>
        <ul class="space-y-3">
          {{#each links}}
          <li><a href="{{url}}" class="hover:text-blue-400 transition">{{label}}</a></li>
          {{/each}}
        </ul>
      </div>
      <div>
        <h4 class="font-semibold text-white mb-4">{{legal_title}}</h4>
        <ul class="space-y-3">
          {{#each legal}}
          <li><a href="{{url}}" class="hover:text-blue-400 transition">{{label}}</a></li>
          {{/each}}
        </ul>
      </div>
    </div>
    <div class="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
      <p class="text-gray-500 text-sm">{{copyright}}</p>
      <div class="flex gap-6">
        {{#each bottom_links}}
        <a href="{{url}}" class="text-sm text-gray-500 hover:text-blue-400 transition">{{label}}</a>
        {{/each}}
      </div>
    </div>
  </div>
</footer>`,
    css: `.social-link { transition: all 0.2s ease; } .social-link:hover { transform: translateY(-2px); }`,
    props: {
      brand_name: { type: 'string', label: 'Nome da Marca', default: 'ROI Clone' },
      brand_description: { type: 'string', label: 'Descrição', default: 'A plataforma mais completa para clonar, editar e publicar páginas de alta conversão no seu próprio domínio.' },
      social: {
        type: 'array',
        label: 'Redes Sociais',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', label: 'Label' },
            url: { type: 'string', label: 'URL' },
            icon_path: { type: 'string', label: 'SVG Path' },
          }
        },
        default: [
          { label: 'Twitter', url: '#', icon_path: 'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-12.55 0-.19 0-.39 0-.58A6.86 6.86 0 0023 3z' },
          { label: 'GitHub', url: '#', icon_path: 'M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.804 2.807 1.28 3.491.98.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.305-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.142 3.266-1.27 3.266-1.27.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.793.577C20.566 11.797 24 7.297 24 12c0 6.627-5.373 12-12 12' },
          { label: 'LinkedIn', url: '#', icon_path: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2h-2a2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 100-4 2 2 0 000 4z' },
        ]
      },
      links: {
        type: 'array',
        label: 'Links Principais',
        items: { type: 'object', properties: { label: { type: 'string' }, url: { type: 'string' } } },
        default: [{ label: 'Recursos', url: '#' }, { label: 'Preços', url: '#' }, { label: 'Documentação', url: '#' }, { label: 'API', url: '#' }, { label: 'Comunidade', url: '#' }]
      },
      legal: {
        type: 'array',
        label: 'Links Legais',
        items: { type: 'object', properties: { label: { type: 'string' }, url: { type: 'string' } } },
        default: [{ label: 'Privacidade', url: '#' }, { label: 'Termos', url: '#' }, { label: 'Cookies', url: '#' }, { label: 'Segurança', url: '#' }]
      },
      links_title: { type: 'string', default: 'Produto' },
      legal_title: { type: 'string', default: 'Legal' },
      copyright: { type: 'string', default: '© 2024 ROI Clone. Todos os direitos reservados.' },
      bottom_links: {
        type: 'array',
        label: 'Links Inferiores',
        items: { type: 'object', properties: { label: { type: 'string' }, url: { type: 'string' } } },
        default: [{ label: 'Status', url: '#' }, { label: 'Blog', url: '#' }, { label: 'Carreiras', url: '#' }, { label: 'Contato', url: '#' }]
      },
    },
    isGlobal: true,
  },
  {
    name: 'FAQ Accordion',
    category: 'FAQ',
    description: 'Perguntas frequentes com accordion',
    html: `<section class="faq py-20 px-4 bg-white dark:bg-gray-900">
  <div class="max-w-3xl mx-auto">
    <div class="text-center mb-16">
      <span class="badge-inline px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-4">{{badge}}</span>
      <h2 class="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">{{title}}</h2>
      <p class="text-lg text-gray-600 dark:text-gray-300">{{subtitle}}</p>
    </div>
    <div class="faq-list space-y-4">
      {{#each faqs}}
      <details class="faq-item group bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <summary class="faq-question flex items-center justify-between p-6 cursor-pointer list-none">
          <span class="text-lg font-medium text-gray-900 dark:text-white pr-10">{{question}}</span>
          <svg class="faq-icon w-6 h-6 text-gray-400 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="faq-answer px-6 pb-6 text-gray-600 dark:text-gray-400 leading-relaxed">{{answer}}</div>
      </details>
      {{/each}}
    </div>
    <div class="text-center mt-12">
      <p class="text-gray-600 dark:text-gray-400 mb-4">{{cta_text}}</p>
      <a href="{{cta_link}}" class="btn-primary inline-flex px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">{{cta_button}}</a>
    </div>
  </div>
</section>`,
    css: `details[open] .faq-icon { transform: rotate(180deg); } .faq-answer { animation: slideDown 0.3s ease; } @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`,
    props: {
      badge: { type: 'string', label: 'Badge', default: 'PERGUNTAS FREQUENTES' },
      title: { type: 'string', label: 'Título', default: 'Tem dúvidas? Nós temos as respostas' },
      subtitle: { type: 'string', label: 'Subtítulo', default: 'Tudo que você precisa saber antes de começar' },
      faqs: {
        type: 'array',
        label: 'Perguntas',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', label: 'Pergunta' },
            answer: { type: 'string', label: 'Resposta' },
          }
        },
        default: [
          { question: 'Posso usar meu próprio domínio?', answer: 'Sim! Você pode conectar quantos domínios quiser. Configuramos o DNS e SSL (Let\'s Encrypt) automaticamente.' },
          { question: 'Como funciona a clonagem por IA?', answer: 'Você cola a URL da página que quer clonar, nossa engine reconstrói o HTML/CSS/JS fielmente. Depois você edita tudo no editor visual.' },
          { question: 'Tem limite de páginas?', answer: 'Não. Conecte seu domínio e publique quantas páginas quiser. Sem planos, sem limites artificiais.' },
          { question: 'Como funciona o SSL?', answer: 'Provisionamos certificados Let\'s Encrypt automaticamente quando você verifica o domínio. Renovação automática inclusa.' },
          { question: 'Posso exportar o código?', answer: 'Sim! Exportação para React/Next.js limpo - components, pages, styles. Leve pro seu repo.' },
        ],
      },
      cta_text: { type: 'string', label: 'Texto CTA', default: 'Não encontrou sua resposta?' },
      cta_button: { type: 'string', label: 'Botão CTA', default: 'Falar com Suporte' },
      cta_link: { type: 'string', label: 'Link CTA', default: '#support' },
    },
    isGlobal: true,
  },
  {
    name: 'CTA Section',
    category: 'CTA',
    description: 'Seção de chamada para ação',
    html: `<section class="cta py-20 px-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
  <div class="max-w-3xl mx-auto text-center">
    <span class="badge-inline px-3 py-1 rounded-full bg-white/20 text-white text-sm font-medium mb-4">{{badge}}</span>
    <h2 class="text-3xl md:text-4xl font-bold mb-6">{{title}}</h2>
    <p class="text-xl opacity-90 mb-8 max-w-2xl mx-auto">{{description}}</p>
    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <a href="{{cta_link}}" class="btn-primary px-8 py-4 rounded-lg bg-white text-blue-600 font-semibold hover:bg-gray-100 transition">{{cta_text}}</a>
      <a href="{{cta2_link}}" class="btn-secondary px-8 py-4 rounded-lg border-2 border-white text-white hover:bg-white/10 transition">{{cta2_text}}</a>
    </div>
    <p class="mt-8 text-sm opacity-70">{{disclaimer}}</p>
  </div>
</section>`,
    css: `.badge-inline { background: rgba(255,255,255,0.2); }`,
    props: {
      badge: { type: 'string', label: 'Badge', default: 'PRONTO PARA COMEÇAR?' },
      title: { type: 'string', label: 'Título', default: 'Transforme visitantes em clientes hoje' },
      description: { type: 'string', label: 'Descrição', default: 'Junte-se a milhares de criadores que publicam páginas de alta conversão no próprio domínio.' },
      cta_text: { type: 'string', label: 'CTA Principal', default: 'Começar Grátis' },
      cta_link: { type: 'string', label: 'Link CTA Principal', default: '#' },
      cta2_text: { type: 'string', label: 'CTA Secundário', default: 'Ver Demo' },
      cta2_link: { type: 'string', label: 'Link CTA Secundário', default: '#' },
      disclaimer: { type: 'string', label: 'Disclaimer', default: 'Sem cartão de crédito • Cancelamento a qualquer momento • 14 dias grátis' },
    },
    isGlobal: true,
  },
  {
    name: 'Navigation Bar',
    category: 'NAVIGATION',
    description: 'Barra de navegação responsiva',
    html: `<nav class="navbar fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
  <div class="max-w-7xl mx-auto px-4">
    <div class="flex items-center justify-between h-16">
      <a href="/" class="flex items-center gap-2">
        <svg class="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        <span class="text-xl font-bold text-gray-900 dark:text-white">{{brand_name}}</span>
      </a>
      <div class="hidden md:flex items-center gap-8">
        {{#each links}}
        <a href="{{url}}" class="nav-link text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition font-medium">{{label}}</a>
        {{/each}}
      </div>
      <div class="hidden md:flex items-center gap-4">
        {{#each cta}}
        <a href="{{url}}" class="{{#if primary}}btn-primary px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700{{else}}btn-secondary px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800{{/if}}">{{label}}</a>
        {{/each}}
      </div>
      <button class="md:hidden mobile-menu-btn p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </div>
  </div>
  <div class="mobile-menu md:hidden hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-4">
    {{#each links}}
    <a href="{{url}}" class="block py-3 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">{{label}}</a>
    {{/each}}
    <div class="flex flex-col gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      {{#each cta}}
      <a href="{{url}}" class="{{#if primary}}btn-primary px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-center hover:bg-blue-700{{else}}btn-secondary px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-center hover:bg-gray-100 dark:hover:bg-gray-800{{/if}}">{{label}}</a>
      {{/each}}
    </div>
  </div>
</nav>`,
    css: `.nav-link { position: relative; } .nav-link::after { content: ''; position: absolute; bottom: -4px; left: 0; width: 0; height: 2px; background: #2563eb; transition: width 0.3s; } .nav-link:hover::after { width: 100%; } .mobile-menu-btn:focus { outline: 2px solid #2563eb; outline-offset: 2px; }`,
    props: {
      brand_name: { type: 'string', label: 'Nome da Marca', default: 'ROI Clone' },
      links: {
        type: 'array',
        label: 'Links de Navegação',
        items: { type: 'object', properties: { label: { type: 'string' }, url: { type: 'string' } } },
        default: [{ label: 'Recursos', url: '#features' }, { label: 'Preços', url: '#pricing' }, { label: 'Depoimentos', url: '#testimonials' }, { label: 'FAQ', url: '#faq' }]
      },
      cta: {
        type: 'array',
        label: 'CTAs',
        items: { type: 'object', properties: { label: { type: 'string' }, url: { type: 'string' }, primary: { type: 'boolean', default: false } } },
        default: [{ label: 'Entrar', url: '/login', primary: false }, { label: 'Começar Grátis', url: '/register', primary: true }]
      },
    },
    isGlobal: true,
  },
];

async function main() {
  console.log('🌱 Seeding global components...');

  for (const comp of globalComponents) {
    const existing = await prisma.component.findFirst({
      where: { name: comp.name, isGlobal: true },
    });

    if (!existing) {
      await prisma.component.create({
        data: comp,
      });
      console.log(`✅ Created: ${comp.name}`);
    } else {
      console.log(`ℹ️ Exists: ${comp.name}`);
    }
  }

  console.log('🎉 Global components seeded!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
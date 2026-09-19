# ROI Clone - Plataforma de Clonagem de Páginas

Clone qualquer página web e publique no seu próprio domínio. Editor visual, SSL automático, sem planos - só conecte seu domínio.

## 🚀 Funcionalidades

- **Clonagem Inteligente**: Cole uma URL e a engine reconstrói o design fielmente
- **Editor Visual**: Clique em qualquer elemento para editar textos, imagens, botões, links
- **Domínios Próprios**: Conecte quantos domínios quiser, DNS e SSL (Let's Encrypt) automáticos
- **Sem Planos**: Pague apenas pelo que usar, sem limites artificiais
- **Painel Admin Completo**: Gestão de usuários, domínios, páginas, clonagens, logs

## 🛠 Stack Tecnológica

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, NextAuth.js v5
- **Database**: PostgreSQL + Prisma ORM
- **Cloning Engine**: Puppeteer + Cheerio
- **Auth**: Credentials + JWT sessions

## 📦 Instalação Rápida

### Com Docker (Recomendado)

```bash
# Clone o repositório
cd roi-clone

# Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações

# Suba os containers
docker-compose up -d

# Execute migrações e seed
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx tsx prisma/seed.ts

# Acesse http://localhost:3000
```

### Desenvolvimento Local

```bash
# Instale dependências
npm install

# Configure banco PostgreSQL local ou use Docker apenas para DB
docker-compose up -d postgres redis

# Configure .env
cp .env.example .env

# Setup do banco
npx prisma generate
npx prisma migrate dev
npx tsx prisma/seed.ts

# Inicie desenvolvimento
npm run dev
```

## 🔐 Acesso Admin Padrão

Após rodar o seed:
- **Email**: admin@roi-clone.local
- **Senha**: admin123456
- **Painel Admin**: http://localhost:3000/admin

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── (auth)/           # Login, Register
│   ├── (dashboard)/      # Dashboard do usuário
│   │   ├── dashboard/    # Overview
│   │   ├── domains/      # Gestão de domínios
│   │   ├── pages/        # Gestão de páginas
│   │   ├── clones/       # Clonagens
│   │   └── editor/[id]/  # Editor visual
│   ├── (admin)/          # Painel administrativo
│   └── api/              # API Routes
├── components/
│   ├── ui/               # Componentes base (Button, Input, Card, etc)
│   └── editor/           # Componentes do editor
├── lib/
│   ├── auth.ts           # Config NextAuth
│   ├── prisma.ts         # Cliente Prisma
│   ├── validations.ts    # Schemas Zod
│   ├── cloning-engine.ts # Engine de clonagem
│   └── utils.ts          # Utilitários
└── hooks/                # Custom hooks
```

## 🔧 Configuração de Produção

### Variáveis de Ambiente Obrigatórias

```env
DATABASE_URL="postgresql://user:pass@host:5432/db"
NEXTAUTH_URL="https://seudominio.com"
NEXTAUTH_SECRET="seu-secret-super-seguro-32-chars-min"
ACME_EMAIL="admin@seudominio.com"
```

### SSL/Let's Encrypt

O sistema provisiona SSL automaticamente via ACME (Let's Encrypt). Configure:
- `ACME_EMAIL` para notificações de expiração
- `ACME_DIRECTORY_URL` para staging/production

### Domínios Personalizados

Usuários adicionam domínios no painel → sistema gera registros DNS (TXT/CNAME) → usuário configura no provedor DNS → sistema verifica e provisiona SSL.

## 🧪 Testes

```bash
# Lint
npm run lint

# Type check
npx tsc --noEmit

# Build production
npm run build
```

## 📝 Licença

MIT - Use livremente para projetos pessoais e comerciais.
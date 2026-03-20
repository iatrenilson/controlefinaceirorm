# 💰 RW Investimentos Financeiros

Sistema completo de controle financeiro pessoal com gestão de empréstimos, controle de receitas/despesas, relatórios e módulo de delay esportivo.

## 🚀 Tecnologias

- **React 18** + TypeScript + Vite
- **Supabase** — autenticação, banco de dados em tempo real
- **Tailwind CSS** + shadcn/ui — interface moderna
- **Recharts** — gráficos interativos
- **Framer Motion** — animações
- **React Hook Form** + Zod — formulários validados

## ⚙️ Instalação e Configuração

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/controlefinaceirorm.git
cd controlefinaceirorm
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais do Supabase:
```
VITE_SUPABASE_PROJECT_ID="seu_project_id"
VITE_SUPABASE_URL="https://seu_project_id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sua_anon_key"
```

> 🔑 Suas credenciais estão em: [Supabase Dashboard](https://supabase.com/dashboard) → Seu Projeto → Settings → API

### 4. Rode o projeto
```bash
npm run dev
```

Acesse: **http://localhost:8080**

## 📁 Estrutura do Projeto

```
src/
├── components/
│   ├── ui/              # Componentes shadcn/ui
│   ├── dashboard/       # Gráficos e cards do dashboard
│   ├── AppSidebar.tsx   # Menu lateral
│   ├── DigitalClock.tsx # Relógio digital
│   └── NotificationBell.tsx
├── hooks/
│   ├── useAuth.tsx      # Autenticação
│   └── useUserRole.tsx  # Controle de papéis
├── integrations/
│   └── supabase/        # Cliente e tipos do Supabase
├── pages/
│   ├── Dashboard.tsx    # Visão geral
│   ├── Index.tsx        # Controle Financeiro
│   ├── Emprestimos.tsx  # Gestão de empréstimos
│   ├── Relatorios.tsx   # Relatórios e exportação
│   ├── Admin.tsx        # Painel administrativo
│   ├── DelayEsportivo.tsx
│   └── ...
└── lib/
    └── utils.ts
```

## 👥 Roles de Usuário

| Role | Acesso |
|------|--------|
| `user` | Dashboard, Financeiro, Empréstimos, Relatórios |
| `moderator` | + Delay Esportivo |
| `admin` | + Painel Admin completo |

## 🏗️ Scripts disponíveis

```bash
npm run dev      # Desenvolvimento
npm run build    # Build de produção
npm run preview  # Preview do build
npm run test     # Testes
```

## 🗄️ Banco de Dados

O projeto usa Supabase com as seguintes tabelas principais:
- `financeiro` — receitas e despesas
- `clientes` — empréstimos ativos
- `clientes_historico` — histórico de empréstimos
- `wallets` — saldos
- `notifications` — notificações em tempo real
- `user_roles` — controle de acesso
- `bank_balances` — saldos bancários

## 📦 Deploy

### Vercel
```bash
npm run build
# Faça o deploy da pasta dist/
```

Não esqueça de configurar as variáveis de ambiente no painel do Vercel.

---

Desenvolvido com ❤️ para RW Investimentos

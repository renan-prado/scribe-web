# Scriba

Transcrição e resumo de sermões e aulas bíblicas. O celular grava a pregação
inteira num arquivo só e a tela fica quieta; no stop, o áudio sobe, é transcrito
de uma vez e vira um resumo estruturado. A partir dele sai um estudo teológico,
se a pessoa pedir. Também dá para importar um vídeo do YouTube e receber o mesmo
resumo a partir da legenda.

Next.js 16 (App Router) · React 19 · Supabase · Tailwind v4 · Stripe.

## Rodar localmente

Requer Node 20+ e um `.env.dev` (o modelo é `.env.example`, peça os valores a
quem já tem o ambiente).

```bash
npm install
npm run dev          # http://localhost:3000, contra o Supabase e o Stripe de DEV
```

**Não crie `.env.local`.** O Next o carregaria sozinho, e um `next dev`
distraído passaria a falar com produção sem avisar. O `src/scripts/with-env.mjs`
aborta se encontrar qualquer arquivo dessa família. Detalhes em
[`docs/ambientes.md`](./docs/ambientes.md).

## Onde fica o quê

```
src/app/        as rotas, agrupadas por área: (site) (entrar) (app) (painel)
src/lib/        a camada de servidor: LLM, banco, env, auth, cobrança
src/features/   as features, componentes e hooks
src/shared/     tema, tokens, marca e a UI base
src/scripts/    release, db:push, with-env, stripe:doctor
supabase/       as migrações
docs/           os guias longos
```

Na raiz ficam só configuração, `public/` e `supabase/` — os dois últimos porque
o Next e o CLI do Supabase os procuram lá.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | dev server com `.env.dev` |
| `npm run prod` | dev server com `.env.prod`. **Dados reais, Stripe LIVE** |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Biome: organiza imports, formata, corrige lint |
| `npm run db:push` | aplica as migrações no Supabase de dev |
| `npm run stripe:doctor` | diagnostica a configuração do Stripe |

Commits seguem [Conventional Commits](https://www.conventionalcommits.org)
(validado pelo husky).

## Ambientes

Um projeto na Vercel, dois destinos:

- `master` → [scriba.cc](https://scriba.cc) (Production)
- `develop` → [dev.scriba.cc](https://dev.scriba.cc) (Preview)

Cada um com seu Supabase e seu Stripe. Nunca aponte os dois para o mesmo
banco, o `with-env` recusa.

## Documentação

O código é comentado com o **porquê** das decisões, e os cabeçalhos de arquivo
são a primeira parada. Acima deles:

- **[`AGENTS.md`](./AGENTS.md)**: o índice. Cada pasta relevante tem o seu,
  com as regras que valem ali (`src/app/`, `src/lib/`, `src/features/billing/server/`,
  `src/features/*/`, `src/shared/`, `supabase/`).
- **[`docs/`](./docs/README.md)**: guias longos: configuração de ambiente,
  Stripe, programa de parceiros, bridge React Native, e a auditoria de
  segurança em [`docs/security/`](./docs/security/README.md).

Esses documentos são escritos para agentes de IA e para pessoas ao mesmo
tempo. Mudou um comportamento que algum deles descreve? Atualize no mesmo
commit, um doc errado é pior que doc nenhum, porque é lido com confiança.

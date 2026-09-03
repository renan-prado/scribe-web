# Scriba

Transcrição e resumo ao vivo de sermões e aulas bíblicas. O gravador emite
chunks de áudio que sobem para rotas de API com OpenAI atrás; enquanto a
pessoa ouve, um feed vai mostrando os versículos citados, destaques da fala e
contexto. No stop, um resumo estruturado do encontro inteiro.

Next.js 16 (App Router) · React 19 · Supabase · Tailwind v4 · Stripe.

## Rodar localmente

Requer Node 20+ e um `.env.dev` (o modelo é `.env.example` — peça os valores a
quem já tem o ambiente).

```bash
npm install
npm run dev          # http://localhost:3000, contra o Supabase e o Stripe de DEV
```

**Não crie `.env.local`.** O Next o carregaria sozinho, e um `next dev`
distraído passaria a falar com produção sem avisar. O `scripts/with-env.mjs`
aborta se encontrar qualquer arquivo dessa família. Detalhes em
[`docs/ambientes.md`](./docs/ambientes.md).

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
banco — o `with-env` recusa.

## Documentação

O código é comentado com o **porquê** das decisões, e os cabeçalhos de arquivo
são a primeira parada. Acima deles:

- **[`AGENTS.md`](./AGENTS.md)** — o índice. Cada pasta relevante tem o seu,
  com as regras que valem ali (`app/`, `lib/`, `lib/billing/`,
  `src/features/*/`, `src/shared/`, `supabase/`).
- **[`docs/`](./docs/README.md)** — guias longos: configuração de ambiente,
  Stripe, programa de parceiros, bridge React Native.

Esses documentos são escritos para agentes de IA e para pessoas ao mesmo
tempo. Mudou um comportamento que algum deles descreve? Atualize no mesmo
commit — um doc errado é pior que doc nenhum, porque é lido com confiança.

/**
 * Em qual deploy este código está rodando.
 *
 * `VERCEL_ENV` é `production` só no deploy de `master` em `scriba.cc`. Em
 * `dev.scriba.cc` vale `preview` (é um Preview com domínio fixado, ver
 * `docs/ambientes.md`) e no `npm run dev`/`npm run prod` da máquina local a
 * variável simplesmente não existe — então `false` é o padrão seguro para
 * tudo que só pode acontecer no site de verdade.
 *
 * Não é `NEXT_PUBLIC_`: só quem renderiza no servidor (ou no build) lê isso.
 * Como o valor é fixado no build de cada deploy, uma página estática pode
 * consultá-lo sem perder a estaticidade — ler `process.env` não torna uma
 * rota dinâmica, ao contrário de `cookies()`/`headers()`.
 */
export const IS_PRODUCTION_DEPLOY = process.env.VERCEL_ENV === "production";

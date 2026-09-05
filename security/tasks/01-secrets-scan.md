# 01 — Varredura de secrets

**Status:** ✅ Concluído (última rodada: ver `CHECKLIST.md`)

## Objetivo

Garantir que nenhuma chave, token ou credencial real está no código, no
histórico do git, ou vazando para o navegador.

## Prompt para a IA

```
Act as a security researcher auditing my repo for exposed secrets. Find:

1. Hardcoded API keys, tokens, passwords, or connection strings in any file

2. .env files that are committed or missing from .gitignore

3. Secrets in git history even if the file was deleted later

4. Secrets that ship to the browser in frontend code or build output

5. Public/anon keys doing privileged work

Output a table: file and line | what leaked | how an attacker finds it |

severity (CRITICAL / HIGH / MEDIUM) | exact fix.

Then list every key I need to rotate. A key that ever touched a commit is

burned, hiding it now is not enough.
```

## Checklist de validação

- [ ] `.env.dev` e `.env.prod` não estão versionados (`git ls-files | grep env`
      deve retornar só `.env.example`).
- [ ] Nenhum `sk_live_`, `sk_test_`, service-role key do Supabase, ou chave da
      OpenAI aparece hardcoded em `lib/`, `app/`, `src/`, ou em `scripts/`.
- [ ] `git log -p --all -- .env*` e `git log -S"sk_live_" --all` (e
      equivalentes para outras chaves) não retornam nada — se retornarem, a
      chave está queimada mesmo que o arquivo tenha sido apagado depois.
- [ ] Toda variável exposta ao cliente usa o prefixo `NEXT_PUBLIC_` de
      propósito — nenhuma chave de servidor (`serverEnv` em
      `lib/env/server.ts`) vaza para um componente `"use client"` ou para o
      bundle do navegador.
- [ ] A anon key do Supabase (pública por design) não está fazendo trabalho
      privilegiado — ou seja, RLS cobre tudo que ela consegue alcançar (ver
      tarefa 03). Uma anon key não é um secret que precisa rotação, mas se
      ela sozinha permite escrever/ler dado de outro usuário, o problema é
      RLS, não a chave.
- [ ] `scripts/with-env.mjs` continua abortando se achar `.env`, `.env.local`,
      `.env.development[.local]` ou `.env.production[.local]`, e se achar
      `sk_live_` dentro de `.env.dev`.

## Áreas do repositório a inspecionar

- `.env.example`, `scripts/with-env.mjs`, `.gitignore`
- `lib/env/server.ts`, `lib/env/client.ts`
- Qualquer arquivo em `app/` marcado `"use client"` que importe de `lib/`
- Histórico completo do git (`git log --all`), não só o HEAD atual

## Critério de aceite

Nenhuma linha na tabela de saída com severidade CRITICAL ou HIGH sem uma
correção aplicada E a chave correspondente rotacionada (se ela já tiver
tocado um commit, rotação é obrigatória mesmo depois do arquivo removido).

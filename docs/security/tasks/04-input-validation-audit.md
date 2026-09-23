# 04: Auditoria de input

**Status:** ✅ Concluído, 3 achados (LOW/INFORMATIONAL), corrigidos e reverificados. Ver "Rodada 2026-09-05".

## Objetivo

Rastrear todo caminho onde input de usuário chega em algo perigoso: query,
comando de sistema, upload, ou HTML renderizado sem escape.

## Prompt para a IA

```
Trace every path where user input reaches something dangerous in this repo:

1. SQL or NoSQL queries built with string concatenation or template literals

instead of parameters

2. Input passed to eval, exec, child_process, or shell commands

3. File uploads: is the filename sanitized, is the type verified server-side,

can I upload an executable or path-traverse with ../

4. User content rendered as HTML without escaping, including

dangerouslySetInnerHTML and markdown renderers

5. Endpoints with no server-side validation at all

Output: file and line | input source | what it reaches | a working example

payload | severity | fix.
```

## Checklist de validação

- [x] Toda query ao Supabase usa o client (`.from().select()/.insert()`,
      RPC parametrizado), nenhuma string interpolada montando SQL cru.
- [x] Todo `route.ts` em `src/app/api/**` valida o corpo da requisição com Zod
      (ou equivalente) antes de usar qualquer campo, checar em especial
      `src/app/api/coins/charge`, `src/app/api/deepening`,
      `src/app/api/deepening/reprocess`, `src/app/api/final-summary/reprocess`
      (arquivos alterados recentemente, ver `git status`) e
      `src/app/api/transcribe`, que recebe binário de áudio.
- [x] Upload de chunk de áudio (`src/app/api/transcribe`) verifica tipo/tamanho
      no servidor, não confia só no `Content-Type` enviado pelo client, e
      não deriva nenhum path de arquivo a partir de input do usuário.
- [x] Nenhum uso de `eval`, `Function(...)`, `child_process.exec` (ou
      `execSync`) com string vinda de input de usuário em `src/app/`, `src/lib/`,
      `src/` ou `src/scripts/`.
- [x] Transcrição, resumo e cards do feed (conteúdo gerado por LLM a partir
      de fala do usuário) são renderizados como texto, se algum componente
      usa `dangerouslySetInnerHTML` ou um markdown renderer, confirmar que
      passa por sanitização (ex.: DOMPurify) antes.
- [x] Nenhum endpoint aceita e persiste dado sem qualquer validação de
      schema, "sem validação nenhuma" é a categoria mais fácil de virar
      RCE ou corrupção de dado indiretamente.

## Áreas do repositório a inspecionar

- `src/app/api/**/route.ts` (todas as rotas)
- Componentes que renderizam transcrição/resumo/cards em
  `src/features/session/`
- `src/app/api/transcribe`, `src/app/api/deepening`, `src/app/api/final-summary`

## Critério de aceite

Cada payload de exemplo listado na saída do prompt deixa de funcionar depois
da correção, reproduzir o ataque e confirmar falha antes de fechar.

---

## Rodada 2026-09-05

### 1. Onde input de usuário chega: e onde ele NÃO chega

O que a varredura procurou e **não achou nenhuma ocorrência**, o que já é a
resposta da metade do prompt:

| Sink | Ocorrências em `src/app/` `src/lib/` `src/` |
|---|---|
| SQL montado por concatenação ou template literal | **zero**, toda consulta passa pelo client (`.from().select()`) ou por RPC com parâmetro nomeado |
| `eval(` / `new Function(` | **zero** (os `\.exec(` que a busca traz são `RegExp.prototype.exec`) |
| `child_process` / `execSync` / shell | **zero** em `src/app/`, `src/lib/`, `src/`. Em `src/scripts/` existem três, e as três recebem argv em ARRAY, com argumentos do próprio desenvolvedor no terminal, não há caminho de usuário até lá |
| Renderizador de markdown | **zero**, não há dependência disso no `package.json` |
| `dangerouslySetInnerHTML` | três, e as três com conteúdo de compilação: `LandingJsonLd` (JSON-LD serializado de uma constante), `HeroEyebrowScript` e `ThemeScript` (scripts literais, com dois hexadecimais interpolados de uma constante do próprio código). Nenhum dado de usuário ou de LLM |
| Path de arquivo derivado de input | **zero**, nada é escrito em disco. O áudio do chunk vai direto para a OpenAI e o texto vai para o banco |

Transcrição, resumo, cards e estudo são renderizados como **nó de texto do
React**, que escapa por construção. Não existe sink de HTML para onde um
`<img src=x onerror=…>` dito em voz alta pudesse ir.

### 2. Cobertura de Zod nas 32 rotas

As 20 rotas com corpo validam com `parseJsonBody(request, Schema)`. As demais
não têm corpo (GET de `coins/balance`, `billing/summary`, `admin/users`; POST
sem payload de `billing/portal`), validam por assinatura (`stripe/webhook`,
HMAC) ou por segredo (`billing/sweep`, `CRON_SECRET`). As três rotas com query
string (`feed`, `locations`, `speakers`) passam por Zod ou por corte de
tamanho.

### 3. Achados

| Arquivo:linha | Fonte | Onde chegava | Payload | Sev. | Correção |
|---|---|---|---|---|---|
| `src/app/api/feed/route.ts:37` | `?excludeSessionId=` | um `neq` no banco, sem forma conferida, era o único parâmetro da rota que escapava do Zod (`order`, `offset` e `limit` já passavam) | `GET /api/feed?excludeSessionId=nao-e-uuid` → 200, com o valor indo cru para a consulta | LOW | ✅ `OptionalUuidSchema`; agora **400 `invalid_query`** |
| `src/lib/db/{locations,speakers}.ts`, `src/lib/db/feature-flags.ts:148`, `src/features/admin/server/db/partners.ts:221` | nome digitado e e-mail digitado | dentro de um `ilike`, onde `%` e `_` são CURINGAS | `?q=%` devolvia a lista inteira em vez do que casa com "%". Nos dois de e-mail é pior: rodam com **service-role**, sem RLS, e resolvem e-mail → `id` que vira permissão (exceção de feature, vínculo de parceiro) | LOW | ✅ `escapeLikeValue` extraído de `require-partner.ts` para `src/lib/db/like.ts` e aplicado nos cinco pontos |
| `src/app/api/transcribe/route.ts:88` | campo `chunkIndex` do multipart | interpolado no `filename` que mandamos para a OpenAI, sem forma nem tamanho | Injeção de cabeçalho multipart **não** acontece, verificado: o `FormData` do undici percent-encoda `"` e CRLF (`filename="chunk-0%22%0D%0AX-Injected: 1…"`). O que faltava era limite: nada impedia um `chunkIndex` de um megabyte | INFORMATIONAL | ✅ `/^\d{1,6}$/`, senão `"x"` |

### 4. Reverificação

```
GET /api/feed?excludeSessionId=nao-e-uuid                    → 400 invalid_query
GET /api/feed?excludeSessionId=00000000-0000-4000-8000-…     → 200
GET /api/feed                                                → 200  (caminho normal intacto)
```

Para o curinga, três locais semeados na conta de teste, "Igreja Central",
"Assembleia do Bairro" e "100% Fé":

```
q="%"       → ["100% Fé"]        ← antes devolvia os TRÊS
q="100%"    → ["100% Fé"]
q="Igreja"  → ["Igreja Central"]  ← busca normal segue funcionando
q="_"       → []
```

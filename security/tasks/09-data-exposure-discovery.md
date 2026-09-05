# 09 — Vazão de dados (information exposure e descoberta de rotas)

**Status:** ✅ Concluído — nenhuma correção de código necessária. Um achado categoria B (Informational), sem ação de obscuridade. Ver "Rodada 2026-09-05".

## Objetivo

Verificar se `robots.txt`, `sitemap.xml` e arquivos públicos revelam
estrutura interna, e classificar cada achado corretamente (exposição de
informação vs. controle de acesso quebrado vs. falso positivo).

## Prompt para a IA

```
Faça uma auditoria de segurança focada em **Information Exposure e descoberta de rotas/endpoints**, verificando se arquivos públicos ou mecanismos de indexação estão revelando informações que não deveriam estar disponíveis ou facilitando a descoberta de áreas internas da aplicação.

Analise principalmente:

### 1. robots.txt

Verifique:

* `/robots.txt`
* Diretivas `Disallow`
* Diretivas `Allow`
* Referências a sitemaps
* Caminhos administrativos, internos ou sensíveis mencionados no arquivo
* Rotas como `/admin`, `/dashboard`, `/internal`, `/api`, `/debug`, `/private`, `/management` etc.

IMPORTANTE: `robots.txt` **não é mecanismo de segurança**. Se uma rota sensível aparece em `Disallow`, considere isso uma possível **exposição de informação**, mas não uma vulnerabilidade de controle de acesso por si só.

Verifique se os caminhos revelados permitem descobrir:

* Painéis administrativos
* APIs internas
* Ferramentas de gerenciamento
* Áreas de debug
* Endpoints de autenticação
* Recursos privados
* Estrutura interna da aplicação

### 2. sitemap.xml

Verifique:

* `/sitemap.xml`
* Sitemaps referenciados por ele
* Sitemaps index
* URLs listadas
* URLs de áreas autenticadas ou que deveriam ser privadas
* URLs administrativas
* URLs internas
* URLs de staging, preview ou ambientes de teste
* Parâmetros ou identificadores potencialmente sensíveis
* Subdomínios ou hosts inesperados

Avalie se o sitemap está expondo rotas que deveriam ser privadas ou apenas rotas públicas que não apresentam risco.

### 3. Arquivos e endpoints de descoberta

Procure por arquivos e endpoints públicos que possam revelar estrutura interna, incluindo:

* `robots.txt`
* `sitemap.xml`
* `sitemap_index.xml`
* `security.txt`
* `.well-known/*`
* `manifest.json`
* `asset-manifest.json`
* `build-manifest.json`
* `routes-manifest.json`
* source maps (`*.map`)
* arquivos de configuração públicos
* páginas de erro
* páginas de documentação de API
* Swagger/OpenAPI
* GraphQL introspection
* endpoints de health check
* endpoints de debug
* arquivos de índice ou listagem de diretórios

Verifique também referências encontradas em HTML, JavaScript, CSS e metadados.

### 4. Rotas administrativas e internas

Tente identificar rotas potencialmente sensíveis, como:

* `/admin`
* `/administrator`
* `/dashboard`
* `/management`
* `/internal`
* `/private`
* `/debug`
* `/dev`
* `/staging`
* `/preview`
* `/test`
* `/api`
* `/api/admin`
* `/api/internal`

Não se limite a esses nomes. Identifique padrões específicos da aplicação.

Para cada rota encontrada, determine:

1. Ela existe?
2. É publicamente acessível?
3. Exige autenticação?
4. Exige autorização adequada?
5. Um usuário comum consegue acessá-la?
6. Um usuário autenticado com poucos privilégios consegue acessá-la?
7. A existência da rota é revelada por algum arquivo público?
8. Ela expõe informações sensíveis mesmo retornando erro ou `401/403`?

### 5. Ambientes e infraestrutura

Procure referências a:

* staging
* development
* preview
* test
* localhost
* IPs internos
* nomes de hosts internos
* subdomínios administrativos
* serviços de terceiros
* ferramentas internas
* endpoints de monitoramento

Verifique se essas informações aparecem em HTML, JavaScript, headers, mensagens de erro, source maps ou arquivos públicos.

### 6. Verificação de falsos positivos

Não classifique automaticamente uma rota como vulnerável apenas porque ela:

* aparece no `robots.txt`
* aparece no sitemap
* retorna `401`
* retorna `403`
* possui nome `/admin`
* é descoberta pelo crawler

Diferencie claramente:

**A. Informação pública legítima**
Uma rota pública que não contém informação sensível.

**B. Information Exposure**
Uma informação que não deveria ser divulgada, mas que não permite acesso indevido por si só.

**C. Broken Access Control**
Uma área que deveria exigir autorização, mas pode ser acessada sem as permissões necessárias.

**D. Security Misconfiguration**
Uma configuração que expõe desnecessariamente uma área, arquivo ou serviço.

### 7. Resultado

Para cada achado, apresente:

* **Severidade:** Critical / High / Medium / Low / Informational
* **Tipo:** Information Exposure / Broken Access Control / Security Misconfiguration / outro
* **URL ou recurso**
* **Como foi descoberto**
* **O que está sendo exposto**
* **Por que isso é ou não é um problema**
* **Impacto**
* **Evidência**
* **Correção recomendada**

No final, produza uma seção:

### Prioridade de correção

Liste somente os problemas que realmente merecem correção, ordenados por risco.

Dê preferência a **controle de acesso real, remoção de informações sensíveis e isolamento de recursos internos**, e não a técnicas de obscuridade como simplesmente remover uma rota do `robots.txt`.
```

## Checklist de validação

- [x] `app/robots.ts` e `app/sitemap.ts` não listam nem excluem
      explicitamente rotas administrativas de um jeito que confirme a
      existência delas para quem lê o arquivo — se `/admin` aparecer em
      `Disallow`, tratar como exposição de informação (categoria B), e
      resolver testando se `/admin` de fato bloqueia sem sessão de admin
      (categoria C, se falhar).
- [x] `app/manifest.ts` e `app/api/**` não revelam rotas internas além do
      necessário.
- [x] Nenhum source map (`*.map`) é servido publicamente em produção.
- [x] `app/api/admin/**`, `app/api/**` genericamente: confirmar que um
      `401`/`403` correto não vaza corpo com detalhe interno (nome de
      tabela, stack trace, versão de lib).
- [x] Nenhuma referência a domínio de staging/interno vaza em HTML/JS
      público — `dev.scriba.cc` é esperado ser conhecido (é o preview
      público do projeto), então não é achado por si só; o que importa é
      se esse domínio expõe algo que produção não expõe (ex.: dados reais
      atrás de proteção mais fraca).
- [x] Distinguir claramente, para cada achado, entre as quatro categorias
      do prompt (A/B/C/D) antes de decidir severidade — não escalar
      informação pública legítima a HIGH só por aparecer numa varredura.

## Áreas do repositório a inspecionar

- `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`
- `app/api/**` (para checar mensagens de erro)
- `next.config.ts` (source maps em produção)

## Critério de aceite

Cada achado carrega a classificação A/B/C/D do próprio prompt, e a "seção
de prioridade de correção" final só lista itens de categoria B, C ou D —
nunca uma correção que seja apenas remover algo do `robots.txt` ou trocar
de nome uma rota.

---

## Rodada 2026-09-05

Sondagem com `curl` contra `npm run dev` e contra `scriba.cc`.

### 1. Endpoints de descoberta — todos negativos

| Recurso | Resultado |
|---|---|
| `/sitemap.xml` | 200 — lista SÓ `/`, `/privacy`, `/terms` (todas públicas). Nenhuma URL privada, de preview ou com id |
| `/manifest.webmanifest` | 200 — nome, ícones, cores. Nenhuma rota interna |
| `/.well-known/security.txt`, `/security.txt` | 307 (não existem) |
| `*.map` (source map) | dev 404, **prod 403** — não servidos |
| `/build-manifest.json`, `/routes-manifest.json`, `/_next/routes-manifest.json` | 307 (não expostos) |
| `/api/health`, `/healthz`, `/graphql`, `/api/openapi.json`, `/swagger` | 307 — não existem (o proxy trata path desconhecido como protegido → redireciona) |

Não há Swagger/OpenAPI, GraphQL (logo, sem introspection), health check nem
listagem de diretório. Sem página de erro com stack (tarefa 08 confirmou corpo
de erro genérico).

### 2. robots.txt — a única classificação a fazer

- **dev (`dev.scriba.cc`):** `Disallow: /` e nada mais. O `IS_INDEXABLE` faz o
  ambiente de preview **não vazar** o mapa de caminhos de produção. ✅
- **prod (`scriba.cc`):** lista em `Disallow` os caminhos privados —
  `/admin`, `/api/`, `/auth/`, `/feed`, `/profile`, `/list`, `/studies`,
  `/recording/`, `/session/`, `/billing/`.

| Achado | Categoria | Análise |
|---|---|---|
| `robots.txt` de prod nomeia `/admin` e os demais caminhos autenticados | **B — Information Exposure** | Confirma a existência de `/admin` a quem lê o arquivo. Mas: (1) são caminhos previsíveis de qualquer SaaS, não segredo; (2) o controle de acesso é REAL — `/admin` → **307 → /sign-in** sem sessão, e **404** para autenticado não-admin (tarefa 02); (3) a lista existe para ECONOMIZAR orçamento de rastreio em páginas que respondem `307`, que é o uso legítimo do `Disallow`. Não é categoria C (o acesso não está quebrado) nem D |

**Correção: nenhuma.** Tirar `/admin` do `robots.txt` seria exatamente a
obscuridade que este arquivo proíbe chamar de correção — com o custo real de
desperdiçar orçamento de rastreio. A proteção correta (auth no servidor) já
está no lugar e foi verificada. Fica registrado como Informational aceito.

### 3. Classificação de todos os achados (A/B/C/D)

| Recurso | Categoria |
|---|---|
| `/sitemap.xml`, `/manifest.webmanifest`, `/`, `/privacy`, `/terms` | **A** — público legítimo, sem informação sensível |
| `robots.txt` de prod nomeando caminhos privados | **B** — exposição menor, acesso protegido |
| `/admin`, `/api/admin/*` | não é achado — 307/404 sem privilégio (controle de acesso íntegro) |
| `dev.scriba.cc` | **A** — preview público por desenho; não expõe nada além da produção (mesma auth, mesma RLS) |

### Prioridade de correção

**Vazia.** Nenhum achado de categoria C ou D. O único item (B) se resolve com
o controle de acesso que já existe, não com obscuridade — portanto não entra
como correção a fazer.

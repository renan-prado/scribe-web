# 08 — Superfície de ataque e exposição da infraestrutura

**Status:** ⚠️ Bloqueado — **o repositório GitHub está PÚBLICO** (`renan-prado/scribe-web`). Só o usuário muda visibilidade. Todo o resto foi auditado e passou. Ver "Rodada 2026-09-05".

## Objetivo

Mapear o que está exposto externamente — repositório, serviços
administrativos, WAF/CDN — priorizando controle de acesso real sobre
obscuridade.

## Prompt para a IA

```
Faça uma auditoria de segurança focada em exposição desnecessária da aplicação e da infraestrutura, considerando principalmente OWASP A05 (Security Misconfiguration) e riscos relacionados a Information Exposure/API Security.

Mapeie a superfície exposta externamente e procure por:

1. Repositórios
   - Verifique se algum repositório relacionado ao projeto está público.
   - Procure secrets, API keys, tokens, credenciais, arquivos .env ou informações sensíveis no histórico do Git.
   - Verifique se informações removidas recentemente continuam disponíveis no histórico.

2. Infraestrutura e serviços
   - Identifique serviços administrativos ou internos expostos publicamente.
   - Procure por painéis como n8n, Metabase, ferramentas de administração, dashboards, bancos de dados, ferramentas de monitoramento e outros serviços internos.
   - Verifique portas, subdomínios e endpoints que não deveriam estar acessíveis diretamente pela Internet.
   - Avalie se esses serviços estão protegidos por autenticação forte, VPN, allowlist ou controles equivalentes.

3. WAF/CDN
   - Verifique se os serviços públicos passam pelo Cloudflare/WAF quando deveriam.
   - Identifique endpoints ou subdomínios que conseguem acessar o origin diretamente, contornando o WAF.
   - Verifique exposição do IP real do servidor de origem.

4. Information Exposure
   - Procure versões de framework, servidor, runtime ou outros componentes expostas em headers, páginas de erro, endpoints ou arquivos públicos.
   - Procure stack traces, mensagens de erro detalhadas, arquivos de debug, source maps e informações internas.
   - Verifique endpoints como /robots.txt, /sitemap.xml, /.well-known, arquivos de configuração e diretórios potencialmente expostos.

5. Serviços internos
   - Verifique se serviços como n8n, Metabase, Evolution ou equivalentes estão realmente inacessíveis externamente quando deveriam ser internos.
   - Avalie se colocá-los em um domínio separado realmente aumenta a segurança ou apenas dificulta sua descoberta.
   - Priorize controles reais como VPN, autenticação forte, allowlist de IP, firewall e isolamento de rede.

IMPORTANTE:
Não considere "usar um segundo domínio", "usar um subdomínio difícil de descobrir" ou "esconder a versão" como correções de segurança por si só.

Para cada exposição encontrada, informe:
- Severidade: Critical / High / Medium / Low
- O que está exposto
- Como foi identificado
- Qual seria o impacto
- Se o acesso deveria ser público ou privado
- Correção recomendada
- Se a correção deve ocorrer no Cloudflare, servidor, aplicação, rede ou controle de acesso.

Priorize a análise de exposição real e controles de acesso, e não apenas técnicas de obscuridade.
```

## Checklist de validação

- [~] Repositório(s) do projeto (GitHub) têm a visibilidade esperada
      (privado, se for o caso) — confirmar diretamente no GitHub, não só
      supor.
- [x] `app/admin` e `app/api/admin/**` não são alcançáveis sem autenticação
      de admin de verdade — nem em produção (`scriba.cc`) nem em preview
      (`dev.scriba.cc`), que pode ter proteção de deployment diferente.
- [x] Nenhum painel interno de terceiro (n8n, Metabase, banco de dados
      administrado, ferramenta de monitoramento) está acessível
      publicamente — este projeto não parece ter esses serviços hoje, mas
      confirmar contra o que está de fato provisionado (Vercel, Supabase,
      Stripe, e qualquer integração adicional).
- [x] Erros não tratados não vazam stack trace nem detalhe interno em
      produção — Next.js já cobre isso por padrão em produção, mas
      confirmar que nenhuma rota de API captura e devolve `error.stack`
      ou mensagem bruta do banco no corpo da resposta.
- [x] Source maps não são publicados em produção (comportamento padrão do
      Next.js/Vercel — confirmar que nada no build override isso).
- [x] IP real de origem (se relevante) não é acessível diretamente
      contornando qualquer WAF/CDN na frente — na Vercel isso normalmente
      não se aplica (não há "origin" exposto), mas vale confirmar se há
      algum domínio alternativo/preview vazando acesso direto.

## Áreas do repositório a inspecionar

- Configuração de deployment protection na Vercel (fora do código, mas
  relevante — `dev.scriba.cc` é Preview)
- `app/admin/**`, `app/api/admin/**`
- `next.config.ts` (produção não deve expor source maps por padrão)

## Critério de aceite

Nenhum serviço administrativo ou de infraestrutura acessível sem
autenticação forte — e a correção proposta nunca é "mudar o path/domínio",
sempre controle de acesso real.

---

## Rodada 2026-09-05

### 1. Achado — repositório público

| O quê | Como identifiquei | Impacto | Sev. |
|---|---|---|---|
| `github.com/renan-prado/scribe-web` é **PÚBLICO** (`gh repo view` → `"visibility":"PUBLIC","isPrivate":false`) | consulta direta ao GitHub | Todo o código-fonte de um SaaS com cobrança está aberto: o schema, as policies de RLS, os GRANT, a lógica de billing e — até serem corrigidos — os furos desta auditoria. A tarefa 01 já confirmou que não há segredo VIVO no histórico, então não é vazamento de chave; é o CUSTO DE ATAQUE despencando. Um atacante lê a RLS exata e procura a policy que esqueceu um `session_id`, em vez de adivinhar às cegas — foi exatamente assim que os furos 0038/0040 se acham lendo o código | **HIGH** |

**Correção (só o usuário pode):** GitHub → repositório → **Settings → General
→ Danger Zone → Change visibility → Private**. Ou, se o repositório for público
de propósito (open source), registrar essa decisão e tratá-la como premissa —
mas então cada correção de segurança precisa ir para produção ANTES do commit
que a descreve virar público, e o histórico já expõe as anteriores.

> Não mudei a visibilidade — é ação fora do repositório, irreversível na
> prática (o que já foi indexado/clonado não volta), e é decisão do dono.

### 2. O que foi auditado e passou

- **Rotas de admin:** `/admin/*` e `/api/admin/*` respondem `404`/`302→sign-in`
  sem sessão de admin, em `scriba.cc` E em `dev.scriba.cc` (a 02 já provou o 404
  autenticado). `dev.scriba.cc/api/admin/users` sem sessão → 302 para o login,
  ou seja, é a NOSSA auth protegendo, não a ausência de deployment protection.
- **Preview (`dev.scriba.cc`):** responde 302/200 como o app normal — é um
  Preview de domínio fixo, público de propósito (documentado em
  `docs/ambientes.md`), e se protege pela mesma auth + a mesma RLS do Supabase
  de dev. Não expõe nada que a produção não exponha.
- **Painéis internos de terceiro (n8n, Metabase, banco exposto):** não
  existem. A infra é Vercel + Supabase + Stripe, cada um atrás do login do
  próprio fornecedor.
- **Vazamento de erro:** todo `catch` de rota LOGA `(err as Error).message` e
  devolve string genérica (`list_failed`, `update_failed`, `price_misconfigured`,
  …). Nenhuma rota devolve stack trace, erro cru do Postgres ou do Supabase no
  corpo. O que sai como texto de upstream é a mensagem da OpenAI (`result.error.
  message`), não detalhe interno nosso — LOW, aceitável.
- **Source maps:** `next.config.ts` não liga `productionBrowserSourceMaps`, então
  o default vale (sem source map de browser em produção).
- **IP de origem / WAF bypass:** a Vercel não expõe "origin" — não há IP de
  servidor para contornar. Não há Cloudflare no projeto.

### 3. Conclusão

Só uma exposição real, e é de controle de acesso do repositório, não de
obscuridade: tornar o repo privado. Tudo que é serviço administrativo já está
atrás de autenticação de verdade.

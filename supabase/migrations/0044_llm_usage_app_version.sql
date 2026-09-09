-- Carimba em cada chamada de LLM a VERSÃO do app que a fez.
--
-- A tabela já responde "quanto custou" e "onde". O que ela nunca respondeu é
-- "isso mudou DEPOIS do quê?" — a pergunta que aparece toda vez que um prompt
-- é reescrito, um modelo é trocado ou uma etapa é cortada. Sem um marcador, a
-- única régua disponível é a data, e data não sabe quando o deploy subiu.
--
-- O marcador é o `version` do package.json, escrito pelo build
-- (`next.config.ts` → `NEXT_PUBLIC_APP_VERSION` → `lib/app-version.ts`). Ele
-- só vale como corte se subir a cada entrega, e é por isso que esta migração
-- vem junto de `scripts/release.mjs` e da regra no AGENTS.md da raiz: sem o
-- bump, todo evento nasce com o mesmo rótulo e o filtro não separa nada.
--
-- NULO é honesto e permanente: são as chamadas anteriores a esta migração.
-- Não há backfill possível — ninguém sabe qual código as produziu, e chutar a
-- versão de hoje faria a comparação mentir exatamente onde ela é usada. O
-- painel mostra essa fatia como "antes da medição", separada.
--
-- Texto e não semver estruturado: a coluna é um RÓTULO para agrupar, e a
-- ordenação por semver vive em `lib/app-version.ts`, onde dá para testá-la e
-- onde "0.10.0 > 0.9.0" não depende do collation do banco.

alter table public.llm_usage_events
  add column if not exists app_version text;

comment on column public.llm_usage_events.app_version is
  'Versão do package.json que originou a chamada. Null = anterior à migração 0044 (sem backfill possível).';

-- O corte que o painel faz é sempre "esta versão, no tempo": a lista de
-- versões, o intervalo em que cada uma esteve no ar e o custo dentro dela.
create index if not exists llm_usage_events_app_version_idx
  on public.llm_usage_events (app_version, created_at desc);

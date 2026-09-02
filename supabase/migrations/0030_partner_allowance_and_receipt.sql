-- Duas lacunas do programa de parceiros, encontradas ao usar a tela.
--
-- 1) MESADA DE MOEDAS. Um parceiro que não consegue gravar não consegue
--    divulgar: ele precisa do produto na mão para falar dele. A "assinatura de
--    parceiro" é uma mesada mensal de moedas, renovada por check preguiçoso —
--    o mesmo padrão de `/api/billing/summary`, que confere a assinatura vencida
--    quando o usuário aparece, em vez de manter um cron para isso.
--
--    A idempotência REAL continua sendo `coin_transactions.external_ref`
--    (UNIQUE): a mesada de um mês tem ref `partner_allowance:<id>:<AAAA-MM>` e,
--    tentada duas vezes, credita uma. `allowance_month` abaixo é só o portão
--    BARATO — ele evita a ida ao ledger em toda visita, não a duplicata. Se as
--    duas coisas discordarem, quem manda é o ledger.
--
-- 2) COMPROVANTE DO PIX. O pagamento é manual e o comprovante mora hoje no
--    Drive de quem pagou. Guardar a URL na linha do pagamento é o suficiente
--    para o parceiro conferir e para nós respondermos "quando isso foi pago?"
--    sem procurar em conversa. Não é storage e não pretende ser.

-- 1) Mesada -------------------------------------------------------------------

alter table public.partners
  add column if not exists monthly_coins int not null default 0;

alter table public.partners
  drop constraint if exists partners_monthly_coins_range;
alter table public.partners
  add constraint partners_monthly_coins_range
  check (monthly_coins between 0 and 100000);

-- Primeiro dia do mês da última mesada creditada. NULL = nunca recebeu.
alter table public.partners
  add column if not exists allowance_month date;

comment on column public.partners.monthly_coins is
  'Moedas creditadas ao próprio parceiro todo mês. 0 = sem mesada.';
comment on column public.partners.allowance_month is
  'Mês da última mesada creditada. Portão barato; a idempotência real é coin_transactions.external_ref.';

-- 2) Comprovante --------------------------------------------------------------
-- Texto livre com CHECK de formato em vez de coluna sem validação: o campo é
-- preenchido à mão e um "mandei no zap" gravado aqui faz o link virar um botão
-- quebrado no painel do parceiro.

alter table public.partner_payouts
  add column if not exists receipt_url text;

alter table public.partner_payouts
  drop constraint if exists partner_payouts_receipt_url_format;
alter table public.partner_payouts
  add constraint partner_payouts_receipt_url_format
  check (receipt_url is null or receipt_url ~ '^https://[^\s]{3,2000}$');

comment on column public.partner_payouts.receipt_url is
  'Link externo do comprovante (Drive, etc). Só https; não é storage nosso.';

-- Conserta o CHECK de `partner_payouts.receipt_url` criado em 0030.
--
-- A expressão era `^https://[^\s]{3,2000}$`. O Postgres limita a contagem de
-- repetição `{m,n}` a 255, então ela é inválida — mas o CREATE passou sem
-- reclamar: uma expressão de CHECK só é AVALIADA quando alguém grava. O erro
-- apareceu no primeiro pagamento registrado, como
-- `invalid regular expression: invalid repetition count(s)`, e derrubou a rota
-- com 500 depois de o PIX já ter sido enviado à mão — o pior momento possível.
--
-- O comprimento sai do regex e vira `length()`, que não tem esse teto.

alter table public.partner_payouts
  drop constraint if exists partner_payouts_receipt_url_format;

alter table public.partner_payouts
  add constraint partner_payouts_receipt_url_format
  check (
    receipt_url is null
    or (receipt_url ~ '^https://[^\s]+$' and length(receipt_url) <= 2000)
  );

-- Autoteste: a expressão é avaliada AQUI, no push, e não na primeira gravação.
-- É o que faltava em 0030 — sem isso, uma regex inválida volta a passar pelo
-- CREATE e só se manifesta em produção, na mão do operador.
do $$
begin
  if not ('https://drive.google.com/file/d/abc' ~ '^https://[^\s]+$') then
    raise exception 'regex do comprovante rejeitou uma URL válida';
  end if;
  if ('http://inseguro.example' ~ '^https://[^\s]+$') then
    raise exception 'regex do comprovante aceitou http';
  end if;
  if ('https://com espaco' ~ '^https://[^\s]+$') then
    raise exception 'regex do comprovante aceitou espaço';
  end if;
end $$;

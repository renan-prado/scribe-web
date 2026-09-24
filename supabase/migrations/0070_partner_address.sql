-- Endereço do parceiro, e o CPF deixa de ser opcional.
--
-- O parceiro recebe dinheiro nosso por PIX, todo mês. Para pagar pessoa física
-- com regularidade é preciso saber QUEM ela é e ONDE mora: é o que um informe
-- de rendimentos pede, e o que uma retenção na fonte exigiria no dia em que a
-- legislação alcançar os valores. Até aqui `doc` era opcional e endereço não
-- existia, o que deixava cadastros "prontos" sem nenhum dos dois.
--
-- **A obrigatoriedade mora na ROTA, não num NOT NULL.** Há parceiros
-- cadastrados antes desta regra, sem endereço e às vezes sem documento; um
-- NOT NULL aqui ou falharia a migração ou exigiria inventar valores para
-- eles. `PartnerBodySchema` (src/app/api/admin/partners/route.ts) exige CPF
-- e endereço em todo cadastro novo, e o diálogo do admin não salva uma
-- edição de cadastro antigo sem completá-los.
--
-- **jsonb e não sete colunas**, como `socials`: o endereço é lido e escrito
-- sempre inteiro, nunca filtrado por um campo só. O que o banco garante é o
-- FORMATO, pelo CHECK abaixo: quando existe, tem as chaves obrigatórias como
-- texto não vazio, CEP de 8 dígitos e UF de 2 letras maiúsculas. Sem ele um
-- `curl` direto no service-role gravaria um endereço que a tela não consegue
-- mostrar.

alter table public.partners
  add column if not exists address jsonb;

alter table public.partners
  drop constraint if exists partners_address_shape;
alter table public.partners
  add constraint partners_address_shape check (
    address is null or (
      jsonb_typeof(address) = 'object'
      and coalesce(address->>'cep', '') ~ '^[0-9]{8}$'
      and length(trim(coalesce(address->>'street', ''))) > 0
      and length(trim(coalesce(address->>'number', ''))) > 0
      and length(trim(coalesce(address->>'district', ''))) > 0
      and length(trim(coalesce(address->>'city', ''))) > 0
      and coalesce(address->>'state', '') ~ '^[A-Z]{2}$'
    )
  );

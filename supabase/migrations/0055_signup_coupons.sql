-- Cupom de cadastro: "crie sua conta por este link e ganhe X moedas".
--
-- POR QUE ELE EXISTE, e por que não é nenhum dos três programas que já havia.
-- `partners` paga comissão a quem divulga; `referral_rewards` premia um usuário
-- por trazer um amigo; `partner_prospects` dá cortesia a quem se candidatou a
-- divulgador. Os três descrevem uma RELAÇÃO com alguém de fora. O cupom não:
-- ele é o admin escolhendo, nominalmente, quem quer que teste o produto, e
-- emitindo um link com um saldo dentro. Não há padrinho, não há comissão, não
-- há ninguém para creditar do outro lado.
--
-- TODO CUPOM TEM TETO, e `max_redemptions` é NOT NULL por isso.
-- Um link público que credita moedas é uma torneira: o custo de abusá-lo é
-- criar contas Google. O teto do pré-parceiro (0050) é GLOBAL porque lá a porta
-- é uma página só; aqui a porta é emitida uma a uma, então o teto é POR CUPOM,
-- e não existe cupom sem ele. "Sem limite" seria a opção que alguém escolheria
-- num dia corrido e descobriria num extrato. Quem quer convidar mais gente
-- emite outro cupom, o que é barato e deixa rastro de por quê.
--
-- UMA REDENÇÃO POR PESSOA NA VIDA, e é a PK de `signup_coupon_redemptions`.
-- Mesma filosofia de `partner_prospects.user_id` e de
-- `partner_commissions.referred_user_id`: "uma vez por pessoa" é uma
-- CONSTRAINT, não um `if` no servidor. Ninguém empilha dois cupons, nem
-- limpando cookie, nem em duas abas, nem por um caminho de código que ainda não
-- existe. O crédito em si continua passando por `grant_coins`, com
-- `external_ref` derivado do usuário, que é a segunda tranca da mesma porta.
--
-- O QUE ELE NÃO CONFERE, de propósito: se a conta já ganhou bônus de indicação
-- ou de pré-parceiro. `attach_partner_prospect` recusa esse empilhamento porque
-- lá os dois lados são promoções nossas, abertas a quem passar. O cupom é um
-- ato deliberado do admin sobre uma pessoa escolhida: recusá-lo em silêncio
-- porque a pessoa clicou num link de parceiro semana passada faria o convite
-- falhar exatamente onde ele foi mais intencional. O teto por cupom é o que
-- limita o estrago, e ele é sempre finito.

create table if not exists public.signup_coupons (
  -- Minúsculo, `[a-z0-9-]`, 3 a 32. É o que aparece no link (/c/<code>), então
  -- ele é digitável e legível ao telefone: mesmo formato do slug de parceiro,
  -- espelhado em `lib/domain/coupon.ts` e validado lá antes de chegar aqui.
  code            text primary key
    check (code ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
  -- Quantas moedas a conta nova ganha, ALÉM das de boas-vindas.
  coins           int not null check (coins > 0 and coins <= 5000),
  -- Para que serve e para quem. Não é decoração: daqui a dois meses "igreja-x"
  -- não responde se aquele link foi para o pastor ou para o grupo inteiro.
  label           text,
  -- Quantos cadastros ele ainda aceita. Ver o cabeçalho: NOT NULL de propósito.
  max_redemptions int not null check (max_redemptions > 0 and max_redemptions <= 1000),
  -- Opcional: um convite para um evento morre com o evento. Nulo = não expira,
  -- e aí quem fecha a torneira é o teto ou o botão de desativar.
  expires_at      timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);

comment on table public.signup_coupons is
  'Convites emitidos pelo admin: cadastro por /c/<code> credita moedas. Teto por cupom obrigatório, ver 0055.';

-- Uma linha por PESSOA, para sempre. Ver o cabeçalho.
create table if not exists public.signup_coupon_redemptions (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  -- `restrict`, não `cascade`: apagar um cupom já usado apagaria o registro de
  -- quem o usou e quanto custou, e o extrato de moedas ficaria sem explicação.
  -- Cupom usado não se apaga, desativa-se; o DELETE do painel só passa enquanto
  -- ninguém resgatou, e é o banco que garante isso.
  code          text not null references public.signup_coupons(code) on delete restrict,
  coins_granted int not null check (coins_granted >= 0),
  created_at    timestamptz not null default now()
);

comment on table public.signup_coupon_redemptions is
  'Quem resgatou qual cupom. PK por usuário = um cupom por pessoa na vida.';

create index if not exists signup_coupon_redemptions_code_idx
  on public.signup_coupon_redemptions (code, created_at desc);

-- redeem_signup_coupon() ------------------------------------------------------
-- Valida, grava e credita na MESMA transação, devolvendo um código em vez de
-- lançar exceção: quase todo "não" aqui é normal e roda dentro do /auth/callback,
-- onde NADA pode impedir o login de ninguém.
--
--   ok | unknown_code | inactive | expired | exhausted | already_redeemed | not_new
--
-- A JANELA DE CONTA NOVA (30 min) é a mesma de `attach_partner` e de
-- `attach_partner_prospect`, e existe pelo mesmo motivo: o cookie do link vive
-- 30 dias, e sem a janela um usuário de um ano atrás que abrisse um cupom
-- ganharia as moedas no login seguinte. O cupom é para quem CRIA a conta por
-- ele; para dar moedas a quem já existe há o crédito manual do /admin/users.

create or replace function public.redeem_signup_coupon(
  p_user_id uuid,
  p_code    text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_at timestamptz;
  v_coupon     public.signup_coupons%rowtype;
  v_used       int;
begin
  if p_user_id is null or p_code is null then
    return 'unknown_code';
  end if;

  -- Trava a linha do perfil antes de decidir: duas abas terminando o login no
  -- mesmo instante serializam aqui, e a segunda enxerga o que a primeira fez.
  select created_at into v_created_at
    from public.profiles
   where id = p_user_id
   for update;

  if v_created_at is null then
    return 'not_new';  -- perfil ainda não existe
  end if;
  if v_created_at < now() - interval '30 minutes' then
    return 'not_new';
  end if;
  if exists (select 1 from public.signup_coupon_redemptions where user_id = p_user_id) then
    return 'already_redeemed';
  end if;

  -- `for update` na linha do CUPOM: é ela que serializa a contagem abaixo, e é
  -- o que torna o teto exato em vez de aproximado. Diferente do teto global do
  -- pré-parceiro, que aceita furar em uma linha no pior caso, aqui há uma linha
  -- para travar, então não há por que aceitar.
  select * into v_coupon
    from public.signup_coupons
   where code = p_code
   for update;

  if v_coupon.code is null then
    return 'unknown_code';
  end if;
  if not v_coupon.is_active then
    return 'inactive';
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    return 'expired';
  end if;

  select count(*) into v_used
    from public.signup_coupon_redemptions
   where code = v_coupon.code;

  if v_used >= v_coupon.max_redemptions then
    return 'exhausted';
  end if;

  insert into public.signup_coupon_redemptions (user_id, code, coins_granted)
  values (p_user_id, v_coupon.code, v_coupon.coins);

  -- Pela porta única de crédito, como todo o resto do dinheiro. O external_ref
  -- por usuário torna isto idempotente mesmo que este caminho seja percorrido
  -- duas vezes.
  perform public.grant_coins(
    p_user_id,
    v_coupon.coins,
    'signup_coupon',
    'signup-coupon:' || p_user_id::text
  );

  return 'ok';
end;
$$;

-- Permissões ------------------------------------------------------------------
-- Funções nascem com EXECUTE para PUBLIC; revogar é o passo que importa. Mesmo
-- tratamento de `grant_coins`, `attach_partner` e `attach_partner_prospect`: só
-- o service_role chama, e ele vive exclusivamente no servidor. Sem isto,
-- qualquer visitante com o anon key chamaria a função e emitiria moedas para si
-- mesmo, bastando ter o código de um cupom.

revoke all on function public.redeem_signup_coupon(uuid, text) from public;
revoke all on function public.redeem_signup_coupon(uuid, text) from anon, authenticated;
grant execute on function public.redeem_signup_coupon(uuid, text) to service_role;

-- RLS -------------------------------------------------------------------------
-- Nenhuma das duas tabelas é alcançável pelo anon key. A lista de cupons diz
-- quanto cada convite vale e quanto ainda resta nele: com ela na mão, um
-- visitante testaria códigos até achar o mais generoso. Quem responde "este
-- cupom vale quanto?" para a tela de entrada é o nosso servidor, com
-- service_role, e só para o código que a pessoa JÁ tem no cookie.
-- RLS ligada e nenhuma policy é a forma mais forte de dizer isso.

alter table public.signup_coupons enable row level security;
alter table public.signup_coupon_redemptions enable row level security;

revoke all on public.signup_coupons from anon, authenticated;
revoke all on public.signup_coupon_redemptions from anon, authenticated;

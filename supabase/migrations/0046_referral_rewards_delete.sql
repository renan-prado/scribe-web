-- Corrige uma armadilha da 0045 descoberta ao apagar uma conta de teste:
-- **excluir o usuário que INDICOU falhava**, com um "Database error deleting
-- user" que não dizia por quê.
--
-- A causa é a combinação de duas linhas da 0045 que, isoladas, parecem
-- corretas:
--
--   beneficiary_user_id uuid references auth.users(id) on delete set null
--   constraint referral_rewards_has_beneficiary check (
--     (beneficiary_user_id is not null) <> (beneficiary_partner_id is not null)
--   )
--
-- O `set null` do delete tenta produzir exatamente a linha que o CHECK
-- proíbe — nenhum beneficiário —, então o DELETE em `auth.users` é abortado
-- pelo banco. Uma exclusão de conta que trava é o pior desfecho possível:
-- ninguém liga o erro à tabela de recompensas, e a exclusão de conta é
-- requisito da App Store (docs/app-store-ios.md).
--
-- A correção é CASCADE, e não afrouxar o CHECK. Uma linha sem beneficiário
-- não significaria nada: ela existe para dizer "fulano ganhou X moedas por
-- ter trazido sicrano". Sumindo o fulano, some com ela — como já acontece com
-- `partner_commissions.referred_user_id`, que é cascade desde a 0029, e como
-- acontece com o próprio `coin_transactions` do usuário apagado. O histórico
-- não fica meio apagado: fica coerente.
--
-- `beneficiary_partner_id` já era cascade e não muda.

alter table public.referral_rewards
  drop constraint if exists referral_rewards_beneficiary_user_id_fkey;

alter table public.referral_rewards
  add constraint referral_rewards_beneficiary_user_id_fkey
  foreign key (beneficiary_user_id) references auth.users(id) on delete cascade;

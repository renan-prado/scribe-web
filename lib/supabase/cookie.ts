import { clientEnv } from "@/lib/env/client";

/**
 * O nome do cookie onde o @supabase/ssr guarda a sessão.
 *
 * Por padrão ele NÃO é configurado: o supabase-js monta `sb-<primeiro rótulo
 * do host>-auth-token` a partir da URL do projeto (ver `defaultStorageKey` em
 * @supabase/supabase-js). Com `https://<ref>.supabase.co` isso dá
 * `sb-<ref>-auth-token`, e a coincidência de o primeiro rótulo ser justamente
 * o project ref escondeu, por todo esse tempo, que o nome do cookie estava
 * amarrado à URL.
 *
 * A troca para o domínio customizado (`https://auth.scriba.cc`) desfaz a
 * coincidência: o padrão viraria `sb-auth-auth-token`, um nome diferente do
 * que está no navegador de quem já entrou. Nenhum erro apareceria, o cookie
 * antigo simplesmente deixaria de ser procurado, e TODA sessão ativa cairia no
 * deploy. Por isso o nome é fixado aqui, no project ref, que é o que ele
 * sempre quis dizer: a partir daí a URL pode mudar de novo (outro subdomínio,
 * voltar para o supabase.co) sem derrubar ninguém.
 *
 * O fallback para o host preserva exatamente o comportamento padrão enquanto
 * `NEXT_PUBLIC_SUPABASE_PROJECT_REF` não estiver definida, é o caso do
 * ambiente de dev, que continua no `<ref>.supabase.co`.
 *
 * Este módulo é client-safe de propósito: o nome tem que ser o MESMO no
 * navegador (lib/supabase/client.ts), no servidor (lib/supabase/server.ts) e
 * no proxy (proxy.ts). Três lugares lendo daqui é o que garante isso.
 */
const projectRef =
  clientEnv.NEXT_PUBLIC_SUPABASE_PROJECT_REF ??
  new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

export const SUPABASE_AUTH_COOKIE = `sb-${projectRef}-auth-token`;

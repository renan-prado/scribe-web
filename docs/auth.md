# Entrar no Scriba: Google, e-mail e senha

Duas portas para a mesma conta. Este guia é sobre a segunda, que chegou depois,
e sobre as três chaves do painel do Supabase sem as quais ela não funciona.

> O código mora em `src/features/auth/` (actions, componentes e os dois módulos
> de servidor) e em `src/app/(entrar)/`. Cada arquivo explica a própria decisão;
> aqui está o que NÃO cabe em cabeçalho nenhum, porque não é código: a
> configuração do projeto no Supabase.

## 1. O que existe

| Caminho | O que é |
|---|---|
| `/sign-in` | A entrada. Botão do Google em cima, e abaixo do "ou" o formulário de e-mail e senha, que começa FECHADO atrás de um botão |
| `/recuperar` | "Esqueci minha senha". Pública, porque quem chega nela é quem não consegue entrar |
| `/nova-senha` | Define a senha nova. PROTEGIDA: a sessão criada pelo link do e-mail é a credencial, então não há token na URL |
| `/auth/callback` | Troca o `?code=` do PKCE por sessão. Google, e os e-mails com os modelos de fábrica |
| `/auth/confirm` | Troca o `?token_hash=` por sessão. Os e-mails com os modelos da seção 4 |

As quatro operações de senha são server actions em
`src/features/auth/actions.ts`: entrar, criar conta, pedir recuperação e definir
a senha nova (mais o reenvio da confirmação). O cabeçalho daquele arquivo
explica por que são actions e não rotas de API.

## 2. Ligar o provedor (obrigatório)

**Authentication → Sign In / Providers → Email**, nos DOIS projetos (dev e
prod, ver `docs/ambientes.md`):

- **Enable Email provider**: ligado. Sem isso, o `signUp` volta com
  `email_provider_disabled` e a tela diz apenas "não consegui criar a conta
  agora", que é a mensagem genérica de último recurso.
- **Minimum password length**: 8, o mesmo valor de `MIN_PASSWORD_LENGTH` em
  `src/features/auth/lib/password.ts`. Os dois lados precisam concordar: o
  formulário avisa antes de mandar, o servidor de auth é quem recusa de fato, e
  números diferentes fazem um campo aceitar na tela e falhar depois.
- **Confirm email**: decisão de produto, e os dois caminhos estão cobertos no
  código.
  - **Ligado** (o padrão): a conta só nasce quando a pessoa clica no link. A
    tela troca o formulário pelo aviso "confira seu e-mail", e quem tenta
    entrar antes disso recebe o botão de reenviar.
  - **Desligado**: a sessão sai na hora, e é a própria action que credita
    indicação, pré-parceiro e cupom, porque ninguém passa pelo `/auth/callback`.
    Mais simples para quem chega, e abre a porta para cadastro com o e-mail de
    outra pessoa.

## 3. As URLs de retorno (obrigatório)

**Authentication → URL Configuration**, em cada projeto:

- **Site URL**: `https://scriba.cc` no projeto de produção,
  `https://dev.scriba.cc` no de desenvolvimento. É o `{{ .SiteURL }}` dos
  modelos de e-mail da seção seguinte.
- **Redirect URLs**: precisam cobrir as duas rotas em cada domínio de onde
  alguém possa iniciar o fluxo.

```
https://scriba.cc/auth/callback
https://scriba.cc/auth/confirm
https://dev.scriba.cc/auth/callback
https://dev.scriba.cc/auth/confirm
http://localhost:3000/auth/callback
http://localhost:3000/auth/confirm
https://scribe-*-renanprados-projects.vercel.app/auth/**
```

O último é o padrão dos previews da Vercel, e é o MESMO conjunto de hosts que
`src/features/auth/server/origin.ts` reconhece. Os dois lugares andam juntos:
um host que o Supabase aceita e o nosso código não reconhece cai no `APP_URL`,
e o e-mail sai apontando para o domínio errado.

## 4. Os modelos de e-mail (recomendado, e a razão é boa)

**Authentication → Emails → Templates.**

Os modelos de fábrica usam `{{ .ConfirmationURL }}`, que passa pelo
`/auth/v1/verify` do Supabase e desemboca no nosso `/auth/callback` com um
`?code=`. Funciona, com uma condição escondida: **o `code` do PKCE só é
trocável por sessão no MESMO navegador que começou o fluxo**, porque o
verificador ficou num cookie de lá.

É exatamente o caso de quem pede a recuperação no computador e abre o e-mail no
celular. O `token_hash` não depende de cookie nenhum, e por isso os modelos
abaixo apontam para o `/auth/confirm`. Troque os dois:

**Confirm signup**

```html
<h2>Confirme seu e-mail</h2>
<p>Falta um toque para sua conta no Scriba ficar pronta:</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/home">
    Confirmar meu e-mail
  </a>
</p>
```

**Reset password**

```html
<h2>Criar uma nova senha</h2>
<p>Recebemos um pedido para trocar a senha da sua conta no Scriba:</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nova-senha">
    Criar nova senha
  </a>
</p>
<p>Se não foi você, é só ignorar este e-mail.</p>
```

Enquanto os modelos forem os de fábrica, tudo continua funcionando pelo
`/auth/callback`, no mesmo aparelho. As duas rotas ficam de pé de propósito: a
decisão de trocar os modelos é do painel, não deste repositório.

> **O SMTP de fábrica do Supabase manda poucos e-mails por hora** e é só para
> desenvolvimento. Antes de abrir o cadastro por e-mail em produção, configure
> um SMTP próprio em Authentication → Emails → SMTP Settings, senão a fila de
> confirmações trava em silêncio num domingo de manhã.

## 5. Uma conta, duas portas

O Supabase liga as identidades pelo e-mail CONFIRMADO. Na prática:

- Quem criou a conta pelo Google e quer uma senha usa `/recuperar`. A conta é a
  mesma, não nasce uma segunda, e depois disso as duas portas levam ao mesmo
  lugar.
- Quem tenta entrar com senha numa conta que só tem Google recebe
  `invalid_credentials`, e a tela diz isso com todas as letras: "se sua conta é
  do Google, entre por ele".
- O perfil nasce igual nos dois caminhos, pelo trigger `handle_new_auth_user`
  (migração 0005). No cadastro por e-mail o `display_name` vem do campo "Seu
  nome" do formulário; sem ele a pessoa seria chamada pelo pedaço do e-mail
  antes do arroba, que é o último recurso daquela função.
- **O brinde de boas-vindas não depende da porta.** Indicação, pré-parceiro e
  cupom são creditados por `applyWelcomeBonuses`, chamada nos três lugares onde
  uma conta pode nascer: `/auth/callback`, `/auth/confirm` e a própria action de
  cadastro. Chamar duas vezes é seguro, as RPCs recusam a segunda.

## 6. O que o formulário NÃO conta

Duas recusas são deliberadamente silenciosas, e mexer nisso é desfazer a
proteção:

- **`/recuperar` responde "enviado" para qualquer endereço**, exista conta ou
  não. Um formulário que responde "não encontrei esse e-mail" é uma lista de
  quem usa o produto, de graça, para quem quiser montá-la.
- **O cadastro com um e-mail já existente devolve o mesmo "confira seu
  e-mail"** do caminho feliz, quando a confirmação está ligada. Quem é dono do
  endereço recebe um aviso da tentativa; quem está sondando não aprende nada. É
  o comportamento que o próprio Supabase escolheu ao devolver um usuário com
  `identities` vazia em vez de um erro.

Os baldes de cadência estão nas actions: por IP e por e-mail no login (o
segundo é o que corta credential stuffing distribuído), por IP no cadastro, e
três pedidos por hora por endereço na recuperação.

# Entrar no Scriba: Google, e-mail e senha

Duas portas para a mesma conta. Este guia é sobre a segunda, que chegou depois,
e sobre as três chaves do painel do Supabase sem as quais ela não funciona.

> O código mora em `src/features/auth/` (actions, componentes e os dois módulos
> de servidor) e em `src/app/(entry)/`. Cada arquivo explica a própria decisão;
> aqui está o que NÃO cabe em cabeçalho nenhum, porque não é código: a
> configuração do projeto no Supabase.

## 1. O que existe

| Caminho | O que é |
|---|---|
| `/sign-in` | A entrada. Botão do Google em cima, e abaixo do "ou" o formulário de e-mail e senha, que começa FECHADO atrás de um botão |
| `/forgot-password` | "Esqueci minha senha". Pública, porque quem chega nela é quem não consegue entrar |
| `/new-password` | Define a senha nova. PROTEGIDA: a sessão criada pelo link do e-mail é a credencial, então não há token na URL |
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

## 4. Os modelos de e-mail

**Authentication → Emails → Templates.**

**Os quatro modelos estão prontos em `supabase/email-templates/`**, um arquivo
por fluxo. O painel do Supabase não lê o repositório: cole o conteúdo INTEIRO
de cada arquivo no campo "Message body" do modelo correspondente, nos DOIS
projetos (dev e prod).

| Arquivo | Modelo no painel | Assunto sugerido |
|---|---|---|
| `confirm-signup.html` | Confirm signup | Confirme seu e-mail e comece a usar o Scriba |
| `reset-password.html` | Reset password | Criar uma nova senha no Scriba |
| `magic-link.html` | Magic Link | Seu link de entrada no Scriba |
| `change-email.html` | Change Email Address | Confirme seu novo e-mail no Scriba |

### Por que eles não usam `{{ .ConfirmationURL }}`

Os modelos de fábrica usam `{{ .ConfirmationURL }}`, que passa pelo
`/auth/v1/verify` do Supabase e desemboca no nosso `/auth/callback` com um
`?code=`. Funciona, com uma condição escondida: **o `code` do PKCE só é
trocável por sessão no MESMO navegador que começou o fluxo**, porque o
verificador ficou num cookie de lá.

É exatamente o caso de quem pede a recuperação no computador e abre o e-mail no
celular. O `token_hash` não depende de cookie nenhum, e por isso os quatro
apontam para o `/auth/confirm` com `?token_hash=`, `&type=` e `&next=`.

Enquanto os modelos forem os de fábrica, tudo continua funcionando pelo
`/auth/callback`, no mesmo aparelho. As duas rotas ficam de pé de propósito: a
decisão de trocar os modelos é do painel, não deste repositório.

### Por que eles são feitos de `<table>`

Porque leitor de e-mail não é navegador. O Outlook para Windows renderiza com o
motor do **Word**, que ignora flex, grid, `max-width` em `<div>`, boa parte de
um `<style>` no `<head>` e `padding` dentro de um `<a>`. Daí as três regras que
todo modelo daqui segue, e que quebram se alguém "modernizar" o HTML:

- **Tabela com `width`/`cellpadding`/`cellspacing`/`border`**, e CSS **inline**
  em cada elemento. Nada de classe.
- **O botão é uma CÉLULA colorida** (`bgcolor` no `<td>`, que o Word entende)
  com um `<a>` `display:block` dentro. O respiro mora no `<td>`.
- **O link em texto puro embaixo do botão não é enfeite.** Cliente que bloqueia
  ou transforma o botão em imagem deixaria a pessoa sem saída.

A marca é `{{ .SiteURL }}/brand/icon-192.png`, servida a 192px e desenhada a 48:
o dobro do dobro, para não borrar em tela de alta densidade. Imagem bloqueada é
o padrão de muita caixa de entrada, então o `alt` é "Scriba" e o cabeçalho
continua legível sem ela.

### As variáveis, e o que cada uma vale

| Variável | O que é |
|---|---|
| `{{ .SiteURL }}` | O domínio configurado na seção 3. É o que faz o mesmo modelo servir dev e prod |
| `{{ .TokenHash }}` | O token do link, trocado por sessão em `/auth/confirm` |
| `{{ .Email }}` | O endereço de destino. Aparece no rodapé de segurança dos quatro |
| `{{ .NewEmail }}` | Só no Change Email: o endereço PEDIDO. Ver abaixo |

**O Change Email é o único que mostra dois endereços, e isso é o ponto.** Com
"Secure email change" ligado (o padrão), o Supabase manda o mesmo corpo para o
endereço antigo e para o novo, e a troca só acontece quando os dois confirmam.
Quem recebe no endereço antigo precisa enxergar para onde a conta está indo,
senão a confirmação é um clique às cegas, e é justamente essa a confirmação que
existe para barrar um sequestro de conta.

## 5. O remetente e a entrega (obrigatório antes de abrir em produção)

**O SMTP de fábrica do Supabase manda poucos e-mails por hora**, é só para
desenvolvimento, e a fila trava em silêncio num domingo de manhã. Três passos,
e nenhum deles mora neste repositório:

1. **Provedor de SMTP próprio** (Resend, SendGrid, SES), em
   **Authentication → Emails → SMTP Settings**. Host, porta, usuário e senha do
   provedor.
2. **Remetente padronizado**, no mesmo lugar: `Scriba` como *Sender name* e
   `nao-responda@scriba.cc` como *Sender email*. O rodapé dos quatro modelos já
   diz "não responda", então o endereço não precisa de caixa de entrada, mas
   precisa existir no domínio que assina o e-mail.
3. **Autenticação do domínio**, no DNS de `scriba.cc`, com os valores que o
   provedor gera:
   - **SPF**: um `TXT` em `@` autorizando o provedor
     (`v=spf1 include:<provedor> ~all`). Se já houver um SPF, ACRESCENTE o
     `include` ao registro existente: dois `TXT` de SPF no mesmo nome invalidam
     os dois.
   - **DKIM**: os `CNAME`/`TXT` que o provedor entrega, um por seletor.
   - **DMARC**: um `TXT` em `_dmarc` (`v=DMARC1; p=none; rua=mailto:...` para
     começar observando, e só depois `p=quarantine`).

Sem SPF e DKIM alinhados ao domínio do remetente, o Gmail e o Outlook mandam a
confirmação de cadastro para o lixo eletrônico, e o sintoma no produto é uma
tela de "confira seu e-mail" que nunca termina.

## 6. Uma conta, duas portas

O Supabase liga as identidades pelo e-mail CONFIRMADO. Na prática:

- Quem criou a conta pelo Google e quer uma senha usa `/forgot-password`. A conta é a
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

## 7. O que o formulário NÃO conta

Duas recusas são deliberadamente silenciosas, e mexer nisso é desfazer a
proteção:

- **`/forgot-password` responde "enviado" para qualquer endereço**, exista conta ou
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

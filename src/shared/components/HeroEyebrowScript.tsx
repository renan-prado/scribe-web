import { REF_HINT_COOKIE } from "@/features/referrals/cookies";

/**
 * Decide ANTES DO PRIMEIRO PAINT se a pílula do hero vai falar de indicação.
 *
 * Existe pelo mesmo motivo que o bootstrap de tema que havia no `<head>` até
 * o produto ter um tema só: o estado depende de algo
 * que só o navegador sabe (lá o localStorage, aqui um cookie), e descobrir
 * isso depois da hidratação produz um salto visível na cara de quem chegou:
 * o `<h1>` pintado no lugar certo e, um instante depois, empurrado para baixo
 * por uma pílula que entrou. Logo acima do título, esse salto é exatamente o
 * tipo de detalhe que faz a página parecer improvisada.
 *
 * O script marca `data-scriba-ref` no `<html>` e o CSS (`app/globals.css`,
 * `.lp-eyebrow-pending`) decide se a pílula aparece. Quem tem indicação vê o
 * esqueleto desde o primeiro quadro; quem não tem, a esmagadora maioria, não
 * vê pílula nenhuma, sem esqueleto e sem requisição. **É por isso que a
 * decisão não pode ser um `useState` inicializado no efeito:** o React só
 * roda depois do paint, e aí o dano já está feito.
 *
 * Ele lê a PISTA (`scriba_ref_hint`), nunca o cookie de atribuição, aquele é
 * `httpOnly` e continua sendo a única fonte de "quem indicou". A pista diz
 * apenas que existe indicação a resolver.
 *
 * Sem JavaScript nada disso roda, nenhum atributo é escrito, e a pílula fica
 * escondida. É o desfecho certo: o selo é enfeite de conversão, e a landing
 * page precisa funcionar sem ele.
 *
 * **Ele mora no `<head>` do root layout, e NÃO na página do hero, que é onde
 * ficava.** A razão é do React, não de organização: `<script>` dentro de um
 * componente só existe de verdade quando o HTML vem do SERVIDOR. Quando o
 * React cria o elemento no cliente, ele o troca por uma `<div>` vazia e avisa
 * no console ("Scripts inside React components are never executed when
 * rendering on the client"). E era exatamente o que acontecia: a LP é estática
 * e alcançável por navegação de cliente (o "← Voltar" da tela de entrada leva
 * a ela), e nesse caminho o script não rodava, a pílula não aparecia para quem
 * tinha indicação, e sobrava uma `<div>` no meio do hero.
 *
 * O root layout é o único lugar imune: ele é renderizado no servidor em todo
 * carregamento duro e NUNCA é remontado numa navegação de cliente, então o
 * script sempre nasce do HTML. O preço é ele rodar em toda página em vez de
 * numa só, e é uma leitura de `document.cookie` com um `setAttribute`: menos
 * do que custava ter um mecanismo que falhava em silêncio na metade das
 * entradas.
 */
const SCRIPT = `(function(){try{if(document.cookie.indexOf("${REF_HINT_COOKIE}=")!==-1){document.documentElement.setAttribute("data-scriba-ref","1");}}catch(e){}})();`;

export function HeroEyebrowScript() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: static, self-authored bootstrap script
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

import { REF_HINT_COOKIE } from "@/lib/referrals/cookies";

/**
 * Decide ANTES DO PRIMEIRO PAINT se a pílula do hero vai falar de indicação.
 *
 * Irmão do `ThemeScript`, e existe pelo mesmo motivo: o estado depende de algo
 * que só o navegador sabe (lá o localStorage, aqui um cookie), e descobrir
 * isso depois da hidratação produz uma troca visível na cara de quem chegou,
 * "Ouça, relembre e coloque em prática." aparecendo por um instante e virando
 * "Indicado por Fulano". Numa pílula de 30px acima do `<h1>`, esse pisca é
 * exatamente o tipo de detalhe que faz a página parecer improvisada.
 *
 * O script marca `data-scriba-ref` no `<html>` e o CSS (`app/globals.css`,
 * `.lp-eyebrow-*`) decide qual dos dois filhos da pílula aparece. Quem tem
 * indicação vê o esqueleto desde o primeiro quadro; quem não tem, a
 * esmagadora maioria, vê a frase de sempre, sem esqueleto nenhum e sem
 * requisição nenhuma. **É por isso que a decisão não pode ser um `useState`
 * inicializado no efeito:** o React só roda depois do paint, e aí o dano já
 * está feito.
 *
 * Ele lê a PISTA (`scriba_ref_hint`), nunca o cookie de atribuição, aquele é
 * `httpOnly` e continua sendo a única fonte de "quem indicou". A pista diz
 * apenas que existe indicação a resolver.
 *
 * Sem JavaScript nada disso roda, nenhum atributo é escrito, e a pílula mostra
 * a frase padrão. É o desfecho certo: o selo é enfeite de conversão, e a
 * landing page precisa funcionar sem ele.
 *
 * Mora numa rota só (o hero da LP), e não no layout, porque é lá que a pílula
 * existe. Um script global rodando em toda página do app para governar um
 * elemento de uma página é custo sem contrapartida.
 */
const SCRIPT = `(function(){try{if(document.cookie.indexOf("${REF_HINT_COOKIE}=")!==-1){document.documentElement.setAttribute("data-scriba-ref","1");}}catch(e){}})();`;

export function HeroEyebrowScript() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: static, self-authored bootstrap script
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

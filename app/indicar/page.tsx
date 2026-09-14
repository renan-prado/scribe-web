import { permanentRedirect } from "next/navigation";

/** Rota LEGADA: a página de indicação mora em `/v2/indicar`. */
export default function IndicarRedirect() {
  permanentRedirect("/v2/indicar");
}

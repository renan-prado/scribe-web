"use client";

import { useEffect } from "react";
import { THEME_COLOR } from "@/shared/theme-color";

/**
 * A cor da barra de status do celular DENTRO do app.
 *
 * O `ThemeScript` escreve a `<meta name="theme-color">` do site a partir do
 * tema salvo, e faz isso no `<head>`, antes de existir corpo de documento —
 * ou seja, sem como saber em que rota a pessoa está. Este componente é a
 * segunda palavra sobre a mesma meta, dita já dentro da moldura do app, onde
 * a resposta é fixa: o grafite, o tema escolhido que seja.
 *
 * **São dois mecanismos porque são dois momentos.** O `<script>` inline roda
 * durante o parse do HTML, antes do primeiro paint, e cobre o caso que mais
 * importa: o app instalado abrindo do zero na tela inicial — sem ele, quem
 * está no tema claro veria a barra piscar BRANCA a cada abertura, até a
 * hidratação. O `useEffect` cobre o outro caminho, a navegação de cliente
 * vindo do site, em que o React insere o `<script>` no DOM sem executá-lo.
 *
 * Ao sair do app (a landing, as páginas legais) a cor volta para a do tema,
 * lida do `<html>`, que é onde o `ThemeScript` e o `useTheme` a deixaram.
 *
 * O irmão disto é a barra de NAVEGAÇÃO do Android, embaixo, que não se pinta
 * por meta nenhuma: o Chrome tira a cor dela do fundo do documento. Quem
 * responde por ela é a regra `:has([data-v2-shell])` do `globals.css`.
 */
const SCRIPT = `(function(){try{var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m);}m.setAttribute("content","${THEME_COLOR.app}");}catch(e){}})();`;

function write(color: string) {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = color;
}

export function AppThemeColor() {
  useEffect(() => {
    write(THEME_COLOR.app);
    return () => {
      write(
        document.documentElement.classList.contains("dark") ? THEME_COLOR.dark : THEME_COLOR.light
      );
    };
  }, []);

  // biome-ignore lint/security/noDangerouslySetInnerHtml: static, self-authored bootstrap script
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

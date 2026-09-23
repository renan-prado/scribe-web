"use client";

import { useCallback, useEffect, useState } from "react";
import { THEME_COLOR_BY_THEME } from "@/shared/theme-color";

export type Theme = "light" | "dark";

/** A mesma chave que o `ThemeScript` lê antes do primeiro paint. */
export const THEME_STORAGE_KEY = "scriba-theme";

/**
 * Toda troca dispara este evento, e é ele que mantém em sincronia os DOIS
 * controles que hoje existem na tela (o do `/profile` e o do estado vazio da
 * Biblioteca) mais o `ThemedToaster`, que vive num portal fora da árvore.
 * Sem ele, virar o tema num lugar deixava o outro desenhando o estado antigo
 * até a próxima navegação.
 */
const CHANGE_EVENT = "scriba-theme-change";

/**
 * A fonte da verdade é o DOM, não o React.
 *
 * Quem aplica o tema antes do primeiro paint é um script inline, então no
 * primeiro render do cliente o estado já está na classe do `<html>` e em lugar
 * nenhum mais. Ler dali é o que evita o componente nascer com um padrão que já
 * está errado.
 */
function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

/**
 * A barra de status do celular no PWA instalado (e a barra de endereço do
 * Chrome no Android) segue esta meta. Sem esta linha o tema virava e a barra
 * ficava com a cor do tema anterior até o próximo carregamento, que é
 * justamente o que mais salta aos olhos num app instalado.
 *
 * A `<meta>` já existe no HTML servido (`viewport.themeColor` do root layout),
 * então aqui é só reescrever o `content`. O `createElement` é o seguro para o
 * caso de alguém tirar aquela declaração de lá.
 *
 * **Agora ela vale em TODA rota**, e é por isso que não há mais um valor "do
 * app" separado: o tema deixou de parar na porta da área logada, então a barra
 * acompanha a tela em que a pessoa está, seja ela a landing ou a Biblioteca.
 */
function applyThemeColorMeta(theme: Theme) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLOR_BY_THEME[theme];
}

/**
 * Escreve o tema no `<html>`: a classe, o `data-theme` e a cor da barra.
 *
 * As DUAS classes são escritas, e nunca só uma. `dark` é o que faz o
 * `@custom-variant dark` do Tailwind valer (e com ele os `dark:` que as
 * primitivas do shadcn já trazem); `light` é o seletor do bloco de paleta em
 * `globals.css`. Um `<html>` sem nenhuma das duas cairia no `:root`, que é o
 * escuro, com os `dark:` desligados — metade de cada tema.
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.setAttribute("data-theme", theme);
  applyThemeColorMeta(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // aba anônima / armazenamento desligado: a classe aplicada ainda vale
    // nesta sessão, só não sobrevive ao próximo carregamento.
  }
  window.dispatchEvent(new CustomEvent<Theme>(CHANGE_EVENT, { detail: theme }));
}

/**
 * Lê e escreve o tema do produto.
 *
 * `mounted` é `false` no servidor e no primeiro render do cliente: use-o para
 * suprimir transições, senão o controle ANIMA do padrão do servidor até o
 * estado real em vez de já nascer nele.
 */
export function useTheme() {
  // O padrão do produto, o mesmo do `ThemeScript` e do `<html class="dark">`.
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(readTheme());
    setMounted(true);

    const onChange = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      setThemeState(next === "light" ? "light" : "dark");
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  // Lê o DOM em vez do `current` de um updater: um updater de estado tem de ser
  // puro, e `applyTheme` dispara um evento que rerenderiza os outros inscritos
  // (o Toaster, o segundo toggle) de forma síncrona.
  const toggleTheme = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    setThemeState(next);
  }, []);

  return { theme, setTheme, toggleTheme, mounted, isDark: theme === "dark" };
}

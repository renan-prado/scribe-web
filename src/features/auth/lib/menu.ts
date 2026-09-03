/**
 * Classe dos itens do menu do avatar.
 *
 * Mora num módulo simples — nem `"use client"`, nem server component — porque
 * os DOIS lados a usam: o `UserMenu` (cliente) e o `PrivilegedMenuItems`
 * (servidor). Ler uma constante de um arquivo `"use client"` a partir de um
 * server component não devolve a string: o compilador do Next transforma todo
 * export daquele módulo em referência de cliente. Por isso ela não pode voltar
 * para dentro do UserMenu.
 */
export const MENU_ITEM_CLASS =
  "rounded-xl px-3 py-2.5 text-[13px] font-medium text-scriba-ink-strong focus:bg-scriba-surface";

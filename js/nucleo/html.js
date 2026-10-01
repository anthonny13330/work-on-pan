// Modelos de HTML com lit-html: tudo o que se interpola é escapado
// automaticamente, por isso não há risco de injetar HTML por esquecimento.
export { html, svg, render, nothing } from "/vendor/lit-html/lit-html.js";
export { repeat } from "/vendor/lit-html/directives/repeat.js";
export { classMap } from "/vendor/lit-html/directives/class-map.js";
export { live } from "/vendor/lit-html/directives/live.js";

import { render as renderLit } from "/vendor/lit-html/lit-html.js";

/** Como render(), mas da primeira vez apaga o conteúdo estático que lá estava (ex.: esqueletos). */
export function pintar(conteudo, alvo) {
  if (!alvo._$litPart$) alvo.replaceChildren();
  renderLit(conteudo, alvo);
}

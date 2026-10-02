// Cursor-panela, só em zonas especiais (elementos com data-cursor-panela).
// Vista de cima: a ponta do cabo é o ponto exato do clique. Sobre um botão
// levanta e mostra o vapor; ao clicar encosta, ressalta e solta uma onda fina.
// Não aparece em ecrãs táteis, na TV (sem rato) nem com «reduzir movimento».
import { desenhoMarca } from "./wop-logo.js";

const podeUsar =
  matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches;

const TEXTO = "input, textarea, select, [contenteditable], p a, li a";
const PEGAVEL = "a, button, summary, label, [role='button']";

function iniciar() {
  const zonas = document.querySelectorAll("[data-cursor-panela]");
  if (!zonas.length) return;

  const cursor = document.createElement("div");
  cursor.className = "cursor-panela";
  cursor.setAttribute("aria-hidden", "true");
  // Silhueta da panela: serve de sombra (deslocada) e de contorno marfim, para se ver em qualquer fundo.
  const silhueta = (cor, largura) => `
    <path d="M13 13L25 25" stroke="${cor}" stroke-width="${6.4 + largura}" stroke-linecap="round"/>
    <path d="M4 4L22 9.6L15.2 12.6L12.6 15.2L9.6 22Z" fill="${cor}" stroke="${cor}" stroke-width="${1.6 + largura}" stroke-linejoin="round"/>
    <circle cx="38" cy="38" r="${21 + largura / 2}" fill="${cor}"/>`;
  const marca = desenhoMarca(36).replace(/^\s*<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  cursor.innerHTML = `<div class="cursor-panela-corpo"><svg width="36" height="36" viewBox="-2 -2 70 70" overflow="visible">
    <g class="cursor-sombra">${silhueta("#000", 4)}</g>
    ${silhueta("#f3ece2", 4)}
    ${marca}
  </svg></div>`;
  document.body.append(cursor);
  const corpo = cursor.firstElementChild;

  let dentro = null;
  let x = 0;
  let y = 0;
  let pedido = 0;

  const mover = () => {
    pedido = 0;
    cursor.style.transform = `translate3d(${x - 3}px, ${y - 3}px, 0)`;
  };

  const aoMover = (e) => {
    x = e.clientX;
    y = e.clientY;
    const alvo = e.target instanceof Element ? e.target : null;
    const texto = alvo?.closest(TEXTO);
    cursor.classList.toggle("escondido", !!texto);
    corpo.classList.toggle("pega", !texto && !!alvo?.closest(PEGAVEL));
    if (!pedido) pedido = requestAnimationFrame(mover);
  };

  const aoPremir = (e) => {
    if (cursor.classList.contains("escondido")) return;
    corpo.classList.remove("premir");
    void corpo.offsetWidth; // recomeça a animação a cada clique
    corpo.classList.add("premir");
    const onda = document.createElement("span");
    onda.className = "cursor-onda";
    onda.style.left = `${e.clientX}px`;
    onda.style.top = `${e.clientY}px`;
    onda.addEventListener("animationend", () => onda.remove());
    document.body.append(onda);
  };

  for (const zona of zonas) {
    zona.classList.add("zona-panela");
    zona.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      dentro = zona;
      cursor.classList.add("visivel");
      aoMover(e);
    });
    zona.addEventListener("pointerleave", () => {
      if (dentro !== zona) return;
      dentro = null;
      cursor.classList.remove("visivel");
      corpo.classList.remove("pega");
    });
    zona.addEventListener("pointermove", aoMover, { passive: true });
    zona.addEventListener("pointerdown", aoPremir);
  }
}

if (podeUsar) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
}

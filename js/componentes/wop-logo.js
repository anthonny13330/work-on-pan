// <wop-logo tamanho="30" [nome] [mono]> — a panela vista de cima.
// O cabo aponta como a seta do rato (a ponta é onde se clica) e o vapor
// desenha o W de «work». Abaixo de 24 px usa a versão ótica: menos peças,
// traço mais grosso. O cabo segue a cor do texto (currentColor).

const SETA = "M4 4L22 9.6L15.2 12.6L12.6 15.2L9.6 22Z";
const W = "M29 32.5C30.6 37.4 32 41 33.5 43.5C35 41 36.5 37.8 38 35.5C39.5 37.8 41 41 42.5 43.5C44 41 45.4 37.4 47 32.5";
const W_OTICO = "M30.5 33L34 43L38 36.8L42 43L45.5 33";

export function desenhoMarca(tamanho, { mono = false } = {}) {
  const otico = tamanho <= 24;
  const corpo = mono ? "currentColor" : "var(--cobre, #c8733a)";
  const fundo = mono ? "var(--mono-fundo, transparent)" : "var(--cobre-fundo, #8a4519)";
  const vapor = mono ? "currentColor" : "var(--latao, #d4a94f)";
  return `
    <svg class="marca-desenho" width="${tamanho}" height="${tamanho}" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M13 13L25 25" stroke="currentColor" stroke-width="${otico ? 7.4 : 6.4}" stroke-linecap="round"/>
      <path d="${SETA}" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="38" cy="38" r="21" fill="${corpo}"/>
      <circle cx="38" cy="38" r="${otico ? 14.5 : 15.5}" fill="${fundo}"/>
      <path class="marca-vapor" d="${otico ? W_OTICO : W}" fill="none" stroke="${vapor}" stroke-width="${otico ? 4.4 : 3.4}"
        stroke-linecap="round" stroke-linejoin="round"/>
      ${otico || mono ? "" : `<circle cx="25.7" cy="25.7" r="1.5" fill="${fundo}"/>`}
    </svg>`;
}

// O «o» de «on» repete o gesto: um aro de cobre com o cabo a apontar.
export const NOME_MARCA = `<span class="nome-marca">work&#160;<svg class="o-panela" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.6 5.6L2 2" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><circle cx="11.6" cy="11.6" r="6.9" fill="none" stroke="var(--cobre-texto, var(--acento))" stroke-width="3.2"/></svg>n&#160;<span class="nome-pan">pan</span></span>`;

class WopLogo extends HTMLElement {
  connectedCallback() {
    const t = Number(this.getAttribute("tamanho")) || 30;
    this.innerHTML = desenhoMarca(t, { mono: this.hasAttribute("mono") }) + (this.hasAttribute("nome") ? NOME_MARCA : "");
  }
}

customElements.define("wop-logo", WopLogo);

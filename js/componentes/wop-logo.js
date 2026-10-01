// <wop-logo tamanho="30"> — o «W» em ziguezague: trabalho que avança.
let contador = 0;

class WopLogo extends HTMLElement {
  connectedCallback() {
    const t = Number(this.getAttribute("tamanho")) || 30;
    const id = `wop-g${++contador}`;
    this.innerHTML = `
      <svg width="${t}" height="${t}" viewBox="0 0 32 32" aria-hidden="true">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#0f766e"/>
        </linearGradient></defs>
        <rect width="32" height="32" rx="9" fill="url(#${id})"/>
        <path d="M7.5 11 11.8 22 16 13.5 20.2 22 24.5 11" fill="none" stroke="#fff" stroke-width="2.8"
          stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="24.5" cy="11" r="1.9" fill="#fef3c7"/>
      </svg>`;
  }
}

customElements.define("wop-logo", WopLogo);

// <wop-icone nome="pesquisar"> — ícones literais com um único toque de cozinha a cobre.
// Grelha de 24, traço de 1,75. Nos menus e botões vão sempre com texto ao lado.
// Classes: c = preenchido a cobre, cs = cobre com contorno, cl = linha a cobre.

export const ICONES = {
  pesquisar: '<circle cx="10.5" cy="10.5" r="6.5"/><path class="cl" d="M15.6 15.6L20.4 20.4" stroke-width="3"/>',
  mensagens: '<path d="M4 11A3.5 3.5 0 0 1 7.5 7.5h9A3.5 3.5 0 0 1 20 11v3.5a3.5 3.5 0 0 1-3.5 3.5H11l-4.5 3v-3.1A3.5 3.5 0 0 1 4 14.5z"/><path class="cl" d="M10 5c-.7-.8.7-1.5 0-2.3M14 5c-.7-.8.7-1.5 0-2.3"/>',
  notificacoes: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M12 3v2"/><circle class="c" cx="12" cy="20.6" r="1.6"/>',
  publicar: '<path d="M8.2 8.2L3.6 3.6" stroke-width="2.6"/><circle cx="13.5" cy="13.5" r="7.5"/><path class="cl" d="M13.5 10.2v6.6M10.2 13.5h6.6" stroke-width="2"/>',
  projetos: '<rect x="5" y="5" width="14" height="16" rx="2.5"/><rect class="cs" x="8.5" y="3" width="7" height="4" rx="1.4"/><path d="M8.5 11.5h7M8.5 15h7M8.5 18.5h4"/>',
  propostas: '<path d="M20.5 3.5L3.5 10.2l6.8 3 3 6.8z"/><path d="M20.5 3.5l-10.2 9.7"/><path class="cl" d="M3.6 20.4c1.4-1.6 3-2.3 4.6-2.2"/>',
  orcamento: '<circle cx="12" cy="12" r="8.5"/><path class="cl" d="M15 9.2a3.8 3.8 0 1 0 0 5.6M7.8 11h5.2M7.8 13.1h5.2"/>',
  prazo: '<circle cx="12" cy="13.5" r="7.5"/><path d="M10 2.8h4M12 2.8V6"/><path class="cl" d="M12 13.5l3.2-2.6" stroke-width="2"/><circle class="c" cx="12" cy="13.5" r="1.3"/>',
  perfil: '<circle class="cs" cx="12" cy="8.5" r="3.8"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/>',
  definicoes: '<path d="M4 7h16M4 12h16M4 17h16"/><circle class="cs" cx="9" cy="7" r="2.2"/><circle class="cs" cx="15.5" cy="12" r="2.2"/><circle class="cs" cx="7.5" cy="17" r="2.2"/>',
  aceitar: '<circle cx="12" cy="12" r="8.5"/><path class="ok" d="M8 12.4l2.8 2.8 5.4-5.6" stroke-width="2.2"/>',
  recusar: '<circle cx="12" cy="12" r="8.5"/><path class="cl" d="M9 9l6 6M15 9l-6 6" stroke-width="2"/>',
  guardar: '<path class="cs" d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4-6 4v-16a1 1 0 0 1 1-1z"/>',
  sair: '<path d="M13 4H7.5A2.5 2.5 0 0 0 5 6.5v11A2.5 2.5 0 0 0 7.5 20H13"/><path class="cl" d="M10 12h10M16.5 8.5L20 12l-3.5 3.5"/>',
  "tema-escuro": '<path d="M20 13.4A8 8 0 1 1 10.6 4a6.4 6.4 0 0 0 9.4 9.4z"/><path class="c" d="M17 3.2l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  "tema-claro": '<circle class="cs" cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  menu: '<path d="M4 7h16M4 12h16"/><path class="cl" d="M4 17h10"/>',
  seta: '<path d="M5 12h14M13.5 6.5L19 12l-5.5 5.5"/>',
  escudo: '<path d="M12 3L4.5 6v6c0 4.4 3.2 8.2 7.5 9 4.3-.8 7.5-4.6 7.5-9V6z"/><path class="cl" d="M9 12l2 2 4-4" stroke-width="2"/>',
  idioma: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4 3v-3.2A2.2 2.2 0 0 1 4 14.6z"/><path class="cl" d="M8.5 10.5h7M8.5 13.5h4.5"/>',
  email: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path class="cl" d="M4 7.5l8 5.5 8-5.5"/>',
  cadeado: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><circle class="c" cx="12" cy="15.5" r="1.6"/>',
  olho: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle class="cs" cx="12" cy="12" r="3"/>',
  "olho-fechado": '<path d="M4 9.5c2 2.4 4.8 3.8 8 3.8s6-1.4 8-3.8"/><path class="cl" d="M7 12.4l-1.4 2.4M12 13.3v2.8M17 12.4l1.4 2.4"/>',
  visto: '<path class="cl" d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.2"/>',
  empresa: '<path d="M4 20.5V6.5A1.5 1.5 0 0 1 5.5 5h7A1.5 1.5 0 0 1 14 6.5v14M14 10h4.5A1.5 1.5 0 0 1 20 11.5v9M2.5 20.5h19"/><path class="cl" d="M7.5 9h3M7.5 12.5h3M7.5 16h3"/>',
  inicio: '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path class="cl" d="M10 20.5v-5.5h4v5.5"/>',
  descarregar: '<path class="cl" d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4.5 15.5v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.5"/>',
  lixo: '<path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5"/><path class="cl" d="M10 11v6M14 11v6"/>',
  editar: '<path d="M15.5 4.5l4 4L9 19H5v-4z"/><path class="cl" d="M13 7l4 4"/>',
  telefone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path class="cl" d="M10.5 18.5h3"/>',
  filtro: '<path d="M4 6h16M7 12h10"/><path class="cl" d="M10 18h4"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle class="c" cx="12" cy="7.8" r="1.3"/>',
  pessoas: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle class="cs" cx="17" cy="9.5" r="2.5"/><path class="cl" d="M16 14.2a5 5 0 0 1 5.5 5"/>',
  painel: '<rect x="4" y="4" width="7" height="9" rx="2"/><rect x="13" y="4" width="7" height="5" rx="2"/><rect class="cs" x="13" y="11" width="7" height="9" rx="2"/><rect x="4" y="15" width="7" height="5" rx="2"/>',
  paleta: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.9 0-1.4-1.2-1.8-1.2-3 0-1 .8-1.6 1.8-1.6H17a3.5 3.5 0 0 0 3.5-3.5c0-3.9-3.8-7-8.5-7z"/><circle class="c" cx="7.8" cy="11" r="1.3"/><circle class="c" cx="10.5" cy="7.3" r="1.3"/><circle class="c" cx="15" cy="7.8" r="1.3"/>',
  estrela: '<path class="cs" d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  mais: '<path class="cl" d="M12 5v14M5 12h14" stroke-width="2"/>',
  fechar: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  voltar: '<path d="M19 12H5M10.5 6.5L5 12l5.5 5.5"/>',
  enviar: '<path d="M20.5 3.5L3.5 10.2l6.8 3 3 6.8z"/><path class="cl" d="M20.5 3.5l-10.2 9.7"/>',
  // Áreas de trabalho.
  design: '<path d="M12 3.5l6 7.5-3 8H9l-3-8z"/><path d="M12 3.5v6.3"/><circle class="cs" cx="12" cy="11.8" r="1.9"/><path class="cl" d="M8.5 21.2h7"/>',
  dev: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/><path class="cl" d="M13.6 5l-3.2 14"/>',
  marketing: '<path d="M4 10v4h3.5L15 18.5v-13L7.5 10z"/><path d="M7.5 14l1.2 5.5h2.6L10.2 14"/><path class="cl" d="M18 9.5a3.6 3.6 0 0 1 0 5"/>',
  redacao: '<path d="M15.5 4.5l4 4L9 19H5v-4z"/><path class="cl" d="M13 7l4 4"/><path d="M13 20.5h7"/>',
  video: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path class="c" d="M10 9.2v5.6l4.8-2.8z"/>',
  dados: '<path d="M4 20h16"/><path d="M7 16.5V12M12 16.5V6.5" stroke-width="2.6"/><path class="cl" d="M17 16.5V9.5" stroke-width="2.6"/>',
  outro: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect class="cs" x="13" y="13" width="7" height="7" rx="2"/>',
};

export const desenhoIcone = (nome) =>
  `<svg class="icone" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome] || ICONES.outro}</svg>`;

class WopIcone extends HTMLElement {
  static observedAttributes = ["nome"];
  connectedCallback() {
    this.innerHTML = desenhoIcone(this.getAttribute("nome"));
  }
  attributeChangedCallback() {
    if (this.isConnected) this.connectedCallback();
  }
}

customElements.define("wop-icone", WopIcone);

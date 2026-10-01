// <wop-topo> — cabeçalho com navegação conforme quem está a ver.
import { html, render, nothing } from "../nucleo/html.js";
import { sessao, sessaoPronta, sair, aoMudar, contarPorLer } from "../nucleo/sessao.js";
import { alternarTema } from "../nucleo/ui.js";

const iconeSol = html`<svg class="icone-sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/>
  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

const iconeLua = html`<svg class="icone-lua" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;

class WopTopo extends HTMLElement {
  #aberto = false;
  #porLer = 0;
  #pronto = false;

  connectedCallback() {
    this.desenhar();
    sessaoPronta.then(() => {
      this.#pronto = true;
      this.desenhar();
      if (sessao.user) this.#vigiarMensagens();
    });

    addEventListener("scroll", () => this.classList.toggle("rolado", scrollY > 4), { passive: true });
    // Fecha o menu do telemóvel com Escape ou ao mudar para ecrã largo.
    addEventListener("keydown", (e) => e.key === "Escape" && this.#fecharMenu());
    matchMedia("(min-width: 960px)").addEventListener("change", () => this.#fecharMenu());
  }

  async #vigiarMensagens() {
    const atualizar = async () => {
      this.#porLer = await contarPorLer();
      this.desenhar();
    };
    await atualizar();
    aoMudar(["conversas"], atualizar);
    // A página de mensagens avisa quando marca algo como lido.
    addEventListener("wop:lidas", atualizar);
  }

  #fecharMenu() {
    if (!this.#aberto) return;
    this.#aberto = false;
    this.desenhar();
  }

  #ligacao(caminho, texto, extra = nothing) {
    const atual = location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
    return html`<a href=${caminho} aria-current=${atual === caminho ? "page" : nothing}>${texto}${extra}</a>`;
  }

  #ligacoes() {
    if (!this.#pronto) return nothing;
    const { perfil } = sessao;
    if (!perfil) {
      return html`
        ${this.#ligacao("/projetos", "Projetos abertos")}
        ${this.#ligacao("/entrar", "Entrar")}
        <a class="botao botao-principal botao-pequeno" href="/registar">Criar conta</a>
      `;
    }
    const cliente = perfil.tipo === "cliente";
    const contador = this.#porLer
      ? html`<span class="contador" aria-label="${this.#porLer} por ler">${this.#porLer}</span>`
      : nothing;
    return html`
      ${this.#ligacao("/painel", cliente ? "Os meus projetos" : "As minhas propostas")}
      ${this.#ligacao("/projetos", cliente ? "Projetos publicados" : "Procurar projetos")}
      ${this.#ligacao("/mensagens", "Mensagens", contador)}
      ${this.#ligacao("/conta", "A minha conta")}
      <button type="button" @click=${sair}>Sair</button>
    `;
  }

  desenhar() {
    render(
      html`
        <a class="saltar" href="#conteudo">Saltar para o conteúdo</a>
        <div class="topo-interior">
          <a href=${sessao.perfil ? "/painel" : "/"} class="marca" aria-label="Work on Pan — início">
            <wop-logo tamanho="30"></wop-logo> Work on Pan
          </a>
          <button type="button" class="botao-icone botao-tema" @click=${alternarTema}
            title="Mudar entre tema claro e escuro" aria-label="Mudar entre tema claro e escuro">
            ${iconeSol}${iconeLua}
          </button>
          <button type="button" class="botao-icone botao-menu" aria-controls="menuPrincipal"
            aria-expanded=${this.#aberto} aria-label=${this.#aberto ? "Fechar menu" : "Abrir menu"}
            @click=${() => { this.#aberto = !this.#aberto; this.desenhar(); }}>
            <span class="barras"></span>
          </button>
          <nav id="menuPrincipal" class="menu ${this.#aberto ? "aberto" : ""}" aria-label="Principal">
            ${this.#ligacoes()}
          </nav>
        </div>
      `,
      this
    );
  }
}

customElements.define("wop-topo", WopTopo);

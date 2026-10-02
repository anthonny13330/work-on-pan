// <wop-topo> — cabeçalho em ilha: marca à esquerda, navegação numa pílula ao centro,
// tema e ação principal à direita. Ao rolar, o cabeçalho inteiro vira uma ilha flutuante.
// No telemóvel, o menu abre como um cartão flutuante por baixo.
import { html, render, nothing } from "../nucleo/html.js";
import { sessao, sessaoPronta, sair, aoMudar, contarPorLer } from "../nucleo/sessao.js";
import { alternarTema } from "../nucleo/ui.js";

const icone = (nome) => html`<wop-icone nome=${nome}></wop-icone>`;

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

    // Um marcador invisível no topo da página diz quando já se rolou (sem ouvir cada «scroll»).
    const sentinela = document.createElement("div");
    sentinela.className = "topo-sentinela";
    sentinela.setAttribute("aria-hidden", "true");
    document.body.prepend(sentinela);
    new IntersectionObserver(([e]) => this.classList.toggle("rolado", !e.isIntersecting)).observe(sentinela);

    // Fecha o menu do telemóvel com Escape, ao clicar fora ou ao mudar para ecrã largo.
    addEventListener("keydown", (e) => e.key === "Escape" && this.#fecharMenu());
    addEventListener("click", (e) => this.#aberto && !this.contains(e.target) && this.#fecharMenu());
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

  #ligacao(caminho, texto, nomeIcone, extra = nothing) {
    const atual = location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
    return html`<a href=${caminho} aria-current=${atual === caminho ? "page" : nothing}>${icone(nomeIcone)}<span>${texto}</span>${extra}</a>`;
  }

  #ligacoes() {
    if (!this.#pronto) return nothing;
    const { perfil } = sessao;
    if (!perfil) {
      return html`
        ${this.#ligacao("/", "Início", "inicio")}
        ${this.#ligacao("/projetos", "Projetos abertos", "projetos")}
        <a href="/#como-funciona">${icone("info")}<span>Como funciona</span></a>
        ${this.#ligacao("/entrar", "Entrar", "perfil")}
        <a class="botao botao-principal so-menu-movel" href="/registar">Criar conta grátis</a>
      `;
    }
    const cliente = perfil.tipo === "cliente";
    const contador = this.#porLer
      ? html`<span class="contador" aria-label="${this.#porLer} por ler">${this.#porLer}</span>`
      : nothing;
    return html`
      ${this.#ligacao("/painel", cliente ? "Os meus projetos" : "As minhas propostas", "painel")}
      ${this.#ligacao("/projetos", cliente ? "Projetos" : "Procurar projetos", "pesquisar")}
      ${this.#ligacao("/mensagens", "Mensagens", "mensagens", contador)}
      ${this.#ligacao("/conta", "Conta", "perfil")}
      <button type="button" class="so-menu-movel" @click=${sair}>${icone("sair")}<span>Sair</span></button>
    `;
  }

  #acoes() {
    if (!this.#pronto) return nothing;
    if (!sessao.perfil) {
      return html`<a class="botao botao-escuro-tema botao-pequeno so-largo" href="/registar">Criar conta ${icone("seta")}</a>`;
    }
    return html`<button type="button" class="botao-icone so-largo" @click=${sair} title="Sair da conta" aria-label="Sair da conta">${icone("sair")}</button>`;
  }

  desenhar() {
    render(
      html`
        <a class="saltar" href="#conteudo">Saltar para o conteúdo</a>
        <div class="topo-interior">
          <a href=${sessao.perfil ? "/painel" : "/"} class="marca" aria-label="Work on Pan — início">
            <wop-logo tamanho="34" nome></wop-logo>
          </a>
          <nav id="menuPrincipal" class="menu ${this.#aberto ? "aberto" : ""}" aria-label="Principal">
            ${this.#ligacoes()}
          </nav>
          <div class="topo-acoes">
            <button type="button" class="botao-icone botao-tema" @click=${alternarTema}
              title="Mudar entre tema claro e escuro" aria-label="Mudar entre tema claro e escuro">
              <wop-icone class="icone-sol" nome="tema-claro"></wop-icone><wop-icone class="icone-lua" nome="tema-escuro"></wop-icone>
            </button>
            ${this.#acoes()}
            <button type="button" class="botao-icone botao-menu" aria-controls="menuPrincipal"
              aria-expanded=${this.#aberto} aria-label=${this.#aberto ? "Fechar menu" : "Abrir menu"}
              @click=${() => { this.#aberto = !this.#aberto; this.desenhar(); }}>
              <span class="barras"></span>
            </button>
          </div>
        </div>
      `,
      this
    );
  }
}

customElements.define("wop-topo", WopTopo);

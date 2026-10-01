// <wop-rodape> — rodapé com ligações legais, mais o aviso de cookies.
import { html, render } from "../nucleo/html.js";
import { CONTACTO_PRIVACIDADE } from "../config.js";

class WopRodape extends HTMLElement {
  connectedCallback() {
    render(
      html`
        <div class="rodape-interior">
          <div class="rodape-sobre">
            <a href="/" class="marca"><wop-logo tamanho="26"></wop-logo> Work on Pan</a>
            <p>Um sítio simples para quem precisa de um trabalho feito encontrar quem o saiba fazer.
              Os pagamentos e acordos são combinados entre cliente e freelancer.</p>
          </div>
          <nav aria-label="Plataforma">
            <h2>Plataforma</h2>
            <a href="/projetos">Projetos abertos</a>
            <a href="/registar?tipo=cliente">Publicar um projeto</a>
            <a href="/registar?tipo=freelancer">Trabalhar como freelancer</a>
            <a href="/#como-funciona">Como funciona</a>
          </nav>
          <nav aria-label="Legal">
            <h2>Privacidade e termos</h2>
            <a href="/privacidade">Política de privacidade (RGPD)</a>
            <a href="/privacidade#direitos">Os teus direitos</a>
            <a href="/privacidade#cookies">Cookies e armazenamento</a>
            <a href="/termos">Termos de utilização</a>
          </nav>
          <div>
            <h2>Contacto</h2>
            <p>Pedidos sobre dados pessoais:<br>
              <a href="mailto:${CONTACTO_PRIVACIDADE}">${CONTACTO_PRIVACIDADE}</a></p>
          </div>
        </div>
        <p class="rodape-base">© ${new Date().getFullYear()} Work on Pan · Dados tratados de acordo com o RGPD
          (Regulamento UE 2016/679).</p>
      `,
      this
    );
    mostrarAvisoCookies();
  }
}

function mostrarAvisoCookies() {
  try {
    if (localStorage.getItem("wop_aviso_cookies")) return;
  } catch {
    return;
  }
  const barra = document.createElement("section");
  barra.className = "aviso-cookies";
  barra.setAttribute("aria-label", "Aviso de cookies");
  const fechar = () => {
    try {
      localStorage.setItem("wop_aviso_cookies", "1");
    } catch {}
    barra.remove();
  };
  render(
    html`
      <p>Não usamos cookies de publicidade nem de estatística. Guardamos só o necessário para manter a
        sessão iniciada e lembrar o tema. <a href="/privacidade#cookies">Saber mais</a></p>
      <button type="button" class="botao botao-secundario botao-pequeno" @click=${fechar}>Entendido</button>
    `,
    barra
  );
  document.body.append(barra);
}

customElements.define("wop-rodape", WopRodape);

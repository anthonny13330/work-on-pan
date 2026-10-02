import "../arranque.js";
import { html, pintar } from "../nucleo/html.js";
import { sb } from "../nucleo/supabase.js";
import { sessao, sessaoPronta } from "../nucleo/sessao.js";
import { $, avisar, animarEntrada, esqueletos, estadoVazio } from "../nucleo/ui.js";
import { dinheiro, dataCurta, nomeCategoria, nomeCliente, plural } from "../nucleo/formato.js";

const CAMPOS = "id, titulo, descricao, categoria, orcamento, moeda, prazo_dias, competencias, criado_em, cliente:perfis!projetos_cliente_id_fkey(nome, sobrenome, empresa)";

// Cartão de projeto acabado de sair: ícone da área a espreitar por cima.
const cartaoProjeto = (p) => html`
  <article class="cartao cartao-recente">
    <span class="cartao-icone"><wop-icone nome=${p.categoria}></wop-icone></span>
    <p class="cartao-linha-topo"><span>${nomeCategoria(p.categoria)}</span><span>${dataCurta(p.criado_em)}</span></p>
    <h3><a class="item-titulo" href="/projetos?p=${p.id}">${p.titulo}</a></h3>
    <p class="item-descricao">${p.descricao}</p>
    <p class="cartao-linha-base">
      <span class="valor">${dinheiro(p.orcamento, p.moeda)}</span>
      <span>${p.prazo_dias} dias · ${nomeCliente(p.cliente)}</span>
    </p>
  </article>
`;

async function carregar() {
  pintar(esqueletos(3), $("#recentes"));

  const [projetos, nProjetos, nFreelancers] = await Promise.all([
    sb.from("projetos").select(CAMPOS).eq("estado", "aberto").order("criado_em", { ascending: false }).limit(6),
    sb.from("projetos").select("id", { count: "exact", head: true }).eq("estado", "aberto"),
    sb.from("perfis").select("id", { count: "exact", head: true }).eq("tipo", "freelancer"),
  ]);

  const lista = projetos.data || [];

  pintar(
    lista.length
      ? lista.map((p) => cartaoProjeto(p))
      : estadoVazio({
          titulo: "Ainda não há projetos abertos",
          texto: "Sê o primeiro a publicar — os freelancers registados vão vê-lo logo.",
          acao: html`<a class="botao botao-principal" href="/registar?tipo=cliente">Publicar um projeto</a>`,
        }),
    $("#recentes")
  );
  animarEntrada($("#recentes"));

  if (nProjetos.count || nFreelancers.count) {
    const n = nProjetos.count ?? 0;
    const f = nFreelancers.count ?? 0;
    pintar(
      html`<span class="ponto-vivo" aria-hidden="true"></span>
        <span>${n
          ? html`<strong>${plural(n, "projeto", "projetos")}</strong> ao lume agora · ${plural(f, "freelancer", "freelancers")}`
          : html`<strong>${plural(f, "freelancer", "freelancers")}</strong> à espera do teu projeto`}</span>`,
      $("#numeros")
    );
    $("#numeros").hidden = false;
  }
}

// Quem já tem conta vê um atalho para o painel em vez de «criar conta».
sessaoPronta.then(() => {
  if (!sessao.perfil) return;
  pintar(
    html`<a class="botao botao-heroi botao-grande" href="/painel"><wop-icone nome="projetos"></wop-icone> Ir para o meu painel</a>
      <a class="botao botao-heroi-contorno botao-grande" href="/projetos"><wop-icone nome="pesquisar"></wop-icone> Ver projetos</a>`,
    $("#acoesHeroi")
  );
  pintar(
    html`<a class="botao botao-escuro botao-grande" href="/painel">Ir para o meu painel</a>
      <a class="botao botao-escuro-contorno botao-grande" href="/projetos">Ver projetos</a>`,
    $("#acoesFinal")
  );
  document.querySelector(".anotacao")?.remove();
});

if (new URLSearchParams(location.search).has("conta-apagada")) {
  avisar("A tua conta e todos os teus dados foram apagados.");
  history.replaceState(null, "", "/");
}

carregar().catch((e) => console.error("[Work on Pan] início:", e));

import "../arranque.js";
import { html, pintar, nothing } from "../nucleo/html.js";
import { sb } from "../nucleo/supabase.js";
import { sessao, sessaoPronta } from "../nucleo/sessao.js";
import { $, avisar, animarEntrada, esqueletos, estadoVazio } from "../nucleo/ui.js";
import { dinheiro, dataCurta, nomeCategoria, nomeCliente } from "../nucleo/formato.js";

const CAMPOS = "id, titulo, descricao, categoria, orcamento, moeda, prazo_dias, competencias, criado_em, cliente:perfis!projetos_cliente_id_fkey(nome, sobrenome, empresa)";

const cartaoProjeto = (p, compacto = false) => html`
  <article class="cartao">
    <div class="item-topo">
      <div>
        <p class="sobretitulo">${nomeCategoria(p.categoria)}</p>
        <h3><a class="item-titulo" href="/projetos?p=${p.id}">${p.titulo}</a></h3>
      </div>
      <span class="valor">${dinheiro(p.orcamento, p.moeda)}</span>
    </div>
    ${compacto ? nothing : html`<p class="item-descricao">${p.descricao}</p>`}
    <ul class="meta">
      <li>${p.prazo_dias} dias</li>
      <li>${nomeCliente(p.cliente)}</li>
      <li>${dataCurta(p.criado_em)}</li>
    </ul>
  </article>
`;

// Se ainda não há projetos, a montra mostra exemplos — e diz que o são.
const EXEMPLOS = [
  { titulo: "Loja online para cerâmica artesanal", categoria: "dev", orcamento: 1500, prazo_dias: 30 },
  { titulo: "Logótipo e cartões para uma padaria", categoria: "design", orcamento: 350, prazo_dias: 10 },
  { titulo: "Textos para o site de uma clínica", categoria: "redacao", orcamento: 400, prazo_dias: 14 },
];

const cartaoExemplo = (p) => html`
  <div class="cartao" aria-hidden="true">
    <div class="item-topo">
      <div>
        <p class="sobretitulo">Exemplo · ${nomeCategoria(p.categoria)}</p>
        <h3>${p.titulo}</h3>
      </div>
      <span class="valor">${dinheiro(p.orcamento)}</span>
    </div>
    <ul class="meta"><li>${p.prazo_dias} dias</li></ul>
  </div>
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
    lista.length ? lista.slice(0, 3).map((p) => cartaoProjeto(p, true)) : EXEMPLOS.map(cartaoExemplo),
    $("#montra")
  );

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
    pintar(
      html`
        <li><strong>${nProjetos.count ?? 0}</strong><span>projetos abertos</span></li>
        <li><strong>${nFreelancers.count ?? 0}</strong><span>freelancers registados</span></li>
      `,
      $("#numeros")
    );
  }
}

// Quem já tem conta vê um atalho para o painel em vez de «criar conta».
sessaoPronta.then(() => {
  if (!sessao.perfil) return;
  const painel = html`<a class="botao botao-principal botao-grande" href="/painel">Ir para o meu painel</a>
    <a class="botao botao-secundario botao-grande" href="/projetos">Ver projetos</a>`;
  pintar(painel, $("#acoesHeroi"));
  pintar(painel, $("#acoesFinal"));
});

if (new URLSearchParams(location.search).has("conta-apagada")) {
  avisar("A tua conta e todos os teus dados foram apagados.");
  history.replaceState(null, "", "/");
}

carregar().catch((e) => console.error("[Work on Pan] início:", e));

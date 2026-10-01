import "../arranque.js";
import { html, pintar, nothing, repeat } from "../nucleo/html.js";
import { sb } from "../nucleo/supabase.js";
import { sessao, sessaoPronta, aoMudar, irParaConversa } from "../nucleo/sessao.js";
import { $, avisar, animarEntrada, estadoVazio, etiquetaProposta, mostrarMensagem } from "../nucleo/ui.js";
import {
  CATEGORIAS, MOEDAS, dinheiro, dataCurta, nomeCategoria, nomeCliente, plural, traduzirErro,
} from "../nucleo/formato.js";

const estado = {
  projetos: [],
  minhasPropostas: new Map(), // projeto_id → proposta (freelancer com sessão)
  aberto: null, // projeto mostrado na janela
  carregado: false,
};

const filtros = $("#filtros");
const janela = $("#janelaProjeto");

$("#filtroCategoria").innerHTML =
  '<option value="">Todas as áreas</option>' +
  Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");

// Os filtros ficam no endereço, para se poder partilhar uma pesquisa.
const url = new URL(location.href);
for (const nome of ["pesquisa", "area", "orcamento", "ordem"]) {
  const v = url.searchParams.get(nome);
  if (v && filtros.elements[nome]) filtros.elements[nome].value = v;
}

filtros.addEventListener("input", () => {
  const u = new URL(location.href);
  for (const [nome, valor] of new FormData(filtros)) {
    if (valor && !(nome === "ordem" && valor === "recentes")) u.searchParams.set(nome, valor);
    else u.searchParams.delete(nome);
  }
  history.replaceState(null, "", u);
  desenhar();
});
filtros.addEventListener("submit", (e) => e.preventDefault());

const souFreelancer = () => sessao.perfil?.tipo === "freelancer";

/* ── Lista ───────────────────────────────────────────────────── */

function filtrar() {
  const f = Object.fromEntries(new FormData(filtros));
  const termo = (f.pesquisa || "").trim().toLowerCase();
  const [min, max] = (f.orcamento || "-").split("-").map((n) => (n ? Number(n) : null));

  const lista = estado.projetos.filter((p) => {
    const texto = [p.titulo, p.descricao, ...p.competencias].join(" ").toLowerCase();
    return (
      (!termo || texto.includes(termo)) &&
      (!f.area || p.categoria === f.area) &&
      (min === null || p.orcamento >= min) &&
      (max === null || p.orcamento <= max)
    );
  });

  if (f.ordem === "maior") lista.sort((a, b) => b.orcamento - a.orcamento);
  else if (f.ordem === "prazo") lista.sort((a, b) => a.prazo_dias - b.prazo_dias);
  return lista;
}

function botaoCartao(p) {
  const minha = estado.minhasPropostas.get(p.id);
  if (minha && minha.estado !== "retirada") return html`<span class="etiqueta etiqueta-ok">Já enviaste proposta</span>`;
  return html`<a class="botao botao-secundario botao-pequeno" href="?p=${p.id}" @click=${(e) => abrirProjeto(p.id, e)}>
    ${souFreelancer() ? "Ver e propor" : "Ver detalhes"}</a>`;
}

const cartao = (p) => html`
  <article class="cartao">
    <div class="item-topo">
      <div>
        <p class="sobretitulo">${nomeCategoria(p.categoria)}</p>
        <h3><a class="item-titulo" href="?p=${p.id}" @click=${(e) => abrirProjeto(p.id, e)}>${p.titulo}</a></h3>
      </div>
      <span class="valor">${dinheiro(p.orcamento, p.moeda)}</span>
    </div>
    <p class="item-descricao">${p.descricao}</p>
    ${p.competencias.length ? html`<ul class="competencias">${p.competencias.map((c) => html`<li>${c}</li>`)}</ul>` : nothing}
    <div class="item-rodape">
      <ul class="meta" style="margin: 0">
        <li>Entrega em ${p.prazo_dias} dias</li>
        <li>${dataCurta(p.criado_em)} · ${nomeCliente(p.cliente)}</li>
      </ul>
      ${botaoCartao(p)}
    </div>
  </article>
`;

function desenhar() {
  if (!estado.carregado) return;
  const lista = filtrar();
  const total = estado.projetos.length;
  $("#contagem").textContent = total ? `${lista.length} de ${plural(total, "projeto aberto", "projetos abertos")}` : "";

  let conteudo;
  if (!total) {
    conteudo = estadoVazio({
      titulo: "Ainda não há projetos abertos",
      texto: "Quando um cliente publicar um trabalho, aparece aqui. Se precisas de alguém, podes ser o primeiro.",
      acao: html`<a class="botao botao-principal"
        href=${sessao.perfil?.tipo === "cliente" ? "/painel#publicar" : "/registar?tipo=cliente"}>Publicar um projeto</a>`,
    });
  } else if (!lista.length) {
    conteudo = estadoVazio({
      texto: "Nenhum projeto corresponde a estes filtros.",
      acao: html`<button class="botao botao-secundario" @click=${limparFiltros}>Limpar filtros</button>`,
    });
  } else {
    conteudo = repeat(lista, (p) => p.id, cartao);
  }
  pintar(conteudo, $("#listaProjetos"));
  animarEntrada($("#listaProjetos"));
}

function limparFiltros() {
  filtros.reset();
  history.replaceState(null, "", location.pathname);
  desenhar();
}

/* ── Janela do projeto ───────────────────────────────────────── */

function abrirProjeto(id, evento, { novoHistorico = true } = {}) {
  const p = estado.projetos.find((x) => x.id === id);
  if (!p) return;
  evento?.preventDefault();
  estado.aberto = p;
  if (novoHistorico) {
    const u = new URL(location.href);
    u.searchParams.set("p", id);
    history.pushState({ p: id }, "", u);
  }
  desenharJanela();
  if (!janela.open) janela.showModal();
}

janela.addEventListener("close", () => {
  estado.aberto = null;
  const u = new URL(location.href);
  if (u.searchParams.has("p")) {
    u.searchParams.delete("p");
    history.replaceState(null, "", u);
  }
});
janela.addEventListener("click", (e) => e.target === janela && janela.close());
addEventListener("popstate", () => {
  const id = new URL(location.href).searchParams.get("p");
  if (id) abrirProjeto(id, null, { novoHistorico: false });
  else if (janela.open) janela.close();
});

function desenharJanela() {
  const p = estado.aberto;
  if (!p) return;
  pintar(
    html`
      <div class="dialog-corpo">
        <div class="dialog-cabecalho">
          <div>
            <p class="sobretitulo">${nomeCategoria(p.categoria)}</p>
            <h2 id="jpTitulo">${p.titulo}</h2>
          </div>
          <button type="button" class="fechar" aria-label="Fechar" @click=${() => janela.close()}>×</button>
        </div>
        <ul class="meta">
          <li><strong>${dinheiro(p.orcamento, p.moeda)}</strong> de orçamento</li>
          <li>Entrega em ${p.prazo_dias} dias</li>
          <li>Cliente: ${nomeCliente(p.cliente)}</li>
          <li>Publicado ${dataCurta(p.criado_em)}</li>
        </ul>
        <p style="white-space: pre-line; margin-top: 1rem">${p.descricao}</p>
        ${p.competencias.length ? html`<ul class="competencias">${p.competencias.map((c) => html`<li>${c}</li>`)}</ul>` : nothing}
        <hr style="border: 0; border-top: 1px solid var(--linha); margin: 1.25rem 0">
        ${acaoDaJanela(p)}
      </div>
    `,
    janela
  );
}

// O fundo da janela depende de quem está a ver.
function acaoDaJanela(p) {
  if (!sessao.perfil) {
    return html`
      <p>Para enviar uma proposta precisas de uma conta de freelancer.</p>
      <div class="acoes">
        <a class="botao botao-principal" href="/entrar?volta=${encodeURIComponent(`/projetos?p=${p.id}`)}">Entrar</a>
        <a class="botao botao-secundario" href="/registar?tipo=freelancer">Criar conta de freelancer</a>
      </div>`;
  }
  if (sessao.perfil.tipo === "cliente") {
    return p.cliente_id === sessao.user.id
      ? html`<p>Este projeto é teu. As propostas recebidas estão em <a href="/painel">Os meus projetos</a>.</p>`
      : html`<p class="texto-suave">Estás com uma conta de cliente, por isso só podes ver este projeto.</p>`;
  }

  const minha = estado.minhasPropostas.get(p.id);
  if (minha && minha.estado !== "retirada") {
    return html`
      <p>Já enviaste uma proposta de <strong>${dinheiro(minha.valor, minha.moeda)}</strong>. Estado: ${etiquetaProposta(minha.estado)}</p>
      <div class="acoes">
        <a class="botao botao-secundario" href="/painel">Ver as minhas propostas</a>
        <button class="botao botao-secundario" @click=${() => irParaConversa(p.cliente_id, p.id)}>Falar com o cliente</button>
      </div>`;
  }

  return html`
    <h3>A tua proposta</h3>
    <p class="texto-suave texto-pequeno">O cliente recebe-a no painel e abre-se uma conversa entre vocês em Mensagens.
      Podes editá-la ou retirá-la enquanto ele não responder.</p>
    <form id="formProposta" novalidate style="margin-top: 1rem" @submit=${(e) => enviarProposta(e, p)}>
      <div id="msgProposta" role="alert" hidden></div>
      <div class="linha-campos">
        <div class="campo">
          <label for="ppValor">Quanto cobras pelo trabalho todo?</label>
          <input type="number" id="ppValor" name="valor" min="1" step="1" inputmode="numeric" required>
        </div>
        <div class="campo">
          <label for="ppMoeda">Moeda</label>
          <select id="ppMoeda" name="moeda">
            ${Object.entries(MOEDAS).map(([k, v]) => html`<option value=${k} ?selected=${k === p.moeda}>${v}</option>`)}
          </select>
        </div>
      </div>
      <div class="campo">
        <label for="ppPrazo">Em quantos dias entregas?</label>
        <input type="number" id="ppPrazo" name="prazo" min="1" max="365" step="1" inputmode="numeric" required>
        <span class="ajuda">O cliente pediu ${p.prazo_dias} dias.</span>
      </div>
      <div class="campo">
        <label for="ppMensagem">Mensagem para o cliente</label>
        <textarea id="ppMensagem" name="mensagem" maxlength="3000" required
          placeholder="Como farias o trabalho, o que já fizeste de parecido e o que precisas que o cliente te envie."></textarea>
      </div>
      <button type="submit" class="botao botao-principal botao-largo">Enviar proposta ao cliente</button>
    </form>`;
}

async function enviarProposta(evento, p) {
  evento.preventDefault();
  const form = evento.target;
  const d = Object.fromEntries(new FormData(form));
  const erro = (t) => mostrarMensagem($("#msgProposta"), t);
  const valor = Number(d.valor);
  const prazo = Number(d.prazo);
  const mensagem = d.mensagem.trim();

  if (!(valor > 0)) return erro("Indica o valor da proposta.");
  if (!(prazo > 0 && prazo <= 365)) return erro("Indica em quantos dias entregas (1 a 365).");
  if (mensagem.length < 20) return erro("Escreve um pouco mais (pelo menos 20 caracteres) — é o que convence o cliente.");

  const botao = form.querySelector('[type="submit"]');
  botao.disabled = true;
  botao.textContent = "A enviar…";
  const { error } = await sb.rpc("enviar_proposta", {
    p_projeto: p.id, p_valor: valor, p_moeda: d.moeda, p_prazo: prazo, p_mensagem: mensagem,
  });
  if (error) {
    botao.disabled = false;
    botao.textContent = "Enviar proposta ao cliente";
    return erro(traduzirErro(error));
  }
  await carregarMinhasPropostas();
  desenharJanela();
  avisar("Proposta enviada. O cliente já a pode ver.");
}

/* ── Dados ───────────────────────────────────────────────────── */

async function carregarProjetos() {
  const { data, error } = await sb
    .from("projetos")
    .select("*, cliente:perfis!projetos_cliente_id_fkey(nome, sobrenome, empresa)")
    .eq("estado", "aberto")
    .order("criado_em", { ascending: false });
  if (error) {
    console.error("[Work on Pan] projetos:", error);
    $("#contagem").textContent = "Não foi possível carregar os projetos. Recarrega a página.";
    return;
  }
  estado.projetos = data;
  estado.carregado = true;
  desenhar();
}

async function carregarMinhasPropostas() {
  if (!souFreelancer()) return;
  const { data } = await sb.from("propostas").select("projeto_id, estado, valor, moeda").eq("freelancer_id", sessao.user.id);
  estado.minhasPropostas = new Map((data || []).map((pp) => [pp.projeto_id, pp]));
  desenhar();
}

await sessaoPronta;
if (sessao.perfil?.tipo === "cliente") {
  $("#introducao").textContent =
    "É isto que os freelancers veem. Os teus projetos e as propostas recebidas estão em «Os meus projetos».";
}
await Promise.all([carregarProjetos(), carregarMinhasPropostas()]);
aoMudar(["projetos"], carregarProjetos);

// Endereço partilhado com ?p=… abre logo o projeto.
const pedido = new URL(location.href).searchParams.get("p");
if (pedido) {
  if (estado.projetos.some((p) => p.id === pedido)) abrirProjeto(pedido, null, { novoHistorico: false });
  else avisar("Esse projeto já não está a receber propostas.", "erro");
}

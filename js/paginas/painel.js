import "../arranque.js";
import { html, pintar, nothing, repeat } from "../nucleo/html.js";
import { sb } from "../nucleo/supabase.js";
import { exigirSessao, aoMudar, irParaConversa } from "../nucleo/sessao.js";
import {
  $, $$, avisar, animarEntrada, confirmar, estadoVazio, etiquetaProjeto, etiquetaProposta, mostrarMensagem, vaporar,
} from "../nucleo/ui.js";
import {
  CATEGORIAS, MOEDAS, dinheiro, dataCurta, iniciais, nomeCategoria, nomeCliente, nomeCompleto,
  listaCompetencias, plural, traduzirErro,
} from "../nucleo/formato.js";

const { user, perfil } = await exigirSessao();
$("#aCarregar").remove();

const opcoes = (mapa, vazio) =>
  (vazio ? `<option value="">${vazio}</option>` : "") +
  Object.entries(mapa).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");

const resumo = (itens) =>
  itens.map(([n, texto, icone]) => html`<li><wop-icone nome=${icone}></wop-icone><strong>${n}</strong><span>${texto}</span></li>`);

/* ═══════════════════════════ CLIENTE ═══════════════════════════ */

function iniciarCliente() {
  document.title = "Os meus projetos · Work on Pan";
  $("#vistaCliente").hidden = false;
  $("#cOla").textContent = `Olá, ${perfil.nome}`;
  $("#pubCategoria").innerHTML = opcoes(CATEGORIAS, "Escolhe a área");
  $("#pubMoeda").innerHTML = opcoes(MOEDAS);
  $("#pubMoeda").value = perfil.moeda || "EUR";

  prepararSeparadores();
  carregarMeusProjetos();
  aoMudar(["projetos", "propostas"], carregarMeusProjetos);
  carregarFreelancers();
  $("#pesquisaFreelancers").addEventListener("input", desenharFreelancers);
  $("#formPublicar").addEventListener("submit", publicarProjeto);
  $("#atalhoPublicar").addEventListener("click", (e) => {
    e.preventDefault();
    window.mudarSeparador("publicar", true);
    $("#pubTitulo").focus({ preventScroll: true });
    $("#painel-publicar").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// Separadores acessíveis: setas esquerda/direita mudam de separador.
function prepararSeparadores() {
  const separadores = $$('#vistaCliente [role="tab"]');
  const mudar = (nome, focar = false) => {
    for (const t of separadores) {
      const ativo = t.id === `tab-${nome}`;
      t.setAttribute("aria-selected", ativo);
      t.tabIndex = ativo ? 0 : -1;
      $(`#${t.getAttribute("aria-controls")}`).hidden = !ativo;
      if (ativo && focar) t.focus();
    }
    history.replaceState(null, "", `#${nome}`);
  };
  separadores.forEach((t, i) => {
    t.addEventListener("click", () => mudar(t.id.replace("tab-", "")));
    t.addEventListener("keydown", (e) => {
      const passo = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!passo) return;
      const seguinte = separadores[(i + passo + separadores.length) % separadores.length];
      mudar(seguinte.id.replace("tab-", ""), true);
    });
  });
  window.mudarSeparador = mudar;
  const inicial = location.hash.slice(1);
  if (["projetos", "publicar", "freelancers"].includes(inicial)) mudar(inicial);
}

let meusProjetos = [];

async function carregarMeusProjetos() {
  const { data, error } = await sb
    .from("projetos")
    .select(`*,
      escolhido:perfis!projetos_freelancer_id_fkey(nome, sobrenome),
      propostas(*, freelancer:perfis!propostas_freelancer_id_fkey(nome, sobrenome, area, competencias))`)
    .eq("cliente_id", user.id)
    .order("criado_em", { ascending: false })
    .order("criado_em", { referencedTable: "propostas", ascending: false });
  if (error) return mostrarErro("#listaMeusProjetos", error);
  meusProjetos = data;
  desenharMeusProjetos();
}

function mostrarErro(seletor, e) {
  console.error("[Work on Pan]", e);
  pintar(estadoVazio({ texto: `Não foi possível carregar esta lista. ${traduzirErro(e)}` }), $(seletor));
}

function desenharMeusProjetos() {
  const conta = (estado) => meusProjetos.filter((p) => p.estado === estado).length;
  const porResponder = meusProjetos
    .filter((p) => p.estado === "aberto")
    .reduce((n, p) => n + p.propostas.filter((pp) => pp.estado === "pendente").length, 0);

  pintar(
    resumo([
      [conta("aberto"), "a receber propostas", "projetos"],
      [porResponder, "propostas por responder", "notificacoes"],
      [conta("em_andamento"), "em andamento", "prazo"],
      [conta("concluido"), "concluídos", "aceitar"],
    ]),
    $("#resumoCliente")
  );

  pintar(
    meusProjetos.length
      ? repeat(meusProjetos, (p) => p.id, cartaoMeuProjeto)
      : estadoVazio({
          titulo: "Ainda não publicaste nenhum projeto",
          texto: "Descreve o trabalho, indica um orçamento e um prazo. Os freelancers enviam-te propostas e tu escolhes.",
          acao: html`<button class="botao botao-principal" @click=${() => window.mudarSeparador("publicar", true)}>
            Publicar o primeiro projeto</button>`,
        }),
    $("#listaMeusProjetos")
  );
  animarEntrada($("#listaMeusProjetos"));
}

const AJUDA_ESTADO = {
  aberto: "Fechar esconde o projeto de «Projetos abertos».",
  em_andamento: "Quando o trabalho estiver entregue, marca-o como concluído.",
  concluido: "Trabalho terminado.",
  fechado: "Fechado: os freelancers já não o veem.",
};

function cartaoMeuProjeto(p) {
  const propostas = p.propostas.filter((pp) => pp.estado !== "retirada");
  return html`
    <article class="cartao cartao-projeto">
      <div class="item-topo">
        <span class="area-icone" data-area=${p.categoria}><wop-icone nome=${p.categoria}></wop-icone></span>
        <div class="item-topo-texto">
          <h3>${p.titulo}</h3>
          <ul class="meta meta-icones">
            <li><wop-icone nome="orcamento"></wop-icone>${dinheiro(p.orcamento, p.moeda)}</li>
            <li><wop-icone nome="prazo"></wop-icone>${p.prazo_dias} dias</li>
            <li><wop-icone nome="notificacoes"></wop-icone>publicado ${dataCurta(p.criado_em)}</li>
          </ul>
        </div>
        ${etiquetaProjeto(p.estado)}
      </div>
      <p class="item-descricao">${p.descricao}</p>
      ${p.escolhido ? html`<p class="escolhido"><wop-icone nome="estrela"></wop-icone>Freelancer escolhido: <strong>${nomeCompleto(p.escolhido)}</strong></p>` : nothing}
      <div class="sub-lista">
        <strong>${propostas.length ? `Propostas recebidas (${propostas.length})` : "Ainda sem propostas"}</strong>
        ${propostas.length
          ? repeat(propostas, (pp) => pp.id, (pp) => cartaoPropostaRecebida(p, pp))
          : html`<p class="texto-suave texto-pequeno">${p.estado === "aberto"
              ? html`O projeto está visível em <a href="/projetos?p=${p.id}">Projetos abertos</a>. Quando alguém enviar uma proposta, aparece aqui.`
              : "Este projeto não está a receber propostas."}</p>`}
      </div>
      <div class="item-rodape">
        <span class="texto-suave texto-pequeno">${AJUDA_ESTADO[p.estado]}</span>
        <div class="acoes">${acoesProjeto(p)}</div>
      </div>
    </article>
  `;
}

function cartaoPropostaRecebida(projeto, pp) {
  const podeDecidir = projeto.estado === "aberto" && pp.estado === "pendente";
  const nome = nomeCompleto(pp.freelancer);
  return html`
    <div class="proposta">
      <div class="item-topo">
        <div class="pessoa">
          <span class="avatar" aria-hidden="true">${iniciais(nome)}</span>
          <div>
            <strong>${nome}</strong>${pp.freelancer?.area
              ? html` <span class="texto-suave texto-pequeno">· ${nomeCategoria(pp.freelancer.area)}</span>` : nothing}<br>
            <span class="texto-suave texto-pequeno">${dinheiro(pp.valor, pp.moeda)} · entrega em ${pp.prazo_entrega} dias · ${dataCurta(pp.criado_em)}</span>
          </div>
        </div>
        ${etiquetaProposta(pp.estado)}
      </div>
      <blockquote>${pp.mensagem}</blockquote>
      <div class="acoes">
        ${podeDecidir
          ? html`
              <button class="botao botao-principal botao-pequeno" @click=${() => responderProposta(projeto, pp, true)}><wop-icone nome="aceitar"></wop-icone> Aceitar e começar o projeto</button>
              <button class="botao botao-perigo botao-pequeno" @click=${() => responderProposta(projeto, pp, false)}><wop-icone nome="recusar"></wop-icone> Recusar</button>`
          : nothing}
        <button class="botao botao-secundario botao-pequeno" @click=${() => irParaConversa(pp.freelancer_id, projeto.id)}>
          <wop-icone nome="mensagens"></wop-icone> Conversar com ${pp.freelancer?.nome || "o freelancer"}</button>
      </div>
    </div>
  `;
}

function acoesProjeto(p) {
  const apagar = html`<button class="botao botao-perigo botao-pequeno" @click=${() => apagarProjeto(p)}><wop-icone nome="lixo"></wop-icone> Apagar</button>`;
  switch (p.estado) {
    case "aberto":
      return html`<button class="botao botao-secundario botao-pequeno" @click=${() => mudarEstado(p, "fechado")}><wop-icone nome="cadeado"></wop-icone> Fechar a novas propostas</button>${apagar}`;
    case "fechado":
      return html`<button class="botao botao-secundario botao-pequeno" @click=${() => mudarEstado(p, "aberto")}><wop-icone nome="publicar"></wop-icone> Reabrir a propostas</button>${apagar}`;
    case "em_andamento":
      return html`
        <button class="botao botao-secundario botao-pequeno" @click=${() => irParaConversa(p.freelancer_id, p.id)}><wop-icone nome="mensagens"></wop-icone> Falar com o freelancer</button>
        <button class="botao botao-principal botao-pequeno" @click=${() => mudarEstado(p, "concluido")}><wop-icone nome="aceitar"></wop-icone> Marcar como concluído</button>`;
    default:
      return apagar;
  }
}

async function publicarProjeto(evento) {
  evento.preventDefault();
  const form = evento.target;
  const msg = $("#msgPublicar");
  const d = Object.fromEntries(new FormData(form));
  const erro = (t) => mostrarMensagem(msg, t);

  const projeto = {
    cliente_id: user.id,
    titulo: d.titulo.trim(),
    categoria: d.categoria,
    descricao: d.descricao.trim(),
    orcamento: Number(d.orcamento),
    moeda: d.moeda,
    prazo_dias: Number(d.prazo_dias),
    competencias: listaCompetencias(d.competencias, 12),
  };

  if (projeto.titulo.length < 5) return erro("Escreve um título com pelo menos 5 caracteres.");
  if (!projeto.categoria) return erro("Escolhe a área do projeto.");
  if (projeto.descricao.length < 30) return erro("A descrição está muito curta — explica um pouco mais (pelo menos 30 caracteres).");
  if (!(projeto.orcamento > 0)) return erro("Indica um orçamento de referência.");
  if (!(projeto.prazo_dias > 0 && projeto.prazo_dias <= 365)) return erro("Indica em quantos dias precisas do trabalho (1 a 365).");

  const botao = form.querySelector('[type="submit"]');
  botao.disabled = true;
  botao.textContent = "A publicar…";
  botao.classList.add("a-carregar");
  const { error } = await sb.from("projetos").insert(projeto);
  botao.classList.remove("a-carregar");
  if (error) {
    botao.disabled = false;
    botao.textContent = "Publicar projeto";
    return erro(`Não foi possível publicar. ${traduzirErro(error)}`);
  }

  // Um momento para ver o vapor a sair do botão antes de mudar de separador.
  botao.textContent = "Publicado";
  botao.classList.add("feito");
  vaporar(botao);
  await new Promise((r) => setTimeout(r, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1100));
  botao.disabled = false;
  botao.textContent = "Publicar projeto";
  botao.classList.remove("feito");

  form.reset();
  $("#pubMoeda").value = projeto.moeda;
  msg.hidden = true;
  await carregarMeusProjetos();
  window.mudarSeparador("projetos");
  avisar("Já está ao lume. O projeto aparece em «Projetos abertos».");
}

async function mudarEstado(p, estado) {
  const perguntas = {
    fechado: { titulo: "Fechar este projeto?", texto: "Deixa de aparecer aos freelancers e as propostas pendentes ficam fechadas. Podes reabri-lo depois.", sim: "Fechar projeto" },
    concluido: { titulo: "Marcar como concluído?", texto: "Confirma só depois de receberes o trabalho final.", sim: "Marcar como concluído" },
  };
  if (perguntas[estado] && !(await confirmar(perguntas[estado]))) return;
  const { error } = await sb.from("projetos").update({ estado }).eq("id", p.id);
  if (error) return avisar(traduzirErro(error), "erro");
  await carregarMeusProjetos();
  avisar({ aberto: "Projeto reaberto.", fechado: "Projeto fechado.", concluido: "Projeto concluído. Bom trabalho!" }[estado]);
}

async function apagarProjeto(p) {
  const sim = await confirmar({
    titulo: `Apagar «${p.titulo}»?`,
    texto: "O projeto e as propostas recebidas são apagados de vez.",
    sim: "Apagar projeto",
    perigo: true,
  });
  if (!sim) return;
  const { error } = await sb.from("projetos").delete().eq("id", p.id);
  if (error) return avisar(traduzirErro(error), "erro");
  await carregarMeusProjetos();
  avisar("Projeto apagado.");
}

async function responderProposta(projeto, pp, aceitar) {
  const nome = nomeCompleto(pp.freelancer);
  const outras = projeto.propostas.filter((x) => x.id !== pp.id && x.estado === "pendente").length;
  const sim = await confirmar(
    aceitar
      ? {
          titulo: `Aceitar a proposta de ${nome}?`,
          texto: `${dinheiro(pp.valor, pp.moeda)}, entrega em ${pp.prazo_entrega} dias.\n\nO projeto passa a «Em andamento» e deixa de receber propostas.` +
            (outras ? `\n${plural(outras, "outra proposta fica fechada", "outras propostas ficam fechadas")}.` : ""),
          sim: "Aceitar proposta",
        }
      : { titulo: `Recusar a proposta de ${nome}?`, texto: "A pessoa vê a proposta como recusada.", sim: "Recusar", perigo: true }
  );
  if (!sim) return;
  const { error } = await sb.rpc("responder_proposta", { p_proposta: pp.id, p_aceitar: aceitar });
  if (error) return avisar(traduzirErro(error), "erro");
  await carregarMeusProjetos();
  avisar(aceitar ? `Proposta de ${nome} aceite. Já podem falar em Mensagens.` : "Proposta recusada.", "ok", { vapor: aceitar });
}

let freelancers = [];

async function carregarFreelancers() {
  const { data, error } = await sb
    .from("perfis")
    .select("id, nome, sobrenome, area, bio, valor_hora, moeda, competencias, disponivel")
    .eq("tipo", "freelancer")
    .order("disponivel", { ascending: false })
    .order("atualizado_em", { ascending: false });
  if (error) return mostrarErro("#listaFreelancers", error);
  freelancers = data;
  desenharFreelancers();
}

function desenharFreelancers() {
  const termo = $("#pesquisaFreelancers").value.trim().toLowerCase();
  const lista = freelancers.filter(
    (f) => !termo || [nomeCompleto(f), nomeCategoria(f.area), f.bio, ...f.competencias].join(" ").toLowerCase().includes(termo)
  );
  let conteudo;
  if (!freelancers.length) {
    conteudo = estadoVazio({ texto: "Ainda não há freelancers registados. Publica o teu projeto — quem se registar vai vê-lo." });
  } else if (!lista.length) {
    conteudo = estadoVazio({ texto: "Ninguém corresponde a essa pesquisa." });
  } else {
    conteudo = repeat(lista, (f) => f.id, cartaoFreelancer);
  }
  pintar(conteudo, $("#listaFreelancers"));
  animarEntrada($("#listaFreelancers"));
}

const cartaoFreelancer = (f) => html`
  <article class="cartao">
    <div class="item-topo">
      <div class="pessoa">
        <span class="avatar" aria-hidden="true">${iniciais(nomeCompleto(f))}</span>
        <div>
          <h3>${nomeCompleto(f)}</h3>
          <span class="texto-suave texto-pequeno com-icone-linha">${f.area ? html`<wop-icone nome=${f.area}></wop-icone>${nomeCategoria(f.area)}` : "Área não indicada"}</span>
        </div>
      </div>
      ${f.valor_hora ? html`<span class="valor">${dinheiro(f.valor_hora, f.moeda)}<span class="texto-suave texto-pequeno">/hora</span></span>` : nothing}
    </div>
    <p class="item-descricao">${f.bio || "Ainda sem apresentação."}</p>
    ${f.competencias.length ? html`<ul class="competencias">${f.competencias.map((c) => html`<li>${c}</li>`)}</ul>` : nothing}
    <div class="item-rodape">
      <span class="disponibilidade ${f.disponivel ? "sim" : ""}">${f.disponivel ? "Disponível para novos projetos" : "Sem disponibilidade de momento"}</span>
      <button class="botao botao-secundario botao-pequeno" @click=${() => irParaConversa(f.id)}><wop-icone nome="mensagens"></wop-icone> Enviar mensagem</button>
    </div>
  </article>
`;

/* ═══════════════════════════ FREELANCER ═══════════════════════════ */

let minhasPropostas = [];
let abertosAgora = 0;

function iniciarFreelancer() {
  document.title = "As minhas propostas · Work on Pan";
  $("#vistaFreelancer").hidden = false;
  $("#fOla").textContent = `Olá, ${perfil.nome}`;
  $("#avisoPerfil").hidden = Boolean(perfil.area && perfil.bio && perfil.competencias.length);

  carregarPropostas();
  contarAbertos();
  aoMudar(["propostas"], carregarPropostas, `freelancer_id=eq.${user.id}`);
  aoMudar(["projetos"], contarAbertos);
}

async function carregarPropostas() {
  const { data, error } = await sb
    .from("propostas")
    .select("*, projeto:projetos(id, titulo, estado, cliente_id, cliente:perfis!projetos_cliente_id_fkey(nome, sobrenome, empresa))")
    .eq("freelancer_id", user.id)
    .order("atualizado_em", { ascending: false });
  if (error) return mostrarErro("#listaPropostas", error);
  minhasPropostas = data;
  desenharPropostas();
}

async function contarAbertos() {
  const { count } = await sb.from("projetos").select("id", { count: "exact", head: true }).eq("estado", "aberto");
  abertosAgora = count ?? 0;
  desenharResumoFreelancer();
}

function desenharResumoFreelancer() {
  const n = (...estados) => minhasPropostas.filter((p) => estados.includes(p.estado)).length;
  pintar(
    resumo([
      [n("pendente"), "à espera de resposta", "prazo"],
      [n("aceite"), "aceites", "aceitar"],
      [n("recusada", "fechada"), "recusadas ou fechadas", "recusar"],
      [abertosAgora, "projetos abertos agora", "projetos"],
    ]),
    $("#resumoFreelancer")
  );
}

const NOTA_PROPOSTA = {
  pendente: "O cliente ainda não respondeu.",
  aceite: "O cliente escolheu-te. Combinem os detalhes em Mensagens.",
  recusada: "O cliente escolheu não avançar com esta proposta.",
  fechada: "O projeto foi fechado ou entregue a outra pessoa.",
  retirada: "Retiraste esta proposta.",
};

function desenharPropostas() {
  desenharResumoFreelancer();
  pintar(
    minhasPropostas.length
      ? repeat(minhasPropostas, (pp) => pp.id, cartaoMinhaProposta)
      : estadoVazio({
          titulo: "Ainda não enviaste propostas",
          texto: "Vê os projetos abertos, escolhe um que saibas fazer bem e diz ao cliente como o farias.",
          acao: html`<a class="botao botao-principal" href="/projetos">Ver projetos abertos</a>`,
        }),
    $("#listaPropostas")
  );
  animarEntrada($("#listaPropostas"));
}

function cartaoMinhaProposta(pp) {
  const reenviar = pp.estado === "retirada" && pp.projeto.estado === "aberto";
  return html`
    <article class="cartao">
      <div class="item-topo">
        <div>
          <h3>${pp.projeto.titulo}</h3>
          <ul class="meta meta-icones">
            <li><wop-icone nome="perfil"></wop-icone>${nomeCliente(pp.projeto.cliente)}</li>
            <li><wop-icone nome="orcamento"></wop-icone>${dinheiro(pp.valor, pp.moeda)}</li>
            <li><wop-icone nome="prazo"></wop-icone>entrega em ${pp.prazo_entrega} dias</li>
            <li><wop-icone nome="enviar"></wop-icone>enviada ${dataCurta(pp.criado_em)}</li>
          </ul>
        </div>
        ${etiquetaProposta(pp.estado)}
      </div>
      <p class="item-descricao">${pp.mensagem}</p>
      <div class="item-rodape">
        <span class="texto-suave texto-pequeno">${NOTA_PROPOSTA[pp.estado]}${reenviar ? " O projeto ainda está aberto, podes voltar a enviá-la." : ""}</span>
        <div class="acoes">
          <button class="botao botao-secundario botao-pequeno" @click=${() => irParaConversa(pp.projeto.cliente_id, pp.projeto_id)}><wop-icone nome="mensagens"></wop-icone> Falar com o cliente</button>
          ${pp.estado === "pendente" || reenviar
            ? html`<button class="botao botao-secundario botao-pequeno" @click=${() => editarProposta(pp)}><wop-icone nome="editar"></wop-icone> ${reenviar ? "Voltar a enviar" : "Editar"}</button>`
            : nothing}
          ${pp.estado === "pendente"
            ? html`<button class="botao botao-perigo botao-pequeno" @click=${() => retirarProposta(pp)}><wop-icone nome="recusar"></wop-icone> Retirar</button>`
            : nothing}
        </div>
      </div>
    </article>
  `;
}

function editarProposta(pp) {
  const janela = $("#janelaEditar");
  pintar(
    html`
      <form class="dialog-corpo" novalidate @submit=${(e) => guardarEdicao(e, pp)}>
        <div class="dialog-cabecalho">
          <div>
            <p class="sobretitulo">${pp.projeto.titulo}</p>
            <h2 id="jeTitulo">${pp.estado === "retirada" ? "Voltar a enviar a proposta" : "Editar proposta"}</h2>
          </div>
          <button type="button" class="fechar" aria-label="Fechar" @click=${() => janela.close()}><wop-icone nome="fechar"></wop-icone></button>
        </div>
        <div id="msgEditar" role="alert" hidden></div>
        <div class="linha-campos">
          <div class="campo">
            <label for="jeValor">Valor total</label>
            <input type="number" id="jeValor" name="valor" min="1" step="1" .value=${String(pp.valor)}>
          </div>
          <div class="campo">
            <label for="jePrazo">Entrega em (dias)</label>
            <input type="number" id="jePrazo" name="prazo" min="1" max="365" step="1" .value=${String(pp.prazo_entrega)}>
          </div>
        </div>
        <div class="campo">
          <label for="jeMensagem">Mensagem para o cliente</label>
          <textarea id="jeMensagem" name="mensagem" maxlength="3000" .value=${pp.mensagem}></textarea>
        </div>
        <p class="texto-suave texto-pequeno">O cliente é avisado na conversa de que alteraste a proposta.</p>
        <div class="dialog-acoes">
          <button type="button" class="botao botao-secundario" @click=${() => janela.close()}>Cancelar</button>
          <button type="submit" class="botao botao-principal">Guardar e enviar</button>
        </div>
      </form>
    `,
    janela
  );
  janela.showModal();
}

async function guardarEdicao(evento, pp) {
  evento.preventDefault();
  const d = Object.fromEntries(new FormData(evento.target));
  const valor = Number(d.valor);
  const prazo = Number(d.prazo);
  const mensagem = d.mensagem.trim();
  const erro = (t) => mostrarMensagem($("#msgEditar"), t);
  if (!(valor > 0) || !(prazo > 0 && prazo <= 365)) return erro("Valor e prazo têm de ser maiores que zero (prazo até 365 dias).");
  if (mensagem.length < 20) return erro("A mensagem precisa de pelo menos 20 caracteres.");

  const { error } = await sb.rpc("enviar_proposta", {
    p_projeto: pp.projeto_id, p_valor: valor, p_moeda: pp.moeda, p_prazo: prazo, p_mensagem: mensagem,
  });
  if (error) return erro(traduzirErro(error));
  $("#janelaEditar").close();
  await carregarPropostas();
  avisar("Proposta enviada. O cliente foi avisado na conversa.");
}

async function retirarProposta(pp) {
  const sim = await confirmar({
    titulo: "Retirar esta proposta?",
    texto: `O cliente de «${pp.projeto.titulo}» deixa de a poder aceitar. Se o projeto continuar aberto, podes voltar a enviá-la.`,
    sim: "Retirar proposta",
    perigo: true,
  });
  if (!sim) return;
  const { error } = await sb.rpc("retirar_proposta", { p_proposta: pp.id });
  if (error) return avisar(traduzirErro(error), "erro");
  await carregarPropostas();
  avisar("Proposta retirada.");
}

/* ── Arranque ────────────────────────────────────────────────── */

if (perfil.tipo === "cliente") iniciarCliente();
else iniciarFreelancer();

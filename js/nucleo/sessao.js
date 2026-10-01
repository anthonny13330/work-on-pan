// Sessão do utilizador, tempo real e conversas.
import { sb, ok } from "./supabase.js";
import { avisar } from "./ui.js";
import { traduzirErro } from "./formato.js";

/** Estado partilhado por todos os módulos da página. */
export const sessao = { user: null, perfil: null };

async function carregar() {
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) return sessao;
  const perfil = ok(await sb.from("perfis").select("*").eq("id", user.id).maybeSingle());
  if (perfil) Object.assign(sessao, { user, perfil });
  return sessao;
}

/** Resolve quando se sabe se há sessão (o cabeçalho e as páginas esperam por isto). */
export const sessaoPronta = carregar().catch((e) => {
  console.error("[Work on Pan] sessão:", e);
  return sessao;
});

/** Páginas privadas: sem sessão vai para o login e volta depois. */
export async function exigirSessao() {
  await sessaoPronta;
  if (!sessao.perfil) {
    const volta = encodeURIComponent(location.pathname + location.search);
    location.replace(`/entrar?volta=${volta}`);
    return new Promise(() => {}); // a página não continua
  }
  return sessao;
}

export async function sair() {
  await sb.auth.signOut();
  location.href = "/entrar";
}

/** Destino seguro depois de entrar: só caminhos do próprio site. */
export function destinoDepoisDeEntrar() {
  const v = new URLSearchParams(location.search).get("volta") || "";
  return /^\/[a-z-]*(\?[\w=&%.-]*)?$/i.test(v) ? v : "/painel";
}

/**
 * Chama `callback` quando alguma das tabelas muda (agrupado a cada 300ms).
 * @returns {() => void} função para deixar de ouvir
 */
export function aoMudar(tabelas, callback, filtro) {
  let espera;
  const agrupado = () => {
    clearTimeout(espera);
    espera = setTimeout(callback, 300);
  };
  const canal = sb.channel(`wop-${tabelas.join("-")}-${crypto.randomUUID().slice(0, 8)}`);
  for (const table of tabelas) {
    canal.on("postgres_changes", { event: "*", schema: "public", table, ...(filtro && { filter: filtro }) }, agrupado);
  }
  canal.subscribe();
  return () => sb.removeChannel(canal);
}

/** Abre (ou cria) a conversa com outra pessoa e vai para as mensagens. */
export async function irParaConversa(outroId, projetoId = null) {
  try {
    const id = ok(await sb.rpc("abrir_conversa", { p_outro: outroId, p_projeto: projetoId }));
    location.href = `/mensagens?c=${encodeURIComponent(id)}`;
  } catch (e) {
    avisar(traduzirErro(e), "erro");
  }
}

export function conversaPorLer(c, uid) {
  if (c.ultimo_autor_id === uid) return false;
  const lida = uid === c.cliente_id ? c.lido_cliente_em : c.lido_freelancer_em;
  return !lida || new Date(lida) < new Date(c.ultima_mensagem_em);
}

export async function contarPorLer() {
  if (!sessao.user) return 0;
  const { data } = await sb
    .from("conversas")
    .select("cliente_id, freelancer_id, ultimo_autor_id, ultima_mensagem_em, lido_cliente_em, lido_freelancer_em");
  return (data || []).filter((c) => conversaPorLer(c, sessao.user.id)).length;
}

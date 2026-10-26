// Pagamentos pela plataforma: o browser só pede; quem fala com o PayPal é a função
// «pagamentos» do Supabase (supabase/functions/pagamentos), que guarda as chaves em segredo.
import { html, nothing } from "./html.js";
import { sb } from "./supabase.js";
import { avisar, confirmar } from "./ui.js";
import { dinheiro } from "./formato.js";
import { COMISSAO, PAGAMENTOS_MODO } from "../config.js";

export const emTestes = PAGAMENTOS_MODO !== "live";

/** Chama a função de pagamentos e devolve a resposta, ou lança um erro com mensagem em português. */
async function pedir(acao, id) {
  const corpo = acao === "criar" ? { acao, proposta: id } : { acao, pagamento: id };
  const { data, error } = await sb.functions.invoke("pagamentos", { body: corpo });
  if (error) {
    // Erros da função vêm com { erro } no corpo; erros de rede não.
    const detalhe = await error.context?.json?.().catch(() => null);
    throw new Error(detalhe?.erro || "Não foi possível falar com o serviço de pagamentos. Tenta outra vez.");
  }
  return data;
}

export const comissaoDe = (valor) => Math.round(valor * COMISSAO * 100) / 100;

const notaTestes = emTestes
  ? "\n\nModo de testes: o PayPal está em sandbox e nenhum dinheiro real é cobrado."
  : "";

/** O cliente aceita a proposta pagando-a. Leva a pessoa ao PayPal. */
export async function pagarProposta(proposta, nome) {
  const valor = dinheiro(proposta.valor, proposta.moeda);
  const sim = await confirmar({
    titulo: `Aceitar e pagar ${valor}?`,
    texto:
      `Vais pagar a proposta de ${nome} pelo PayPal. O dinheiro fica retido pela Work on Pan e só é enviado ` +
      `ao freelancer quando confirmares que recebeste o trabalho.\n\nO projeto passa a «Em andamento» e as ` +
      `outras propostas ficam fechadas assim que o pagamento for confirmado.` + notaTestes,
    sim: "Continuar para o PayPal",
  });
  if (!sim) return;
  try {
    const { url } = await pedir("criar", proposta.id);
    location.href = url;
  } catch (e) {
    avisar(e.message, "erro");
  }
}

/** O cliente confirma a entrega: o pagamento é enviado ao freelancer. */
export async function libertarPagamento(pagamento, nome) {
  const sim = await confirmar({
    titulo: "Confirmar a entrega?",
    texto:
      `Confirma só depois de teres recebido o trabalho final. ${nome} recebe ` +
      `${dinheiro(pagamento.valor_freelancer, pagamento.moeda)} no PayPal (o valor da proposta menos 8 % de comissão) ` +
      `e o projeto fica concluído. Não é possível desfazer.` + notaTestes,
    sim: "Confirmar e libertar o pagamento",
  });
  if (!sim) return false;
  try {
    await pedir("libertar", pagamento.id);
    avisar("Pagamento libertado. Projeto concluído — bom trabalho!", "ok", { vapor: true });
    return true;
  } catch (e) {
    avisar(e.message, "erro");
    return false;
  }
}

/**
 * Ao voltar do PayPal (/painel?pagamento=…), confirma o pagamento e limpa o endereço.
 * @returns {Promise<boolean>} se havia um regresso a tratar
 */
export async function tratarRegressoPayPal() {
  const u = new URL(location.href);
  const id = u.searchParams.get("pagamento");
  if (!id) return false;
  const cancelado = u.searchParams.has("cancelado");
  for (const p of ["pagamento", "cancelado", "token", "PayerID", "ba_token"]) u.searchParams.delete(p);
  history.replaceState(null, "", u);

  if (cancelado) {
    avisar("Pagamento cancelado. A proposta continua à espera da tua resposta.");
    return true;
  }
  try {
    const { estado } = await pedir("capturar", id);
    if (estado === "reembolsado") {
      avisar("O projeto já não estava a receber propostas, por isso o pagamento foi devolvido.", "erro");
    } else {
      avisar("Pagamento confirmado e retido. O projeto começou!", "ok", { vapor: true });
    }
  } catch (e) {
    avisar(e.message, "erro");
  }
  return true;
}

/** Linha de estado do pagamento de um projeto, para cliente ou freelancer. */
export function linhaPagamento(pagamento, souFreelancer) {
  if (!pagamento) return nothing;
  const textos = {
    retido: souFreelancer
      ? `Pagamento garantido: recebes ${dinheiro(pagamento.valor_freelancer, pagamento.moeda)} quando o cliente confirmar a entrega.`
      : `Pagaste ${dinheiro(pagamento.valor, pagamento.moeda)}. O dinheiro está retido até confirmares a entrega.`,
    libertado: souFreelancer
      ? `Recebeste ${dinheiro(pagamento.valor_freelancer, pagamento.moeda)} no PayPal.`
      : `Pagamento de ${dinheiro(pagamento.valor, pagamento.moeda)} enviado ao freelancer.`,
    reembolsado: `Pagamento de ${dinheiro(pagamento.valor, pagamento.moeda)} devolvido ao cliente.`,
  };
  const texto = textos[pagamento.estado];
  if (!texto) return nothing;
  return html`<p class="linha-pagamento estado-${pagamento.estado}">
    <wop-icone nome=${pagamento.estado === "libertado" ? "aceitar" : "escudo"}></wop-icone><span>${texto}</span>
    ${emTestes ? html`<span class="selo-testes">sandbox</span>` : nothing}
  </p>`;
}

/** O pagamento que conta (retido, libertado ou reembolsado) de uma lista. */
export const pagamentoAtivo = (lista = []) =>
  lista.find((p) => p.estado === "retido") || lista.find((p) => p.estado === "libertado") || lista.find((p) => p.estado === "reembolsado");

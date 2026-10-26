// Work on Pan — função «pagamentos» (Supabase Edge Function, Deno).
//
// É a única peça que fala com o PayPal e a única que escreve na tabela `pagamentos`.
// O browser chama-a com a sessão da pessoa: { acao: "criar" | "capturar" | "libertar", ... }.
//
//   criar     → prepara o pagamento de uma proposta e devolve o endereço do PayPal para pagar.
//   capturar  → depois de a pessoa aprovar no PayPal, recebe o dinheiro (fica retido) e aceita a proposta.
//   libertar  → o cliente confirma a entrega: envia ao freelancer o valor menos 8 % (PayPal Payouts).
//
// Segredos (Supabase → Edge Functions → Secrets):
//   PAYPAL_CLIENT_ID, PAYPAL_SECRET   credenciais da app PayPal (sandbox ou live)
//   PAYPAL_AMBIENTE                   "sandbox" (por omissão) ou "live"
//   SITE_URL                          https://work-on-pan.vercel.app
//   SITE_ORIGENS_EXTRA                (opcional) outras origens permitidas, separadas por vírgulas
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são postos pelo próprio Supabase.

import { createClient } from "jsr:@supabase/supabase-js@2";

const AMBIENTE = Deno.env.get("PAYPAL_AMBIENTE") === "live" ? "live" : "sandbox";
const PAYPAL = AMBIENTE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const SITE = (Deno.env.get("SITE_URL") || "https://work-on-pan.vercel.app").replace(/\/$/, "");
const ORIGENS = [SITE, ...(Deno.env.get("SITE_ORIGENS_EXTRA") || "").split(",").map((s) => s.trim()).filter(Boolean)];

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

/** Erro com mensagem para mostrar à pessoa (em português). */
class ErroVisivel extends Error {}

// ── CORS: só o próprio site pode chamar ──────────────────────────────

function origemPermitida(req: Request) {
  const o = req.headers.get("origin") || "";
  return ORIGENS.includes(o) ? o : SITE;
}

function resposta(req: Request, corpo: unknown, estado = 200) {
  return new Response(JSON.stringify(corpo), {
    status: estado,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origemPermitida(req),
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    },
  });
}

// ── PayPal ───────────────────────────────────────────────────────────

let token: { valor: string; expira: number } | null = null;

async function tokenPayPal() {
  if (token && token.expira > Date.now() + 60_000) return token.valor;
  const id = Deno.env.get("PAYPAL_CLIENT_ID");
  const segredo = Deno.env.get("PAYPAL_SECRET");
  if (!id || !segredo) throw new ErroVisivel("Os pagamentos ainda não estão configurados.");
  const r = await fetch(`${PAYPAL}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${segredo}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error(`PayPal token ${r.status}: ${await r.text()}`);
  const j = await r.json();
  token = { valor: j.access_token, expira: Date.now() + j.expires_in * 1000 };
  return token.valor;
}

/** Pedido à API do PayPal. `idempotencia` evita cobrar duas vezes se o pedido for repetido. */
async function paypal(caminho: string, corpo?: unknown, idempotencia?: string, metodo = "POST") {
  const r = await fetch(`${PAYPAL}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${await tokenPayPal()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(idempotencia && { "PayPal-Request-Id": idempotencia }),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  const json = texto ? JSON.parse(texto) : {};
  return { ok: r.ok, estado: r.status, json };
}

const valorPayPal = (n: number) => Number(n).toFixed(2);

// ── Ações ────────────────────────────────────────────────────────────

async function criar(req: Request, uid: string, propostaId: string) {
  const { data: pag, error } = await admin.rpc("pagamento_preparar", { p_proposta: propostaId, p_cliente: uid });
  if (error) throw new ErroVisivel(error.message);
  const { data: projeto } = await admin.from("projetos").select("titulo").eq("id", pag.projeto_id).single();

  const origem = origemPermitida(req);
  const { ok, json } = await paypal(
    "/v2/checkout/orders",
    {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: pag.id,
        custom_id: pag.id,
        description: `Work on Pan — ${projeto?.titulo || "projeto"}`.slice(0, 127),
        amount: { currency_code: pag.moeda, value: valorPayPal(pag.valor) },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Work on Pan",
            locale: "pt-PT",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${origem}/painel?pagamento=${pag.id}`,
            cancel_url: `${origem}/painel?pagamento=${pag.id}&cancelado=1`,
          },
        },
      },
    },
    `ordem-${pag.id}`,
  );
  if (!ok) throw new Error(`PayPal ordem: ${JSON.stringify(json)}`);

  await admin.from("pagamentos").update({ paypal_ordem: json.id }).eq("id", pag.id);
  const ligacao = json.links?.find((l: { rel: string }) => l.rel === "payer-action" || l.rel === "approve");
  if (!ligacao) throw new Error("PayPal não devolveu o endereço de pagamento.");
  return { url: ligacao.href };
}

async function capturar(uid: string, pagamentoId: string) {
  const { data: pag } = await admin.from("pagamentos").select("*").eq("id", pagamentoId).eq("cliente_id", uid).maybeSingle();
  if (!pag) throw new ErroVisivel("Pagamento não encontrado.");
  if (pag.estado === "retido" || pag.estado === "libertado") return { estado: pag.estado };
  if (pag.estado !== "pendente" || !pag.paypal_ordem) throw new ErroVisivel("Este pagamento já não está ativo.");

  let { ok, json } = await paypal(`/v2/checkout/orders/${pag.paypal_ordem}/capture`, {}, `captura-${pag.id}`);
  // Já capturado antes (por exemplo, a página foi recarregada): lê o estado da ordem.
  if (!ok && JSON.stringify(json).includes("ORDER_ALREADY_CAPTURED")) {
    ({ ok, json } = await paypal(`/v2/checkout/orders/${pag.paypal_ordem}`, undefined, undefined, "GET"));
  }
  if (!ok) {
    if (JSON.stringify(json).includes("ORDER_NOT_APPROVED")) throw new ErroVisivel("O pagamento não foi concluído no PayPal.");
    throw new Error(`PayPal captura: ${JSON.stringify(json)}`);
  }

  const captura = json.purchase_units?.[0]?.payments?.captures?.[0];
  if (json.status !== "COMPLETED" || !captura || captura.status !== "COMPLETED") {
    throw new ErroVisivel("O PayPal ainda não confirmou este pagamento. Tenta daqui a pouco.");
  }
  // O valor recebido tem de ser exatamente o combinado.
  if (captura.amount.currency_code !== pag.moeda || captura.amount.value !== valorPayPal(pag.valor)) {
    throw new Error(`Valor capturado diferente: ${JSON.stringify(captura.amount)}`);
  }

  const { data: resultado, error } = await admin.rpc("pagamento_confirmar", { p_pagamento: pag.id, p_captura: captura.id });
  if (error) throw new Error(error.message);

  if (resultado === "reembolsar") {
    // Entretanto o projeto deixou de aceitar propostas: devolve o dinheiro.
    const r = await paypal(`/v2/payments/captures/${captura.id}/refund`, {}, `reembolso-${pag.id}`);
    if (!r.ok) throw new Error(`PayPal reembolso: ${JSON.stringify(r.json)}`);
    await admin.rpc("pagamento_reembolsado", { p_pagamento: pag.id });
    return { estado: "reembolsado" };
  }
  return { estado: "retido" };
}

async function libertar(uid: string, pagamentoId: string) {
  const { data: pag } = await admin.from("pagamentos").select("*").eq("id", pagamentoId).eq("cliente_id", uid).maybeSingle();
  if (!pag) throw new ErroVisivel("Pagamento não encontrado.");
  if (pag.estado === "libertado") return { estado: "libertado" };
  if (pag.estado !== "retido") throw new ErroVisivel("Este pagamento não está retido.");

  const { data: conta } = await admin.from("contas").select("paypal_email").eq("id", pag.freelancer_id).single();
  if (!conta?.paypal_email) {
    const { data: conversa } = await admin.from("conversas").select("id")
      .eq("cliente_id", pag.cliente_id).eq("freelancer_id", pag.freelancer_id).eq("projeto_id", pag.projeto_id).maybeSingle();
    if (conversa) {
      await admin.from("mensagens").insert({
        conversa_id: conversa.id, autor_id: null,
        texto: "O cliente quer libertar o pagamento, mas falta o teu e-mail PayPal. Indica-o em «A minha conta» → «Dados privados».",
      });
    }
    throw new ErroVisivel("O freelancer ainda não indicou o e-mail PayPal. Avisámo-lo na conversa; tenta de novo depois.");
  }

  const { ok, json } = await paypal("/v1/payments/payouts", {
    sender_batch_header: {
      sender_batch_id: pag.id, // o PayPal recusa um segundo envio com o mesmo id
      email_subject: "Recebeste um pagamento do Work on Pan",
      email_message: "O cliente confirmou a entrega do projeto. Obrigado pelo bom trabalho!",
    },
    items: [{
      recipient_type: "EMAIL",
      receiver: conta.paypal_email,
      amount: { value: valorPayPal(pag.valor_freelancer), currency: pag.moeda },
      note: "Pagamento de projeto no Work on Pan (valor menos 8 % de comissão).",
      sender_item_id: pag.id,
    }],
  });
  if (!ok) throw new Error(`PayPal envio: ${JSON.stringify(json)}`);

  const { error } = await admin.rpc("pagamento_libertado", { p_pagamento: pag.id, p_envio: json.batch_header.payout_batch_id });
  if (error) throw new Error(error.message);
  return { estado: "libertado" };
}

// ── Entrada ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return resposta(req, {});
  if (req.method !== "POST") return resposta(req, { erro: "Método não permitido." }, 405);

  try {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
    const { data } = await admin.auth.getUser(jwt);
    if (!data.user) return resposta(req, { erro: "Sessão necessária." }, 401);

    const corpo = await req.json().catch(() => ({}));
    const id = String(corpo.proposta || corpo.pagamento || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroVisivel("Pedido inválido.");

    switch (corpo.acao) {
      case "criar": return resposta(req, await criar(req, data.user.id, id));
      case "capturar": return resposta(req, await capturar(data.user.id, id));
      case "libertar": return resposta(req, await libertar(data.user.id, id));
      default: throw new ErroVisivel("Ação desconhecida.");
    }
  } catch (e) {
    if (e instanceof ErroVisivel) return resposta(req, { erro: e.message }, 400);
    console.error("[pagamentos]", e);
    return resposta(req, { erro: "Não foi possível falar com o PayPal. Tenta outra vez daqui a pouco." }, 502);
  }
});

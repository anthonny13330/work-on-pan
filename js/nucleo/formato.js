// Constantes do domínio e funções de apresentação (sem DOM).

export const CATEGORIAS = {
  design: "Design e UI/UX",
  dev: "Desenvolvimento web e apps",
  marketing: "Marketing digital",
  redacao: "Redação e conteúdo",
  video: "Vídeo e animação",
  dados: "Dados e análise",
  outro: "Outro",
};

export const MOEDAS = { EUR: "Euro (€)", BRL: "Real (R$)", USD: "Dólar (US$)", GBP: "Libra (£)" };

export const ESTADOS_PROJETO = {
  aberto: { texto: "A receber propostas", classe: "etiqueta-ok" },
  em_andamento: { texto: "Em andamento", classe: "etiqueta-aviso" },
  concluido: { texto: "Concluído", classe: "etiqueta-neutra" },
  fechado: { texto: "Fechado", classe: "etiqueta-neutra" },
};

export const ESTADOS_PROPOSTA = {
  pendente: { texto: "À espera de resposta", classe: "etiqueta-aviso" },
  aceite: { texto: "Aceite", classe: "etiqueta-ok" },
  recusada: { texto: "Recusada", classe: "etiqueta-perigo" },
  retirada: { texto: "Retirada", classe: "etiqueta-neutra" },
  fechada: { texto: "Projeto fechado", classe: "etiqueta-neutra" },
};

const formatosMoeda = new Map();

export function dinheiro(valor, moeda = "EUR") {
  if (valor === undefined || valor === null || valor === "") return "A combinar";
  if (!formatosMoeda.has(moeda)) {
    formatosMoeda.set(
      moeda,
      new Intl.NumberFormat("pt-PT", { style: "currency", currency: moeda, maximumFractionDigits: 0 })
    );
  }
  return formatosMoeda.get(moeda).format(valor);
}

const relativo = new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" });

export function dataCurta(valor) {
  if (!valor) return "agora mesmo";
  const d = new Date(valor);
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (dias < 7) return relativo.format(-dias, "day");
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}

export function horaCurta(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  return new Date().toDateString() === d.toDateString()
    ? d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}

export const nomeCategoria = (chave) => CATEGORIAS[chave] || chave || "Outro";

export const iniciais = (nome) =>
  (nome || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

export const nomeCompleto = (p) => [p?.nome, p?.sobrenome].filter(Boolean).join(" ") || "Utilizador";

// Um cliente aparece pelo nome da empresa, se tiver.
export const nomeCliente = (p) => p?.empresa || nomeCompleto(p);

export const listaCompetencias = (texto, maximo) =>
  texto
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, maximo);

export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const ERROS = {
  invalid_credentials: "E-mail ou palavra-passe incorretos.",
  email_not_confirmed: "Ainda não confirmaste o e-mail. Abre o link que te enviámos.",
  user_already_exists: "Já existe uma conta com este e-mail. Experimenta entrar.",
  email_exists: "Já existe uma conta com este e-mail. Experimenta entrar.",
  weak_password: "A palavra-passe é demasiado fraca. Usa pelo menos 8 caracteres.",
  over_request_rate_limit: "Muitas tentativas seguidas. Espera um pouco e tenta de novo.",
  over_email_send_rate_limit: "Já enviámos vários e-mails. Espera uns minutos e tenta de novo.",
  same_password: "A nova palavra-passe tem de ser diferente da atual.",
  validation_failed: "Há um campo com um valor inválido.",
  23514: "Há um campo com um valor fora dos limites permitidos.",
  23505: "Isto já existe.",
  42501: "Não tens permissão para esta ação.",
};

export function traduzirErro(e) {
  if (!e) return "Algo correu mal. Tenta outra vez.";
  // As funções da base de dados já lançam mensagens em português.
  if (e.code === "P0001") return e.message;
  if (ERROS[e.code]) return ERROS[e.code];
  if (/fetch|network/i.test(e.message || "")) return "Sem ligação ao servidor. Verifica a internet.";
  return "Algo correu mal. Tenta outra vez.";
}

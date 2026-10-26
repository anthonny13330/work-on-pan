// Configuração pública. A chave «publishable» pode estar no browser:
// a segurança está nas políticas RLS e nas funções de supabase/esquema.sql.
export const SUPABASE_URL = "https://dsxsvnzcrouazkkdbpym.supabase.co";
export const SUPABASE_CHAVE_PUBLICA = "sb_publishable_QjkIhpoe1K9AZO_nTUXO0A_LaE2gTqP";

// Preencher antes de lançar (aparecem na política de privacidade e no rodapé).
export const RESPONSAVEL_DADOS = "Anthonny Alé";
export const CONTACTO_PRIVACIDADE = "13330@aecidadela.pt";

// Pagamentos pela plataforma (PayPal). Enquanto for "sandbox", nenhum dinheiro é real.
// A comissão aqui só serve para mostrar valores: quem a aplica é a base de dados (02_pagamentos_e_imagens.sql).
export const PAGAMENTOS_MODO = "sandbox";
export const COMISSAO = 0.05;

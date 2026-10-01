import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICA } from "../config.js";

// window.supabase vem de /vendor/supabase/supabase.js (carregado antes, com defer).
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA);

// Devolve os dados ou lança o erro de uma resposta do Supabase.
export function ok({ data, error }) {
  if (error) throw error;
  return data;
}

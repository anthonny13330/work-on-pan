// Imagens de perfil e de portfólio (Supabase Storage).
// Antes de enviar, cada imagem é reduzida e convertida para WebP no próprio browser:
// uma fotografia de telemóvel com 4 MB passa a ~150 KB e a página carrega muito mais depressa.
import { sb } from "./supabase.js";

export const PASTAS = { avatar: "avatares", portfolio: "portfolio" };

const TIPOS = ["image/jpeg", "image/png", "image/webp"];

/** Endereço público de uma imagem guardada (ou "" se não houver). */
export function urlImagem(pasta, caminho) {
  if (!caminho) return "";
  return sb.storage.from(pasta).getPublicUrl(caminho).data.publicUrl;
}

/**
 * Reduz a imagem para caber em `lado` × `lado` e converte para WebP.
 * Com `quadrada`, corta ao centro (para fotografias de perfil).
 */
export async function reduzirImagem(ficheiro, { lado = 1600, quadrada = false, qualidade = 0.82 } = {}) {
  if (!TIPOS.includes(ficheiro.type)) throw new Error("Escolhe uma imagem JPG, PNG ou WebP.");
  if (ficheiro.size > 15 * 1024 * 1024) throw new Error("A imagem é demasiado grande (máximo 15 MB).");

  const bitmap = await createImageBitmap(ficheiro);
  let { width: w, height: h } = bitmap;
  let sx = 0, sy = 0, sw = w, sh = h;
  if (quadrada) {
    const m = Math.min(w, h);
    sx = (w - m) / 2;
    sy = (h - m) / 2;
    sw = sh = w = h = m;
  }
  const escala = Math.min(1, lado / Math.max(w, h));
  const tela = document.createElement("canvas");
  tela.width = Math.round(w * escala);
  tela.height = Math.round(h * escala);
  tela.getContext("2d").drawImage(bitmap, sx, sy, sw, sh, 0, 0, tela.width, tela.height);
  bitmap.close();

  const blob = await new Promise((r) => tela.toBlob(r, "image/webp", qualidade));
  if (!blob) throw new Error("Não foi possível preparar a imagem.");
  return blob;
}

/** Envia para <pasta>/<id da pessoa>/<nome>.webp e devolve o caminho guardado. */
export async function enviarImagem(pasta, uid, blob, nome) {
  const caminho = `${uid}/${nome}.webp`;
  const { error } = await sb.storage.from(pasta).upload(caminho, blob, { contentType: "image/webp", upsert: true });
  if (error) throw error;
  return caminho;
}

export async function apagarImagem(pasta, caminho) {
  if (!caminho) return;
  await sb.storage.from(pasta).remove([caminho]);
}

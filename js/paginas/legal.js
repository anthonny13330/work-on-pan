import "../arranque.js";
import { RESPONSAVEL_DADOS, CONTACTO_PRIVACIDADE } from "../config.js";
import { $$ } from "../nucleo/ui.js";

for (const el of $$("[data-responsavel]")) el.textContent = RESPONSAVEL_DADOS;
for (const el of $$("[data-contacto]")) {
  el.textContent = CONTACTO_PRIVACIDADE;
  el.href = `mailto:${CONTACTO_PRIVACIDADE}`;
}

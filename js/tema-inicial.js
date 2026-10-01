// Corre antes de a página aparecer, para não piscar no tema errado.
try {
  var t = localStorage.getItem("wop_tema");
  if (t === "claro") document.documentElement.dataset.theme = "light";
  if (t === "escuro") document.documentElement.dataset.theme = "dark";
} catch (e) {}

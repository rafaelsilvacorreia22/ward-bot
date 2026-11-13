// Peças do layout novo de mensagem do Discord ("Components V2"): um bloco
// com faixa colorida na lateral onde entram, na ordem que quisermos, texto
// com títulos (#, ##), galerias de imagem, divisórias e botões. É o formato
// dos posts bonitos de outros bots — o embed antigo só permite uma imagem,
// sempre no fim.
//
// Regras do Discord que valem aqui:
// - mensagem com este formato não pode ter `content` nem `embeds`;
// - no máximo 40 peças no total e 4.000 caracteres de texto somando tudo;
// - link solto no texto NÃO vira prévia (por isso o vídeo do YouTube continua
//   no formato antigo — é a prévia que mostra o player).

export const FLAG_V2 = 1 << 15;

export const CORES = {
  patch: 0x0ac8b9,
  noticia: 0xc8a24a,
  promocao: 0x2fbba0,
  skins: 0xe3418c,
  video: 0xff0033,
};

export const texto = (content) => ({ type: 10, content: String(content).slice(0, 4000) });

export const divisoria = (grande = false) => ({ type: 14, divider: true, spacing: grande ? 2 : 1 });

// Até 10 imagens; o Discord monta a grade sozinho (1 grande, 2 lado a lado...).
// Sem `description`: com ela o Discord põe uma etiqueta "ALT" em cima de cada
// imagem, e o nome já aparece no texto ao lado.
export function galeria(imagens) {
  const itens = imagens
    .filter((i) => i?.url)
    .slice(0, 10)
    .map((i) => ({ media: { url: i.url } }));
  return itens.length ? { type: 12, items: itens } : null;
}

export const botaoLink = (rotulo, url) => ({ type: 2, style: 5, label: rotulo.slice(0, 80), url });

export const linhaDeBotoes = (...botoes) => ({ type: 1, components: botoes.filter(Boolean).slice(0, 5) });

// Mensagem completa: um bloco com a cor do tipo de aviso. Peças nulas (uma
// galeria sem imagem, por exemplo) são descartadas, e divisórias seguidas ou
// nas pontas também — assim quem monta não precisa se preocupar com seção
// vazia.
export function mensagemEmBloco(cor, pecas) {
  const limpas = [];
  for (const p of pecas.filter(Boolean)) {
    if (p.type === 14 && (!limpas.length || limpas[limpas.length - 1].type === 14)) continue;
    limpas.push(p);
  }
  while (limpas.length && limpas[limpas.length - 1].type === 14) limpas.pop();
  return {
    flags: FLAG_V2,
    components: [{ type: 17, accent_color: cor, components: limpas.slice(0, 38) }],
  };
}

// Corta no fim de frase mais próximo do limite, para não terminar no meio de
// uma palavra.
export function resumir(textoLongo, limite) {
  const t = String(textoLongo ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= limite) return t;
  const corte = t.slice(0, limite);
  const fimFrase = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("! "), corte.lastIndexOf("? "));
  return fimFrase > limite * 0.5 ? corte.slice(0, fimFrase + 1) : `${corte.slice(0, corte.lastIndexOf(" "))}…`;
}

// Cada linha vira citação (o "> " do Discord vale só para a linha).
export const citar = (t) =>
  String(t)
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");

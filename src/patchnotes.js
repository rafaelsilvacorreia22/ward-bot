// Lê a página oficial das notas do patch em português e monta o post do
// aviso de patch no layout novo (ver visual.js): arte do patch, introdução,
// o infográfico de destaques da Riot, campeões e itens alterados, o que mais
// mudou e as skins novas com a arte.
//
// A página é HTML comum (não há API das notas). A leitura procura só marcas
// estáveis do artigo — títulos h2, "change-title" (campeão/item),
// "change-detail-title" (habilidade), "skin-title" — e qualquer parte que
// não for encontrada simplesmente some do post. Se a página inteira falhar,
// quem chama cai no aviso simples de antes.

import { versaoPublica } from "./riot.js";
import { CORES, texto, divisoria, galeria, botaoLink, linhaDeBotoes, mensagemEmBloco, resumir, citar } from "./visual.js";

const CABECALHO = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

export function urlNotasPt(versao) {
  const [major, minor] = versaoPublica(versao).split(".");
  return `https://www.leagueoflegends.com/pt-br/news/game-updates/league-of-legends-patch-${major}-${minor}-notes/`;
}

function limpar(html) {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .replace(/\s+([:,.;!?])/g, "$1")
    .trim();
}

// Seções que já têm lugar próprio no post (ou que não interessam).
const SECOES_PROPRIAS = /^(destaques|campe|itens|cromas|skins|artigos relacionados)/i;

export function lerNotas(html) {
  const notas = {
    banner: null,
    intro: null,
    destaques: null,
    campeoes: [],
    itens: [],
    outras: [],
    skins: [],
  };
  notas.banner = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1]?.replace(/&amp;/g, "&").split("?")[0] ?? null;
  notas.intro = limpar(/<meta name="description" content="([^"]+)"/.exec(html)?.[1]);

  const inicio = html.indexOf("patch-notes-container");
  if (inicio < 0) return notas;
  const fim = html.indexOf("Artigos relacionados", inicio);
  const corpo = html.slice(inicio, fim > 0 ? fim : undefined);

  const marcas =
    /<h2[^>]*>([\s\S]*?)<\/h2>|<h3[^>]*change-title[^>]*>([\s\S]*?)<\/h3>|<h4[^>]*(change-detail-title|skin-title)[^>]*>([\s\S]*?)<\/h4>|<li[^>]*>([\s\S]*?)<\/li>|<img[^>]*src="(https:[^"]+)"/g;
  let secao = "";
  let ultimaImagem = null;
  let atual = null; // campeão ou item que está sendo lido
  let m;
  while ((m = marcas.exec(corpo))) {
    if (m[1] !== undefined) {
      secao = limpar(m[1]);
      atual = null;
      ultimaImagem = null;
      if (secao && !SECOES_PROPRIAS.test(secao)) notas.outras.push(secao);
    } else if (m[2] !== undefined) {
      const nome = limpar(m[2]);
      if (/^campe/i.test(secao)) notas.campeoes.push((atual = { nome, partes: [] }));
      else if (/^itens/i.test(secao)) notas.itens.push((atual = { nome, linha: null }));
      else atual = null;
    } else if (m[3] !== undefined) {
      const titulo = limpar(m[4]);
      if (m[3] === "skin-title") {
        // Croma vem com a variação entre parênteses no fim ("(Vívido)") e
        // fica de fora — o post é das skins.
        if (ultimaImagem && !/\)\s*$/.test(titulo)) notas.skins.push({ nome: titulo, imagem: ultimaImagem });
      } else if (atual?.partes) {
        // "Q – Pregos Ritualísticos" vira "Q"; "Atributos base" vira "atributos".
        const tecla = /^(Passiva|[QWER])\s*[–-]/.exec(titulo)?.[1] ?? (/atributo/i.test(titulo) ? "atributos" : titulo.split(/\s+[–-]\s+/)[0]);
        if (!atual.partes.includes(tecla)) atual.partes.push(tecla);
      }
    } else if (m[5] !== undefined) {
      if (atual && "linha" in atual && !atual.linha) atual.linha = limpar(m[5]);
    } else if (m[6] !== undefined) {
      ultimaImagem = m[6];
      if (/^destaques/i.test(secao) && !notas.destaques && /cmsassets|rgpub/.test(m[6])) notas.destaques = m[6];
    }
  }
  return notas;
}

export async function buscarNotas(versao) {
  const url = urlNotasPt(versao);
  const res = await fetch(url, { headers: CABECALHO });
  if (!res.ok) throw new Error(`Notas do patch em português -> ${res.status}`);
  const notas = lerNotas(await res.text());
  if (!notas.campeoes.length && !notas.destaques && !notas.intro) {
    throw new Error("Não reconheci o conteúdo da página de notas (a Riot mudou o layout?)");
  }
  return { url, ...notas };
}

const MAX_CAMPEOES = 24;
const MAX_ITENS = 8;
const MAX_SKINS_COM_ARTE = 4;

export function mensagemDoPatch(versao, notas) {
  const numero = versaoPublica(versao).split(".").slice(0, 2).join(".");

  const campeoes = notas.campeoes.slice(0, MAX_CAMPEOES).map((c) => `**${c.nome}**${c.partes.length ? ` · ${c.partes.join(", ")}` : ""}`);
  if (notas.campeoes.length > MAX_CAMPEOES) campeoes.push(`…e mais ${notas.campeoes.length - MAX_CAMPEOES}.`);

  const itens = notas.itens
    .slice(0, MAX_ITENS)
    .map((i) => `**${i.nome}**${i.linha ? `\n-# ${resumir(i.linha, 110)}` : ""}`);

  const skins = notas.skins.slice(0, 12);

  return mensagemEmBloco(CORES.patch, [
    notas.banner && galeria([{ url: notas.banner, descricao: `Patch ${numero}` }]),
    texto(`# Patch ${numero}\n${notas.intro ? citar(resumir(notas.intro, 450)) : "As notas do novo patch saíram!"}`),
    divisoria(),
    notas.destaques && texto("## Destaques da atualização"),
    notas.destaques && galeria([{ url: notas.destaques, descricao: `Destaques do patch ${numero}` }]),
    divisoria(),
    campeoes.length && texto(`## Campeões\n${campeoes.join("\n")}`),
    itens.length && texto(`## Itens\n${itens.join("\n")}`),
    notas.outras.length && texto(`## Também nesta atualização\n${notas.outras.map((s) => `• ${s}`).join("\n")}`),
    divisoria(),
    skins.length && texto(`## Skins novas\n${skins.map((s) => `• ${s.nome}`).join("\n")}`),
    skins.length && galeria(skins.slice(0, MAX_SKINS_COM_ARTE).map((s) => ({ url: s.imagem, descricao: s.nome }))),
    divisoria(),
    linhaDeBotoes(botaoLink("Ler as notas completas", notas.url)),
  ]);
}

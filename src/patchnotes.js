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
import { SITE } from "./discord.js";
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

  // Introdução de verdade: o primeiro bloco de citação do artigo (o texto
  // da equipe do patch), que é mais completo que a descrição curta da
  // página. Às vezes ele começa com uma brincadeira (versinho) separada do
  // texto por um espaço duro; nesse caso fica só a parte final.
  // Antes do primeiro título pode haver mais de uma citação (ex.: "Errou as
  // notas? As do TFT estão aqui"): vale a mais longa.
  const antesDoPrimeiroTitulo = corpo.slice(0, corpo.search(/<h2/) > 0 ? corpo.search(/<h2/) : undefined);
  const citacoes = [...antesDoPrimeiroTitulo.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g)].map((c) => c[1]);
  const principal = citacoes.sort((a, b) => limpar(b).length - limpar(a).length)[0];
  if (principal) {
    // A citação junta trechos separados por espaço duro: versinho, o texto
    // principal, link da wiki, "errou as notas?". Fica o trecho mais longo.
    const partes = principal.split(/&nbsp;|<br\s*\/?>\s*<br\s*\/?>|<\/p>\s*<p[^>]*>/).map(limpar).filter((p) => p.length >= 80);
    if (partes.length) notas.intro = partes.sort((a, b) => b.length - a.length)[0];
  }

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
      if (/^campe/i.test(secao)) notas.campeoes.push((atual = { nome, partes: [], linha: null, tecla: null }));
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
        if (!atual.tecla) atual.tecla = tecla;
      }
    } else if (m[5] !== undefined) {
      // A primeira mudança de cada campeão/item vira o exemplo no post.
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

// ---------- arte do patch ----------
//
// A arte do topo do post é montada pelo serviço de imagens da Cloudflare
// (o Worker em si não tem tempo de processamento para isso no plano grátis):
// por baixo, a arte oficial do patch; por cima, uma camada transparente pronta
// (public/arte/patch-base.png: sombra, "NOTAS DA ATUALIZAÇÃO", "PATCH",
// "LEAGUE OF LEGENDS" e a logo do Ward) e o número do patch, algarismo por
// algarismo (public/arte/d0.png ... d9.png e dponto.png, todos gerados com a
// mesma fonte do site). As posições abaixo saíram da medição dessas imagens.
const NUMERO_X = 423;
const NUMERO_Y = 215;
const LARGURA_ALGARISMO = 76;
const LARGURA_PONTO = 39;

export function camadasDaArte(site, numero) {
  const camadas = [{ url: `${site}/arte/patch-base.png`, top: 0, left: 0 }];
  let x = NUMERO_X;
  for (const c of numero) {
    if (c === ".") {
      camadas.push({ url: `${site}/arte/dponto.png`, top: NUMERO_Y, left: x });
      x += LARGURA_PONTO;
    } else if (/\d/.test(c)) {
      camadas.push({ url: `${site}/arte/d${c}.png`, top: NUMERO_Y, left: x });
      x += LARGURA_ALGARISMO;
    }
  }
  return camadas;
}

// Endereço da arte montada (ver a rota /arte/patch em index.js). Só aceita
// fundo vindo dos servidores de imagem da Riot.
export const FUNDO_PERMITIDO = /^https:\/\/cmsassets\.rgpub\.io\//;
export const urlArteDoPatch = (site, numero, fundo) =>
  `${site}/arte/patch/${numero}.jpg?fundo=${encodeURIComponent(fundo)}`;

export function mensagemDoPatch(versao, notas) {
  const numero = versaoPublica(versao).split(".").slice(0, 2).join(".");
  // Fundo: a arte da primeira skin nova do patch (costuma ser a da coleção
  // em destaque, com vários campeões) ou, sem skin, a imagem do artigo.
  const fundo = [notas.skins[0]?.imagem, notas.banner].find((u) => u && FUNDO_PERMITIDO.test(u));
  const arte = fundo ? urlArteDoPatch(SITE, numero, fundo) : notas.banner;

  // Cada campeão com o que mudou e, embaixo em letra pequena, a primeira
  // mudança como exemplo ("R · Dano: 90/170/250 ⇒ 100/190/280"). O Discord
  // limita o texto do post inteiro a 4.000 caracteres: com muitos campeões,
  // o exemplo encurta e, no limite, some.
  const lista = notas.campeoes.slice(0, MAX_CAMPEOES);
  const tamanhoExemplo = lista.length > 18 ? 0 : lista.length > 12 ? 80 : 110;
  const campeoes = lista.map(
    (c) =>
      `**${c.nome}**${c.partes.length ? ` · ${c.partes.join(", ")}` : ""}` +
      (c.linha && tamanhoExemplo ? `\n-# ${c.tecla && c.tecla !== "atributos" ? `${c.tecla} · ` : ""}${resumir(c.linha, tamanhoExemplo)}` : "")
  );
  if (notas.campeoes.length > MAX_CAMPEOES) campeoes.push(`…e mais ${notas.campeoes.length - MAX_CAMPEOES}.`);

  const itens = notas.itens
    .slice(0, MAX_ITENS)
    .map((i) => `**${i.nome}**${i.linha ? `\n-# ${resumir(i.linha, 110)}` : ""}`);

  const skins = notas.skins.slice(0, 12);

  return mensagemEmBloco(CORES.patch, [
    arte && galeria([{ url: arte }]),
    texto(`# Patch ${numero}\n${notas.intro ? citar(resumir(notas.intro, 650)) : "As notas do novo patch saíram!"}`),
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

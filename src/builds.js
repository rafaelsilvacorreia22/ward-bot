// Builds do meta, vindas do OP.GG.
//
// Primeira versão: o próprio bot coletava partidas do topo do BR pela API da
// Riot. Não deu: o plano free do Worker limita a coleta a uns poucos milhares
// de partidas por dia, e no começo cada campeão tinha 1 ou 2 jogos — nada a
// ver com o que Porofessor e cia. mostram. Esses sites leem milhões de
// partidas por patch, com dezenas de servidores.
//
// O OP.GG publica essas mesmas estatísticas (dezenas de milhares de partidas
// por campeão, de todos os elos) numa API aberta, feita para integração:
// https://github.com/opgginc/opgg-mcp. u.gg, Porofessor e Mobalytics bloqueiam
// acesso automatizado, então não entram.

import { pegarEstado, salvarEstado, limparCacheAntigo, pegarCacheBuild, salvarCacheBuild } from "./db.js";

const DDRAGON = "https://ddragon.leagueoflegends.com";
const OPGG = "https://mcp-api.op.gg/mcp";

// Dois modos para quem usa: partida normal (Summoner's Rift) e ARAM. A
// ranqueada solo, a flex e a normal usam a mesma build no mesmo mapa, então
// tudo que é Summoner's Rift vira "partida normal" — e os números vêm da
// ranqueada do OP.GG, que é onde está a amostra grande (o OP.GG não tem
// estatística de partida normal). `opgg` é o game_mode pedido à API.
export const MODOS = {
  normal: { nome: "Partida normal", opgg: "ranked" },
  aram: { nome: "ARAM", opgg: "aram" },
};

export const ROTAS = {
  TOP: "Topo",
  JUNGLE: "Selva",
  MIDDLE: "Meio",
  BOTTOM: "Atirador",
  UTILITY: "Suporte",
};

// Nossa rota -> position do OP.GG, e o caminho de volta (o OP.GG responde
// "MID", "ADC" etc. em maiúsculas).
const POSICAO_OPGG = { TOP: "top", JUNGLE: "jungle", MIDDLE: "mid", BOTTOM: "adc", UTILITY: "support" };
const ROTA_DO_OPGG = { TOP: "TOP", JUNGLE: "JUNGLE", MID: "MIDDLE", ADC: "BOTTOM", SUPPORT: "UTILITY" };

// Os fragmentos de atributo não vêm no runesReforged.json do Data Dragon.
export const FRAGMENTOS = {
  5001: "Vida escalável",
  5005: "Velocidade de ataque",
  5007: "Aceleração de habilidade",
  5008: "Força adaptativa",
  5010: "Velocidade de movimento",
  5011: "Vida",
  5013: "Tenacidade e resistência a lentidão",
};

// ---------- dados estáticos (nomes e ícones em pt-BR) ----------

// item.json tem perto de 1 MB; o que o bot usa dele cabe em ~15 KB. Mesmo
// esquema do cache de campeões: em memória enquanto o isolate viver e no
// banco com a versão na chave.
const estaticosEmMemoria = new Map();

export async function dadosDoJogo(env, versao) {
  const emMemoria = estaticosEmMemoria.get(versao);
  if (emMemoria) return emMemoria;

  const chave = `estaticos_${versao}`;
  try {
    const guardado = await pegarEstado(env, chave);
    if (guardado) {
      const dados = JSON.parse(guardado);
      estaticosEmMemoria.set(versao, dados);
      return dados;
    }
  } catch (err) {
    console.log("Cache de dados do jogo ilegível, buscando de novo:", err.message);
  }

  const baixar = async (caminho) => {
    const res = await fetch(`${DDRAGON}${caminho}`);
    if (!res.ok) throw new Error(`Data Dragon (${caminho}) -> ${res.status}`);
    return res.json();
  };
  const [itensBrutos, runasBrutas, feiticosBrutos] = await Promise.all([
    baixar(`/cdn/${versao}/data/pt_BR/item.json`),
    baixar(`/cdn/${versao}/data/pt_BR/runesReforged.json`),
    baixar(`/cdn/${versao}/data/pt_BR/summoner.json`),
  ]);

  const itens = {};
  for (const [id, item] of Object.entries(itensBrutos.data)) {
    const tags = item.tags ?? [];
    const total = item.gold?.total ?? 0;
    let tipo = "componente";
    // Botas de nível 2 e 3 (as de nível 1 têm "from" vazio).
    if (tags.includes("Boots") && item.from?.length) tipo = "botas";
    // Item final: não vira mais nada e é caro. O piso de 2000 deixa de fora
    // os itens de início e os componentes soltos.
    else if (!item.into?.length && total >= 2000 && !tags.includes("Consumable")) tipo = "lendario";
    if (tipo === "componente" && total === 0) continue; // sentinela, poções grátis etc.
    itens[id] = { nome: item.name, tipo };
  }

  const runas = {};
  for (const arvore of runasBrutas) {
    runas[arvore.id] = { nome: arvore.name, icone: arvore.icon };
    for (const fileira of arvore.slots) {
      for (const runa of fileira.runes) runas[runa.id] = { nome: runa.name, icone: runa.icon };
    }
  }

  const feiticos = {};
  for (const feitico of Object.values(feiticosBrutos.data)) {
    feiticos[feitico.key] = { nome: feitico.name, imagem: feitico.image.full };
  }

  const dados = { itens, runas, feiticos };
  estaticosEmMemoria.set(versao, dados);
  try {
    await salvarEstado(env, chave, JSON.stringify(dados));
    await limparCacheAntigo(env, "estaticos_", chave);
  } catch (err) {
    console.log("Não consegui guardar os dados do jogo:", err.message);
  }
  return dados;
}

export function urlIconeItem(versao, id) {
  return `${DDRAGON}/cdn/${versao}/img/item/${id}.png`;
}

export function urlIconeRuna(icone) {
  return `${DDRAGON}/cdn/img/${icone}`;
}

export function urlIconeFeitico(versao, imagem) {
  return `${DDRAGON}/cdn/${versao}/img/spell/${imagem}`;
}

// ---------- OP.GG ----------

// O nome que o OP.GG espera é o id do Data Dragon em MAIÚSCULAS_COM_TRAÇO:
// "LeeSin" -> "LEE_SIN", "MonkeyKing" -> "MONKEY_KING".
function nomeOpgg(arquivoImagem) {
  return arquivoImagem.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

// A API responde num formato próprio, enxuto, em vez de JSON:
//
//   class Data: summary,core_items
//   class CoreItems: ids,play,win
//
//   LolGetChampionAnalysis(Data(Summary(...),CoreItems([3100,3157],5606,2809)))
//
// As linhas "class" dão o nome de cada campo na ordem; a última linha é o
// valor. Isto transforma tudo em objetos comuns.
export function lerFormatoOpgg(texto) {
  const campos = {};
  for (const [, nome, lista] of texto.matchAll(/^class (\w+): (.*)$/gm)) {
    campos[nome] = lista.split(",").map((c) => c.trim());
  }
  const expr = texto.slice(texto.lastIndexOf("\n\n") + 2).trim();

  let i = 0;
  const numero = /-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/iy;
  const nome = /\w+/y;
  const pular = () => {
    while (i < expr.length && /[\s,]/.test(expr[i])) i++;
  };

  function valor() {
    pular();
    const c = expr[i];
    if (c === '"') {
      let j = i + 1;
      while (expr[j] !== '"') j += expr[j] === "\\" ? 2 : 1;
      const s = JSON.parse(expr.slice(i, j + 1));
      i = j + 1;
      return s;
    }
    if (c === "[") {
      i++;
      const lista = [];
      for (pular(); expr[i] !== "]"; pular()) lista.push(valor());
      i++;
      return lista;
    }
    numero.lastIndex = i;
    const n = numero.exec(expr);
    if (n) {
      i = numero.lastIndex;
      return Number(n[0]);
    }
    nome.lastIndex = i;
    const m = nome.exec(expr);
    if (!m) throw new Error(`Formato do OP.GG inesperado perto de "${expr.slice(i, i + 30)}"`);
    i = nome.lastIndex;
    if (m[0] === "null") return null;
    if (m[0] === "true" || m[0] === "false") return m[0] === "true";
    if (expr[i] !== "(") return m[0];
    i++;
    const args = [];
    for (pular(); expr[i] !== ")"; pular()) args.push(valor());
    i++;
    const objeto = {};
    (campos[m[0]] ?? []).forEach((campo, k) => (objeto[campo] = args[k] ?? null));
    return objeto;
  }

  return valor();
}

const CAMPOS_PEDIDOS = [
  "data.summary.average_stats.{play,win_rate,pick_rate,ban_rate,tier,rank}",
  "data.summary.positions[].name",
  "data.summary.positions[].stats.{play,win_rate,role_rate}",
  "data.starter_items.{ids[],play,win,pick_rate}",
  "data.core_items.{ids[],play,win,pick_rate}",
  "data.boots.{ids[],play,win,pick_rate}",
  "data.fourth_items[].{ids[],play,win,pick_rate}",
  "data.fifth_items[].{ids[],play,win,pick_rate}",
  "data.sixth_items[].{ids[],play,win,pick_rate}",
  "data.runes.{primary_page_id,primary_rune_ids[],secondary_page_id,secondary_rune_ids[],stat_mod_ids[],play,win,pick_rate}",
  "data.summoner_spells.{ids[],play,win,pick_rate}",
  "data.skills.{order[],play,win,pick_rate}",
  "data.skill_masteries.{ids[],play,win,pick_rate}",
];

// Chama uma ferramenta da API do OP.GG e devolve o campo "data" já lido.
// Também usada pelas promoções de skins (ver avisos.js).
export async function chamarOpgg(argumentos, ferramenta = "lol_get_champion_analysis") {
  const res = await fetch(OPGG, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: ferramenta, arguments: argumentos },
    }),
  });
  const bruto = await res.text();
  if (!res.ok) throw new Error(`OP.GG -> ${res.status}: ${bruto.slice(0, 200)}`);

  // O transporte "streamable HTTP" pode responder como SSE; aí o JSON vem
  // nas linhas "data:".
  const corpo = (res.headers.get("content-type") ?? "").includes("event-stream")
    ? bruto
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5))
        .join("")
    : bruto;
  const resposta = JSON.parse(corpo);
  if (resposta.error) throw new Error(`OP.GG recusou: ${resposta.error.message}`.slice(0, 300));
  const texto = resposta.result?.content?.[0]?.text ?? "";
  if (resposta.result?.isError) throw new Error(`OP.GG: ${texto.slice(0, 200)}`);
  return lerFormatoOpgg(texto)?.data ?? null;
}

// Uma opção de item/runa/feitiço no formato que o resto do bot usa.
const opcao = (o) => (o?.play ? { ids: o.ids ?? [], jogos: o.play, taxa: o.win / o.play } : null);
const opcoes = (lista) => (Array.isArray(lista) ? lista.map(opcao).filter(Boolean).slice(0, 3) : []);

function normalizar(dados, modo, rota) {
  const rotas = (dados.summary?.positions ?? [])
    .map((p) => ({ rota: ROTA_DO_OPGG[p.name] ?? p.name, jogos: p.stats?.play ?? 0, taxa: p.stats?.win_rate ?? 0 }))
    .sort((a, b) => b.jogos - a.jogos);
  const media = dados.summary?.average_stats ?? {};
  // Os números do topo são os da rota escolhida; o average_stats é do
  // campeão inteiro.
  const daRota = rotas.find((r) => r.rota === rota);
  const r = dados.runes;

  return {
    modo,
    rota: modo === "aram" ? "" : rota,
    rotas: modo === "aram" ? [] : rotas,
    jogos: daRota?.jogos || media.play || 0,
    taxa: daRota?.taxa || media.win_rate || 0,
    tier: media.tier ?? null,
    inicio: opcao(dados.starter_items),
    nucleo: opcao(dados.core_items),
    botas: opcao(dados.boots),
    extras: [opcoes(dados.fourth_items), opcoes(dados.fifth_items), opcoes(dados.sixth_items)],
    runas: r?.play
      ? {
          primario: r.primary_page_id,
          runasPrimarias: r.primary_rune_ids ?? [],
          secundario: r.secondary_page_id,
          runasSecundarias: r.secondary_rune_ids ?? [],
          fragmentos: r.stat_mod_ids ?? [],
          jogos: r.play,
          taxa: r.win / r.play,
        }
      : null,
    feiticos: opcao(dados.summoner_spells),
    habilidades: dados.skill_masteries?.play
      ? {
          ordem: (dados.skill_masteries.ids ?? []).join(">"),
          sequencia: (dados.skills?.order ?? []).join(""),
          jogos: dados.skill_masteries.play,
          taxa: dados.skill_masteries.win / dados.skill_masteries.play,
        }
      : null,
    fonte: "OP.GG",
    em: new Date().toISOString(),
  };
}

// As estatísticas do OP.GG mudam aos poucos ao longo do patch; 6 horas de
// cache deixam o /build instantâneo na maioria das vezes e poupam a API
// deles. Se o OP.GG cair, a última build guardada continua valendo.
const VALIDADE_CACHE_MS = 6 * 60 * 60 * 1000;
const VALIDADE_ROTA_MS = 3 * 24 * 60 * 60 * 1000;

async function doCache(env, chave, validade) {
  const guardado = await pegarCacheBuild(env, chave).catch(() => null);
  if (!guardado) return { valor: null, fresco: false };
  const fresco = Date.now() - new Date(guardado.em).getTime() < validade;
  try {
    return { valor: JSON.parse(guardado.valor), fresco };
  } catch {
    return { valor: null, fresco: false };
  }
}

// A build recomendada de um campeão. `rota` é opcional: sem ela, vale a rota
// em que o campeão mais aparece. Devolve null se o OP.GG não tiver dados.
export async function buscarBuild(env, campeao, modo = "normal", rota) {
  if (!MODOS[modo]) modo = "normal";
  const nome = nomeOpgg(campeao.arquivoImagem);

  // O OP.GG exige uma rota mesmo quando a pessoa não escolheu. A principal
  // de cada campeão fica guardada; sem ela, pergunta pelo meio e, se a
  // resposta disser que a principal é outra, pergunta de novo.
  let palpite = rota;
  if (!palpite && modo !== "aram") {
    const { valor } = await doCache(env, `rota:${nome}`, VALIDADE_ROTA_MS);
    palpite = valor ?? "MIDDLE";
  }
  palpite ??= "MIDDLE"; // no ARAM a rota é ignorada, mas o campo é obrigatório

  const chave = `build:${nome}:${modo}:${modo === "aram" ? "-" : palpite}`;
  const cache = await doCache(env, chave, VALIDADE_CACHE_MS);
  if (cache.valor && cache.fresco) return cache.valor;

  try {
    const pedir = (r) =>
      chamarOpgg({
        champion: nome,
        game_mode: MODOS[modo].opgg,
        position: POSICAO_OPGG[r],
        lang: "pt_BR",
        desired_output_fields: CAMPOS_PEDIDOS,
      });

    let dados = await pedir(palpite);
    let rotaFinal = palpite;
    if (!rota && modo !== "aram") {
      const principal = normalizar(dados ?? {}, modo, palpite).rotas[0]?.rota;
      if (principal && ROTAS[principal]) {
        await salvarCacheBuild(env, `rota:${nome}`, JSON.stringify(principal)).catch(() => {});
        if (principal !== palpite) {
          dados = await pedir(principal);
          rotaFinal = principal;
        }
      }
    }
    if (!dados?.core_items) return cache.valor ?? null;

    const build = normalizar(dados, modo, rotaFinal);
    await salvarCacheBuild(env, `build:${nome}:${modo}:${modo === "aram" ? "-" : rotaFinal}`, JSON.stringify(build)).catch(
      (err) => console.log("Não guardei a build no cache:", err.message)
    );
    await salvarEstado(env, "opgg_erro", "").catch(() => {});
    return build;
  } catch (err) {
    console.log(`OP.GG falhou para ${nome}:`, err.message);
    await salvarEstado(env, "opgg_erro", String(err.message).slice(0, 300)).catch(() => {});
    await salvarEstado(env, "opgg_erro_em", new Date().toISOString()).catch(() => {});
    if (cache.valor) return cache.valor; // velha, mas melhor que nada
    throw err;
  }
}

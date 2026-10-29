// Builds do meta: o bot coleta sozinho partidas recentes dos jogadores do topo
// do ranqueado brasileiro (Desafiante e Grão-Mestre) pela API da Riot,
// guarda um resumo enxuto de cada participante e, na hora do /build, agrega
// tudo e escolhe o que mais ganha. Como a coleta é contínua e os dados são
// separados por patch, a build acompanha o meta sem ninguém mexer.
//
// Por que não buscar de um site de builds (op.gg, u.gg): nenhum tem API
// pública, e raspar HTML deles quebra a cada mudança de layout — o mesmo
// problema que já deu trabalho com as notas do patch.

import { pegarEstado, salvarEstado, limparCacheAntigo } from "./db.js";
import { versaoAtual } from "./riot.js";

const DDRAGON = "https://ddragon.leagueoflegends.com";
const RIOT_BR = "https://br1.api.riotgames.com";
// A match-v5 não é por plataforma, é por região: o BR fica em "americas".
const RIOT_AMERICAS = "https://americas.api.riotgames.com";

export const MODOS = {
  420: { nome: "Ranqueada Solo/Duo", curto: "Ranqueada" },
  450: { nome: "ARAM", curto: "ARAM" },
};

export const ROTAS = {
  TOP: "Topo",
  JUNGLE: "Selva",
  MIDDLE: "Meio",
  BOTTOM: "Atirador",
  UTILITY: "Suporte",
};

// Os fragmentos de atributo não vêm no runesReforged.json do Data Dragon.
const FRAGMENTOS = {
  5001: "Vida escalável",
  5005: "Velocidade de ataque",
  5007: "Aceleração de habilidade",
  5008: "Força adaptativa",
  5010: "Velocidade de movimento",
  5011: "Vida",
  5013: "Tenacidade e resistência a lentidão",
};

const TECLAS = { 1: "Q", 2: "W", 3: "E", 4: "R" };

// A numeração do jogo (16.21) vira um inteiro ordenável (1621): como texto,
// "16.9" ficaria depois de "16.21".
export function patchComoNumero(versao) {
  const [major, minor] = String(versao).split(".");
  return Number(major) * 100 + Number(minor);
}

// O número que os jogadores conhecem é o público, 10 à frente do interno
// (ver urlNotasPatch em riot.js).
export function patchPublico(numero) {
  return `${Math.floor(numero / 100) + 10}.${numero % 100}`;
}

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

// ---------- coleta ----------

async function riot(env, url) {
  const chave = (env.RIOT_API_KEY ?? "").trim();
  if (!chave) throw new Error("RIOT_API_KEY não configurada");
  // Mesmo cuidado da antiga rotação: resposta da Riot nunca pode vir de cache.
  const res = await fetch(url, { headers: { "X-Riot-Token": chave }, cache: "no-store" });
  if (!res.ok) {
    const erro = new Error(`Riot API ${new URL(url).pathname} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
    erro.status = res.status;
    throw erro;
  }
  return res;
}

const VALIDADE_JOGADORES_MS = 24 * 60 * 60 * 1000;

// Os PUUIDs do topo do ranqueado mudam pouco de um dia pro outro; buscar a
// lista uma vez por dia basta. Fica numa chave própria (60 KB) para a rodada
// a cada 2 minutos não regravar isso à toa.
async function jogadoresDoTopo(env) {
  const guardado = await pegarEstado(env, "coleta_jogadores");
  if (guardado) {
    try {
      const { em, puuids } = JSON.parse(guardado);
      if (Date.now() - new Date(em).getTime() < VALIDADE_JOGADORES_MS && puuids.length) return puuids;
    } catch {}
  }

  const puuids = [];
  for (const liga of ["challengerleagues", "grandmasterleagues"]) {
    const res = await riot(env, `${RIOT_BR}/lol/league/v4/${liga}/by-queue/RANKED_SOLO_5x5`);
    const dados = await res.json();
    for (const entrada of dados.entries ?? []) if (entrada.puuid) puuids.push(entrada.puuid);
  }
  if (!puuids.length) throw new Error("A Riot devolveu a lista do topo vazia");
  await salvarEstado(env, "coleta_jogadores", JSON.stringify({ em: new Date().toISOString(), puuids }));
  return puuids;
}

// O timeline tem ~1 MB e o plano free do Worker dá 10 ms de CPU: um
// JSON.parse inteiro dele não cabe. Então só os eventos que interessam são
// recortados por regex e lidos um a um — cada um é um objeto pequeno, sem
// nada aninhado.
function lerTimeline(texto) {
  const porJogador = {};
  const pegar = (pid) => (porJogador[pid] ??= { compras: [], habilidades: [] });
  const eventos = /\{[^{}]*"type":"(ITEM_PURCHASED|ITEM_UNDO|SKILL_LEVEL_UP)"[^{}]*\}/g;

  for (const [bruto, tipo] of texto.matchAll(eventos)) {
    let evento;
    try {
      evento = JSON.parse(bruto);
    } catch {
      continue;
    }
    const jogador = pegar(evento.participantId);
    if (tipo === "SKILL_LEVEL_UP") {
      // EVOLVE é a evolução do Kha'Zix/Viktor, não ponto de habilidade.
      if (evento.levelUpType === "NORMAL" && TECLAS[evento.skillSlot]) {
        jogador.habilidades.push(TECLAS[evento.skillSlot]);
      }
    } else if (evento.timestamp <= 60_000) {
      if (tipo === "ITEM_PURCHASED") jogador.compras.push(evento.itemId);
      else {
        const i = jogador.compras.lastIndexOf(evento.beforeId);
        if (i >= 0) jogador.compras.splice(i, 1);
      }
    }
  }
  return porJogador;
}

function resumirParticipante(p, fila, patch, matchId, itens, timeline) {
  const slots = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter(Boolean);
  // A ordem dos slots é a ordem de compra na maioria das partidas (item novo
  // cai no primeiro espaço livre). Não é perfeita — quem arruma o inventário
  // embaralha —, mas na agregação o ruído some.
  const lendarios = slots.filter((id) => itens[id]?.tipo === "lendario");
  const botas = slots.find((id) => itens[id]?.tipo === "botas") ?? 0;

  const estilos = p.perks?.styles ?? [];
  const primario = estilos.find((e) => e.description === "primaryStyle");
  const secundario = estilos.find((e) => e.description === "subStyle");
  const fragmentos = p.perks?.statPerks ?? {};
  const runas =
    primario && secundario
      ? `${primario.style}:${primario.selections.map((s) => s.perk).join(",")}` +
        `|${secundario.style}:${secundario.selections.map((s) => s.perk).join(",")}` +
        `|${[fragmentos.offense, fragmentos.flex, fragmentos.defense].join(",")}`
      : "";

  const linhaDoTempo = timeline?.[p.participantId];
  const inicio = (linhaDoTempo?.compras ?? [])
    .filter((id) => itens[id])
    .sort((a, b) => a - b)
    .join(",");

  return [
    fila,
    p.championId,
    patch,
    matchId,
    p.participantId,
    fila === 420 ? p.teamPosition || "" : "",
    p.win ? 1 : 0,
    lendarios.join(","),
    botas,
    inicio,
    runas,
    [p.summoner1Id, p.summoner2Id].sort((a, b) => a - b).join(","),
    (linhaDoTempo?.habilidades ?? []).slice(0, 18).join(""),
  ];
}

const COLUNAS_AMOSTRA =
  "fila, campeao, patch, match_id, participante, rota, vitoria, itens, botas, inicio, runas, feiticos, habilidades";

// O D1 aceita no máximo 100 parâmetros por consulta: 13 colunas dão 7 linhas
// por INSERT. Várias linhas por INSERT, e não um INSERT por linha, porque o
// plano free também limita quantas consultas cabem numa execução.
function insercoesEmLote(env, linhas) {
  const porConsulta = 7;
  const consultas = [];
  for (let i = 0; i < linhas.length; i += porConsulta) {
    const grupo = linhas.slice(i, i + porConsulta);
    const marcadores = grupo.map(() => `(${Array(13).fill("?").join(",")})`).join(",");
    consultas.push(
      env.DB.prepare(`INSERT OR IGNORE INTO build_amostra (${COLUNAS_AMOSTRA}) VALUES ${marcadores}`).bind(
        ...grupo.flat()
      )
    );
  }
  return consultas;
}

// Uma rodada da coleta. Roda a cada 2 minutos (ver scheduled em index.js),
// com um orçamento pequeno de chamadas à Riot: cabe com folga no limite da
// chave (100 a cada 2 min) e no de sub-requests do Worker.
export async function coletarPartidas(env, { orcamento = 9 } = {}) {
  const versao = await versaoAtual();
  const patchAtual = patchComoNumero(versao);
  const { itens } = await dadosDoJogo(env, versao);

  let estado;
  try {
    estado = JSON.parse((await pegarEstado(env, "coleta_estado")) ?? "null");
  } catch {}
  estado ??= { cursor: 0, vez: 0, pendentes: [] };

  let gastas = 0;
  const resumo = { partidas: 0, amostras: 0, novasNaFila: 0 };

  // Fila de partidas acabando: pede o histórico de mais um jogador. A cada
  // três pedidos, um é de ARAM — o topo joga menos ARAM, então o ARAM
  // precisa de mais voltas pra juntar amostra.
  if (estado.pendentes.length < 4) {
    const jogadores = await jogadoresDoTopo(env);
    gastas += 2;
    const puuid = jogadores[estado.cursor % jogadores.length];
    estado.cursor = (estado.cursor + 1) % jogadores.length;
    const fila = estado.vez % 3 === 2 ? 450 : 420;
    estado.vez = (estado.vez + 1) % 3;

    const desde = Math.floor((Date.now() - 3 * 86400000) / 1000);
    const res = await riot(
      env,
      `${RIOT_AMERICAS}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${fila}&count=10&startTime=${desde}`
    );
    gastas++;
    const ids = await res.json();
    if (ids.length) {
      const { results } = await env.DB.prepare(
        `SELECT match_id FROM build_partidas WHERE match_id IN (${ids.map(() => "?").join(",")})`
      )
        .bind(...ids)
        .all();
      const vistas = new Set(results.map((r) => r.match_id));
      const novas = ids.filter((id) => !vistas.has(id) && !estado.pendentes.includes(id));
      estado.pendentes.push(...novas);
      resumo.novasNaFila = novas.length;
    }
  }

  const linhas = [];
  const vistas = [];
  try {
    while (estado.pendentes.length && gastas + 2 <= orcamento) {
      const matchId = estado.pendentes[0];
      let partida;
      try {
        partida = await (await riot(env, `${RIOT_AMERICAS}/lol/match/v5/matches/${matchId}`)).json();
        gastas++;
      } catch (err) {
        gastas++;
        // Partida que sumiu (404) sai da fila; o resto (429, Riot fora do ar)
        // interrompe a rodada e fica para a próxima.
        if (err.status !== 404) throw err;
        estado.pendentes.shift();
        vistas.push(matchId);
        continue;
      }
      estado.pendentes.shift();
      vistas.push(matchId);

      const info = partida.info ?? {};
      const patch = patchComoNumero(info.gameVersion ?? "0.0");
      const remake = (info.participants ?? []).some((p) => p.gameEndedInEarlySurrender);
      // Só o patch atual e o anterior interessam; partida curta é remake.
      if (!MODOS[info.queueId] || remake || (info.gameDuration ?? 0) < 600 || patch < patchAtual - 1) continue;

      // Sem o timeline a partida ainda vale (itens finais, runas, feitiços);
      // só ficam sem início e ordem de habilidades.
      let timeline = null;
      try {
        const res = await riot(env, `${RIOT_AMERICAS}/lol/match/v5/matches/${matchId}/timeline`);
        timeline = lerTimeline(await res.text());
      } catch (err) {
        console.log(`Timeline de ${matchId} indisponível:`, err.message);
      }
      gastas++;

      for (const p of info.participants) {
        linhas.push(resumirParticipante(p, info.queueId, patch, matchId, itens, timeline));
      }
      resumo.partidas++;
    }
  } finally {
    // Grava o que deu tempo de coletar mesmo se a rodada parou no meio.
    const consultas = [
      ...insercoesEmLote(env, linhas),
      ...vistas.map((id) =>
        env.DB.prepare("INSERT OR IGNORE INTO build_partidas (match_id, em) VALUES (?, datetime('now'))").bind(id)
      ),
      env.DB.prepare(
        `INSERT INTO bot_state (key, value) VALUES ('coleta_estado', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).bind(JSON.stringify({ ...estado, pendentes: estado.pendentes.slice(0, 40) })),
    ];
    await env.DB.batch(consultas);
  }

  resumo.amostras = linhas.length;
  return resumo;
}

// Faxina diária: fica só o patch atual e o anterior (o anterior serve de
// reserva nos primeiros dias de patch novo, quando a amostra ainda é
// pequena), e a lista de partidas já vistas só precisa cobrir a janela de
// 3 dias da busca de histórico.
export async function limparColetaAntiga(env) {
  const patchAtual = patchComoNumero(await versaoAtual());
  await env.DB.batch([
    env.DB.prepare("DELETE FROM build_amostra WHERE patch < ?").bind(patchAtual - 1),
    env.DB.prepare("DELETE FROM build_partidas WHERE em < datetime('now', '-4 days')"),
  ]);
}

// ---------- agregação ----------

// Limite inferior do intervalo de Wilson: a taxa de vitória "com desconto"
// pelo tamanho da amostra. Assim uma opção com 3 jogos e 100% de vitória não
// passa na frente de uma com 400 jogos e 54%.
function wilson(vitorias, jogos, z = 1.645) {
  if (!jogos) return 0;
  const p = vitorias / jogos;
  const z2 = z * z;
  return (p + z2 / (2 * jogos) - z * Math.sqrt((p * (1 - p) + z2 / (4 * jogos)) / jogos)) / (1 + z2 / jogos);
}

function agrupar(linhas, chaveDe) {
  const grupos = new Map();
  for (const linha of linhas) {
    const chave = chaveDe(linha);
    if (!chave) continue;
    const g = grupos.get(chave) ?? { chave, jogos: 0, vitorias: 0 };
    g.jogos++;
    g.vitorias += linha.vitoria;
    grupos.set(chave, g);
  }
  return [...grupos.values()];
}

// A escolha "que os jogadores estão usando para ganhar": entre as opções com
// uso relevante (pelo menos 4% das partidas), a de maior vitória ajustada.
function melhorOpcao(linhas, chaveDe) {
  const grupos = agrupar(linhas, chaveDe);
  if (!grupos.length) return null;
  const total = grupos.reduce((s, g) => s + g.jogos, 0);
  const piso = Math.max(2, total * 0.04);
  const relevantes = grupos.filter((g) => g.jogos >= piso);
  const candidatas = relevantes.length ? relevantes : grupos;
  candidatas.sort((a, b) => wilson(b.vitorias, b.jogos) - wilson(a.vitorias, a.jogos) || b.jogos - a.jogos);
  const g = candidatas[0];
  return { ...g, taxa: g.vitorias / g.jogos };
}

const lista = (texto) => (texto ? texto.split(",").map(Number) : []);

// Q, W e E na ordem em que chegam a 5 pontos — é o "maximizar primeiro".
function ordemDeMaximizar(sequencia) {
  const pontos = { Q: 0, W: 0, E: 0 };
  const ordem = [];
  for (const tecla of sequencia) {
    if (!(tecla in pontos)) continue;
    if (++pontos[tecla] === 5) ordem.push(tecla);
  }
  for (const tecla of ["Q", "W", "E"].sort((a, b) => pontos[b] - pontos[a])) {
    if (!ordem.includes(tecla)) ordem.push(tecla);
  }
  return ordem.join(">");
}

// Monta a build recomendada de um campeão. `rota` é opcional: sem ela, vale
// a rota em que o campeão mais aparece. Devolve null quando ainda não há
// partida nenhuma coletada.
export async function montarBuild(env, campeaoId, fila, rota) {
  // A chave primária começa por (fila, campeao), então isto lê só as linhas
  // do campeão — e a faxina garante que são no máximo dois patches.
  const { results } = await env.DB.prepare(
    `SELECT patch, rota, vitoria, itens, botas, inicio, runas, feiticos, habilidades
     FROM build_amostra WHERE fila = ? AND campeao = ?`
  )
    .bind(fila, campeaoId)
    .all();
  if (!results.length) return null;

  // Patch novo começa com pouca amostra: até juntar 60 partidas, o patch
  // anterior entra junto pra build não sair de uma meia dúzia de jogos.
  const patches = [...new Set(results.map((r) => r.patch))].sort((a, b) => b - a);
  const doAtual = results.filter((r) => r.patch === patches[0]);
  let linhas = doAtual.length >= 60 || patches.length === 1 ? doAtual : results;
  const patchesUsados = doAtual.length >= 60 ? [patches[0]] : patches;

  const rotas = agrupar(linhas, (l) => l.rota)
    .sort((a, b) => b.jogos - a.jogos)
    .map((g) => ({ rota: g.chave, jogos: g.jogos }));
  const rotaEscolhida = fila === 420 ? (rota && rotas.some((r) => r.rota === rota) ? rota : rotas[0]?.rota ?? "") : "";
  if (rotaEscolhida) linhas = linhas.filter((l) => l.rota === rotaEscolhida);

  const vitorias = linhas.reduce((s, l) => s + l.vitoria, 0);

  // Núcleo: os três primeiros itens finais, como conjunto (a ordem de compra
  // varia demais para servir de chave).
  const tamanhoNucleo = linhas.filter((l) => lista(l.itens).length >= 3).length >= 10 ? 3 : 2;
  const nucleoDe = (l) => {
    const itens = lista(l.itens);
    return itens.length >= tamanhoNucleo ? itens.slice(0, tamanhoNucleo).sort((a, b) => a - b).join(",") : null;
  };
  const nucleo = melhorOpcao(linhas, nucleoDe);
  let itensNucleo = [];
  let extras = [];
  if (nucleo) {
    const ids = lista(nucleo.chave);
    const comNucleo = linhas.filter((l) => nucleoDe(l) === nucleo.chave);
    // Exibe na ordem média em que cada item foi comprado.
    const posicao = (id) =>
      comNucleo.reduce((s, l) => s + lista(l.itens).indexOf(id), 0) / Math.max(1, comNucleo.length);
    itensNucleo = ids.sort((a, b) => posicao(a) - posicao(b));

    // 4º item em diante: o que mais aparece depois desse núcleo.
    const depois = new Map();
    for (const l of comNucleo) {
      for (const id of lista(l.itens).slice(tamanhoNucleo)) {
        const g = depois.get(id) ?? { id, jogos: 0, vitorias: 0 };
        g.jogos++;
        g.vitorias += l.vitoria;
        depois.set(id, g);
      }
    }
    extras = [...depois.values()]
      .sort((a, b) => b.jogos - a.jogos)
      .slice(0, 5)
      .map((g) => ({ ...g, taxa: g.vitorias / g.jogos }));
  }

  // Campeão que quase nunca compra bota (Cassiopeia) não ganha "bota
  // recomendada" tirada de meia dúzia de partidas fora do padrão.
  const comBota = linhas.filter((l) => l.botas).length;
  const botas = comBota >= linhas.length * 0.4 ? melhorOpcao(linhas, (l) => l.botas || null) : null;

  const runas = melhorOpcao(linhas, (l) => l.runas || null);
  const ordem = melhorOpcao(linhas, (l) => (l.habilidades.length >= 9 ? ordemDeMaximizar(l.habilidades) : null));
  const primeiras = ordem
    ? melhorOpcao(
        linhas.filter((l) => l.habilidades.length >= 9 && ordemDeMaximizar(l.habilidades) === ordem.chave),
        (l) => l.habilidades.slice(0, 3)
      )
    : null;

  let runasDetalhe = null;
  if (runas) {
    const [prim, sec, frag] = runas.chave.split("|");
    const [estiloPrim, runasPrim] = prim.split(":");
    const [estiloSec, runasSec] = sec.split(":");
    runasDetalhe = {
      ...runas,
      primario: Number(estiloPrim),
      runasPrimarias: lista(runasPrim),
      secundario: Number(estiloSec),
      runasSecundarias: lista(runasSec),
      fragmentos: lista(frag).map((id) => FRAGMENTOS[id] ?? `#${id}`),
    };
  }

  return {
    fila,
    rota: rotaEscolhida,
    rotas,
    patches: patchesUsados,
    jogos: linhas.length,
    taxa: linhas.length ? vitorias / linhas.length : 0,
    inicio: melhorOpcao(linhas, (l) => l.inicio || null),
    nucleo: nucleo ? { ...nucleo, itens: itensNucleo } : null,
    extras,
    botas,
    runas: runasDetalhe,
    feiticos: melhorOpcao(linhas, (l) => l.feiticos || null),
    habilidades: ordem ? { ordem: ordem.chave, primeiras: primeiras?.chave ?? "", ...ordem } : null,
  };
}

// Quantas partidas já foram coletadas, por modo, no patch mais recente —
// para o painel de uso e o rodapé do /build.
export async function totalColetado(env) {
  const { results } = await env.DB.prepare(
    `SELECT fila, patch, COUNT(*) / 10 AS partidas FROM build_amostra
     GROUP BY fila, patch ORDER BY patch DESC`
  ).all();
  return results;
}

// Helpers de consulta ao D1. Nada de SQL dinâmico montado com dados de fora
// (nome de coluna sempre fixo no código) — evita injeção por construção.

export async function pegarConfig(env, guildId) {
  const linha = await env.DB.prepare("SELECT * FROM guild_config WHERE guild_id = ?")
    .bind(guildId)
    .first();
  return (
    linha ?? {
      guild_id: guildId,
      patch_enabled: 0,
      patch_channel_id: null,
      news_enabled: 0,
      news_channel_id: null,
      news_seeded_at: null,
      patch_last_error: null,
      patch_last_error_at: null,
      news_last_error: null,
      news_last_error_at: null,
      sale_enabled: 0,
      sale_channel_id: null,
      sale_last_error: null,
      sale_last_error_at: null,
      skins_enabled: 0,
      skins_channel_id: null,
      skins_last_error: null,
      skins_last_error_at: null,
      youtube_enabled: 0,
      youtube_channel_id: null,
      youtube_last_error: null,
      youtube_last_error_at: null,
    }
  );
}

// As colunas rotation_* continuam na tabela (SQLite antigo não apaga coluna
// com segurança), mas nada mais lê nem grava nelas desde que a rotação saiu.
export async function salvarConfig(env, guildId, config) {
  await env.DB.prepare(
    `INSERT INTO guild_config (guild_id, patch_enabled, patch_channel_id, news_enabled, news_channel_id,
       sale_enabled, sale_channel_id, skins_enabled, skins_channel_id, youtube_enabled, youtube_channel_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(guild_id) DO UPDATE SET
       patch_enabled = excluded.patch_enabled,
       patch_channel_id = excluded.patch_channel_id,
       news_enabled = excluded.news_enabled,
       news_channel_id = excluded.news_channel_id,
       sale_enabled = excluded.sale_enabled,
       sale_channel_id = excluded.sale_channel_id,
       skins_enabled = excluded.skins_enabled,
       skins_channel_id = excluded.skins_channel_id,
       youtube_enabled = excluded.youtube_enabled,
       youtube_channel_id = excluded.youtube_channel_id,
       updated_at = datetime('now')`
  )
    .bind(
      guildId,
      config.patch_enabled ? 1 : 0,
      config.patch_channel_id,
      config.news_enabled ? 1 : 0,
      config.news_channel_id,
      config.sale_enabled ? 1 : 0,
      config.sale_channel_id,
      config.skins_enabled ? 1 : 0,
      config.skins_channel_id,
      config.youtube_enabled ? 1 : 0,
      config.youtube_channel_id
    )
    .run();
}

// Os avisos que cada servidor configura no painel: nome, coluna de ligado e
// coluna do canal. Usado pelo painel de uso e pelo "Avisar o dono".
export const AVISOS_DO_PAINEL = [
  ["Patch novo", "patch_enabled", "patch_channel_id"],
  ["Notícias oficiais", "news_enabled", "news_channel_id"],
  ["Skins em promoção", "sale_enabled", "sale_channel_id"],
  ["Skins novas", "skins_enabled", "skins_channel_id"],
  ["Vídeos do YouTube", "youtube_enabled", "youtube_channel_id"],
];

// Nomes dos avisos que ainda não estão ligados com canal escolhido.
export function faltaConfigurar(config) {
  return AVISOS_DO_PAINEL.filter(([, ligado, canal]) => !config?.[ligado] || !config?.[canal]).map(([nome]) => nome);
}

// Quando cada servidor recebeu o último "Avisar o dono" (guid -> ISO).
export async function listarAvisosAoDono(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM bot_state WHERE key LIKE 'aviso\\_dono\\_%' ESCAPE '\\'").all();
  return new Map(results.map((r) => [r.key.slice("aviso_dono_".length), r.value]));
}

// Servidores com um dos avisos novos ligado e canal escolhido. A coluna vem
// deste mapa fixo, nunca de fora (ver regra do topo do arquivo).
const COLUNAS_AVISO = {
  promocoes: ["sale_enabled", "sale_channel_id"],
  skins: ["skins_enabled", "skins_channel_id"],
  youtube: ["youtube_enabled", "youtube_channel_id"],
};

export async function listarComAvisoLigado(env, aviso) {
  const colunas = COLUNAS_AVISO[aviso];
  if (!colunas) throw new Error(`aviso desconhecido: ${aviso}`);
  const { results } = await env.DB.prepare(
    `SELECT * FROM guild_config WHERE ${colunas[0]} = 1 AND ${colunas[1]} IS NOT NULL`
  ).all();
  return results.map((c) => ({ ...c, canal_do_aviso: c[colunas[1]] }));
}

export async function listarPatchAtivo(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM guild_config WHERE patch_enabled = 1"
  ).all();
  return results;
}

export async function listarNoticiasAtiva(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM guild_config WHERE news_enabled = 1"
  ).all();
  return results;
}

export async function urlsDeNoticiasPostadas(env, guildId) {
  const { results } = await env.DB.prepare("SELECT url FROM news_posted WHERE guild_id = ?")
    .bind(guildId)
    .all();
  return new Set(results.map((r) => r.url));
}

export async function marcarNoticiaPostada(env, guildId, url) {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO news_posted (guild_id, url, posted_at) VALUES (?, ?, datetime('now'))"
  )
    .bind(guildId, url)
    .run();
}

// Colunas de erro por função. O mapa é fixo aqui no código e `colunasDe`
// recusa chave desconhecida — então o nome de coluna que entra no SQL abaixo
// nunca vem de fora, mantendo a regra do topo do arquivo.
const COLUNAS_ERRO = {
  patch: { texto: "patch_last_error", quando: "patch_last_error_at" },
  noticias: { texto: "news_last_error", quando: "news_last_error_at" },
  promocoes: { texto: "sale_last_error", quando: "sale_last_error_at" },
  skins: { texto: "skins_last_error", quando: "skins_last_error_at" },
  youtube: { texto: "youtube_last_error", quando: "youtube_last_error_at" },
};

function colunasDe(funcao) {
  const colunas = COLUNAS_ERRO[funcao];
  if (!colunas) throw new Error(`função desconhecida para registro de erro: ${funcao}`);
  return colunas;
}

// Guarda por que o último envio falhou. Sem isto a falha era só um
// console.log e o feed de um servidor podia ficar morto por dias sem
// ninguém saber. A mensagem é cortada porque o corpo de erro da Discord vem
// com o JSON inteiro.
export async function registrarErroEnvio(env, guildId, funcao, mensagem) {
  const { texto, quando } = colunasDe(funcao);
  await env.DB.prepare(
    `INSERT INTO guild_config (guild_id, ${texto}, ${quando})
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(guild_id) DO UPDATE SET
       ${texto} = excluded.${texto},
       ${quando} = excluded.${quando}`
  )
    .bind(guildId, String(mensagem ?? "").slice(0, 300))
    .run();
}

// `soConsulta: true` devolve a consulta pronta, sem rodar — para entrar num
// env.DB.batch junto com outras (a fila de envios limpa vários de uma vez).
export function limparErroEnvio(env, guildId, funcao, { soConsulta = false } = {}) {
  const { texto, quando } = colunasDe(funcao);
  const consulta = env.DB.prepare(
    `UPDATE guild_config SET ${texto} = NULL, ${quando} = NULL WHERE guild_id = ?`
  ).bind(guildId);
  return soConsulta ? consulta : consulta.run();
}

// Upsert e não update: um servidor pode estrear antes de ter salvado
// configuração pelo painel, então a linha pode não existir ainda.
export async function marcarNoticiasSemeadas(env, guildId) {
  await env.DB.prepare(
    `INSERT INTO guild_config (guild_id, news_seeded_at) VALUES (?, datetime('now'))
     ON CONFLICT(guild_id) DO UPDATE SET news_seeded_at = excluded.news_seeded_at`
  )
    .bind(guildId)
    .run();
}

export async function listarTodasConfigs(env) {
  const { results } = await env.DB.prepare("SELECT * FROM guild_config").all();
  return results;
}

// Só incrementa a contagem — em nenhum momento guarda quem executou.
export async function registrarUsoComando(env, guildId, comando) {
  await env.DB.prepare(
    `INSERT INTO command_usage (guild_id, comando, total, ultimo_uso)
     VALUES (?, ?, 1, datetime('now'))
     ON CONFLICT(guild_id, comando) DO UPDATE SET
       total = total + 1,
       ultimo_uso = datetime('now')`
  )
    .bind(guildId, comando)
    .run();
}

export async function listarUsoComandos(env) {
  const { results } = await env.DB.prepare(
    "SELECT guild_id, comando, total, ultimo_uso FROM command_usage ORDER BY total DESC"
  ).all();
  return results;
}

// Os caches de dados do jogo (roster, itens/runas) são guardados com a versão
// do patch na chave; depois de gravar a nova, as antigas não servem mais pra
// nada. O prefixo vem sempre do código (ver regra do topo do arquivo).
export async function limparCacheAntigo(env, prefixo, chaveAtual) {
  await env.DB.prepare("DELETE FROM bot_state WHERE key LIKE ? ESCAPE '\\' AND key != ?")
    .bind(`${prefixo.replace(/_/g, "\\_")}%`, chaveAtual)
    .run();
}

// Builds do OP.GG já buscadas (ver buscarBuild em builds.js).
export async function pegarCacheBuild(env, chave) {
  return env.DB.prepare("SELECT valor, em FROM build_cache WHERE chave = ?").bind(chave).first();
}

export async function salvarCacheBuild(env, chave, valor) {
  await env.DB.prepare(
    `INSERT INTO build_cache (chave, valor, em) VALUES (?, ?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, em = excluded.em`
  )
    .bind(chave, valor, new Date().toISOString())
    .run();
}

export async function contarCacheBuild(env) {
  const linha = await env.DB.prepare("SELECT COUNT(*) AS total FROM build_cache WHERE chave LIKE 'build:%'").first();
  return linha?.total ?? 0;
}

// ---------- estatísticas (painel de administração) ----------

// Dia no fuso de Brasília, "2026-10-30": é por ele que tudo é agrupado.
export function diaBrasil(data = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(data);
}

// Uma página vista por uma pessoa (ver migracoes/0013). Pessoa nova ganha
// linha com a origem de chegada; pessoa que já existe só atualiza o último
// dia (e soma um dia se for outro dia). Página repetida no mesmo dia e
// presença repetida são ignoradas — recarregar não conta de novo.
export async function registrarVista(env, { hash, caminho, origem }) {
  const dia = diaBrasil();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO pessoas (hash, primeiro_dia, ultimo_dia, origem) VALUES (?, ?, ?, ?)
       ON CONFLICT(hash) DO UPDATE SET
         dias = dias + (CASE WHEN ultimo_dia < excluded.ultimo_dia THEN 1 ELSE 0 END),
         ultimo_dia = excluded.ultimo_dia`
    ).bind(hash, dia, dia, origem),
    env.DB.prepare("INSERT OR IGNORE INTO presencas (dia, hash) VALUES (?, ?)").bind(dia, hash),
    env.DB.prepare("INSERT OR IGNORE INTO vistas (dia, hash, caminho) VALUES (?, ?, ?)").bind(dia, hash, caminho),
  ]);
}

// Marca que a pessoa clicou em "Adicionar ao Discord" (convidou) ou entrou
// no painel (entrou). Só vale para quem já foi contado como pessoa de
// verdade — robô que segue o link não tem linha e não soma.
const MARCAS_DE_PESSOA = new Set(["convidou", "entrou"]);
export async function marcarPessoa(env, hash, marca) {
  if (!MARCAS_DE_PESSOA.has(marca)) return;
  await env.DB.prepare(`UPDATE pessoas SET ${marca} = 1 WHERE hash = ?`).bind(hash).run();
}

export async function registrarEvento(env, evento) {
  await env.DB.prepare(
    `INSERT INTO eventos (dia, evento, total) VALUES (?, ?, 1)
     ON CONFLICT(dia, evento) DO UPDATE SET total = total + 1`
  )
    .bind(diaBrasil(), evento)
    .run();
}

export async function registrarBuildPedida(env, campeao, modo) {
  await env.DB.prepare(
    `INSERT INTO builds_pedidas (campeao, modo, total, ultimo) VALUES (?, ?, 1, datetime('now'))
     ON CONFLICT(campeao, modo) DO UPDATE SET total = total + 1, ultimo = datetime('now')`
  )
    .bind(campeao, modo)
    .run();
}

export async function salvarMetricaDiaria(env, servidores, membros) {
  await env.DB.prepare(
    `INSERT INTO metricas_diarias (dia, servidores, membros) VALUES (?, ?, ?)
     ON CONFLICT(dia) DO UPDATE SET servidores = excluded.servidores, membros = excluded.membros`
  )
    .bind(diaBrasil(), servidores, membros)
    .run();
}

// O código de cada pessoa só vive enquanto ela volta: 90 dias sem aparecer e
// some tudo dela. As tabelas antigas da 0011 (visitantes) também são limpas.
export async function limparVisitantesAntigos(env) {
  const limite = diaBrasil(new Date(Date.now() - 90 * 86400000));
  await env.DB.batch([
    env.DB.prepare("DELETE FROM visitantes WHERE dia < ?").bind(limite),
    env.DB.prepare("DELETE FROM presencas WHERE dia < ?").bind(limite),
    env.DB.prepare("DELETE FROM vistas WHERE dia < ?").bind(limite),
    env.DB.prepare("DELETE FROM pessoas WHERE ultimo_dia < ?").bind(limite),
  ]);
}

// Tudo que o painel de administração mostra, dos últimos 30 dias. "Pessoa"
// conta uma vez no período inteiro, não uma vez por dia.
export async function estatisticasDoSite(env) {
  const dia = (n) => diaBrasil(new Date(Date.now() - n * 86400000));
  const desde = dia(29);
  const desde7 = dia(6);
  const [porDia, vistasPorDia, totais, paginas, canais, eventos, builds, metricas] = await env.DB.batch([
    env.DB.prepare(
      `SELECT p.dia, COUNT(*) AS pessoas, SUM(CASE WHEN pe.primeiro_dia = p.dia THEN 1 ELSE 0 END) AS novas
       FROM presencas p JOIN pessoas pe ON pe.hash = p.hash
       WHERE p.dia >= ? GROUP BY p.dia`
    ).bind(desde),
    env.DB.prepare("SELECT dia, COUNT(*) AS vistas FROM vistas WHERE dia >= ? GROUP BY dia").bind(desde),
    env.DB.prepare(
      `SELECT
         (SELECT COUNT(DISTINCT hash) FROM presencas WHERE dia >= ?1) AS pessoas30,
         (SELECT COUNT(DISTINCT hash) FROM presencas WHERE dia >= ?2) AS pessoas7,
         (SELECT COUNT(*) FROM vistas WHERE dia >= ?1) AS vistas30,
         (SELECT COUNT(DISTINCT hash) FROM vistas WHERE dia >= ?1 AND caminho LIKE '/build%') AS viramBuild30,
         (SELECT COUNT(*) FROM pessoas WHERE ultimo_dia >= ?1 AND dias > 1) AS voltaram30,
         (SELECT COUNT(*) FROM pessoas WHERE ultimo_dia >= ?1 AND convidou = 1) AS convidaram30,
         (SELECT COUNT(*) FROM pessoas WHERE ultimo_dia >= ?1 AND entrou = 1) AS entraram30,
         (SELECT MIN(primeiro_dia) FROM pessoas) AS inicio`
    ).bind(desde, desde7),
    env.DB.prepare(
      `SELECT caminho, COUNT(DISTINCT hash) AS pessoas FROM vistas WHERE dia >= ?
       GROUP BY caminho ORDER BY pessoas DESC LIMIT 15`
    ).bind(desde),
    // Canal = por onde a pessoa chegou na primeira vez. É a tabela que diz
    // qual divulgação funciona: quantos chegaram e quantos clicaram em
    // adicionar.
    env.DB.prepare(
      `SELECT origem, COUNT(*) AS pessoas, SUM(convidou) AS convidaram, SUM(entrou) AS entraram,
              SUM(CASE WHEN dias > 1 THEN 1 ELSE 0 END) AS voltaram
       FROM pessoas WHERE primeiro_dia >= ? GROUP BY origem ORDER BY pessoas DESC, convidaram DESC LIMIT 20`
    ).bind(desde),
    env.DB.prepare("SELECT dia, evento, total FROM eventos WHERE dia >= ?").bind(desde),
    env.DB.prepare("SELECT campeao, modo, total, ultimo FROM builds_pedidas ORDER BY total DESC LIMIT 12"),
    env.DB.prepare("SELECT dia, servidores, membros FROM metricas_diarias WHERE dia >= ? ORDER BY dia").bind(desde),
  ]);
  return {
    porDia: porDia.results,
    vistasPorDia: vistasPorDia.results,
    totais: totais.results[0] ?? {},
    paginas: paginas.results,
    canais: canais.results,
    eventos: eventos.results,
    builds: builds.results,
    metricas: metricas.results,
    hoje: diaBrasil(),
  };
}

export async function pegarEstado(env, chave) {
  const linha = await env.DB.prepare("SELECT value FROM bot_state WHERE key = ?")
    .bind(chave)
    .first();
  return linha?.value ?? null;
}

export async function salvarEstado(env, chave, valor) {
  await env.DB.prepare(
    `INSERT INTO bot_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  )
    .bind(chave, valor)
    .run();
}

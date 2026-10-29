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
    }
  );
}

// As colunas rotation_* continuam na tabela (SQLite antigo não apaga coluna
// com segurança), mas nada mais lê nem grava nelas desde que a rotação saiu.
export async function salvarConfig(env, guildId, config) {
  await env.DB.prepare(
    `INSERT INTO guild_config (guild_id, patch_enabled, patch_channel_id, news_enabled, news_channel_id, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(guild_id) DO UPDATE SET
       patch_enabled = excluded.patch_enabled,
       patch_channel_id = excluded.patch_channel_id,
       news_enabled = excluded.news_enabled,
       news_channel_id = excluded.news_channel_id,
       updated_at = datetime('now')`
  )
    .bind(
      guildId,
      config.patch_enabled ? 1 : 0,
      config.patch_channel_id,
      config.news_enabled ? 1 : 0,
      config.news_channel_id
    )
    .run();
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

export async function limparErroEnvio(env, guildId, funcao) {
  const { texto, quando } = colunasDe(funcao);
  await env.DB.prepare(
    `UPDATE guild_config SET ${texto} = NULL, ${quando} = NULL WHERE guild_id = ?`
  )
    .bind(guildId)
    .run();
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

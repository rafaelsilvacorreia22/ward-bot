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
      rotation_enabled: 0,
      rotation_channel_id: null,
      rotation_daily_hour: null,
    }
  );
}

export async function salvarConfig(env, guildId, config) {
  await env.DB.prepare(
    `INSERT INTO guild_config (guild_id, patch_enabled, patch_channel_id, news_enabled, news_channel_id, rotation_enabled, rotation_channel_id, rotation_daily_hour, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(guild_id) DO UPDATE SET
       patch_enabled = excluded.patch_enabled,
       patch_channel_id = excluded.patch_channel_id,
       news_enabled = excluded.news_enabled,
       news_channel_id = excluded.news_channel_id,
       rotation_enabled = excluded.rotation_enabled,
       rotation_channel_id = excluded.rotation_channel_id,
       rotation_daily_hour = excluded.rotation_daily_hour,
       updated_at = datetime('now')`
  )
    .bind(
      guildId,
      config.patch_enabled ? 1 : 0,
      config.patch_channel_id,
      config.news_enabled ? 1 : 0,
      config.news_channel_id,
      config.rotation_enabled ? 1 : 0,
      config.rotation_channel_id,
      config.rotation_daily_hour
    )
    .run();
}

export async function listarPatchAtivo(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM guild_config WHERE patch_enabled = 1"
  ).all();
  return results;
}

export async function listarRotacaoAtiva(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM guild_config WHERE rotation_enabled = 1"
  ).all();
  return results;
}

// Servidores com horário diário configurado pra essa hora (fuso
// America/Sao_Paulo) que ainda não receberam a postagem de hoje.
export async function listarRotacaoDiarioPendente(env, hora, hoje) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM guild_config
     WHERE rotation_daily_hour = ? AND rotation_channel_id IS NOT NULL
       AND (rotation_last_daily_date IS NULL OR rotation_last_daily_date != ?)`
  )
    .bind(hora, hoje)
    .all();
  return results;
}

export async function marcarRotacaoDiario(env, guildId, hoje) {
  await env.DB.prepare("UPDATE guild_config SET rotation_last_daily_date = ? WHERE guild_id = ?")
    .bind(hoje, guildId)
    .run();
}

export async function listarNoticiasAtiva(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM guild_config WHERE news_enabled = 1"
  ).all();
  return results;
}

export async function urlsDeNoticiasPostadas(env) {
  const { results } = await env.DB.prepare("SELECT url FROM news_posted").all();
  return new Set(results.map((r) => r.url));
}

export async function marcarNoticiaPostada(env, url) {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO news_posted (url, posted_at) VALUES (?, datetime('now'))"
  )
    .bind(url)
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

export async function pegarUltimaMensagemRotacao(env, guildId) {
  return env.DB.prepare(
    `SELECT rotation_last_message_id AS mensagem_id,
            rotation_last_message_channel_id AS canal_id
     FROM guild_config WHERE guild_id = ?`
  )
    .bind(guildId)
    .first();
}

// Upsert e não update: o botão "postar agora" do painel funciona mesmo antes
// de o servidor ter salvado configuração, então a linha pode não existir.
export async function salvarUltimaMensagemRotacao(env, guildId, canalId, mensagemId) {
  await env.DB.prepare(
    `INSERT INTO guild_config (guild_id, rotation_last_message_id, rotation_last_message_channel_id)
     VALUES (?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       rotation_last_message_id = excluded.rotation_last_message_id,
       rotation_last_message_channel_id = excluded.rotation_last_message_channel_id`
  )
    .bind(guildId, mensagemId, canalId)
    .run();
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

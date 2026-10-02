-- Configuração de cada servidor: canal escolhido e se a função está ligada.
-- patch_daily_hour/rotation_daily_hour (0-23, fuso America/Sao_Paulo): se
-- preenchido, posta a informação atual todo dia nesse horário em vez de só
-- quando muda. *_last_daily_date guarda a última data em que já postou, pra
-- não postar de novo no mesmo dia a cada 15 minutos.
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id TEXT PRIMARY KEY,
  patch_enabled INTEGER NOT NULL DEFAULT 0,
  patch_channel_id TEXT,
  patch_daily_hour INTEGER,
  patch_last_daily_date TEXT,
  rotation_enabled INTEGER NOT NULL DEFAULT 0,
  rotation_channel_id TEXT,
  rotation_daily_hour INTEGER,
  rotation_last_daily_date TEXT,
  -- Última mensagem de rotação postada: é apagada antes de postar a nova, pra
  -- não empilhar lista velha no canal.
  rotation_last_message_id TEXT,
  rotation_last_message_channel_id TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Estado do bot que não é por servidor (última versão de patch vista, etc).
CREATE TABLE IF NOT EXISTS bot_state (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Quantas vezes cada comando foi usado em cada servidor. Só a contagem:
-- nada de quem usou, pra não armazenar dado pessoal.
CREATE TABLE IF NOT EXISTS command_usage (
  guild_id TEXT NOT NULL,
  comando TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  ultimo_uso TEXT,
  PRIMARY KEY (guild_id, comando)
);

-- Notícias oficiais do LoL (site em pt-BR): canal próprio por servidor.
ALTER TABLE guild_config ADD COLUMN news_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guild_config ADD COLUMN news_channel_id TEXT;

-- O horário fixo diário do patch saiu: como o patch só muda a cada duas
-- semanas, postar todo dia repetia a mesma coisa. Agora é só verificação de
-- novidade (ver checarPatch).
ALTER TABLE guild_config DROP COLUMN patch_daily_hour;
ALTER TABLE guild_config DROP COLUMN patch_last_daily_date;

-- Quais notícias já foram anunciadas, pra nunca repetir. Guarda a URL porque
-- é o identificador estável de cada artigo.
CREATE TABLE IF NOT EXISTS news_posted (
  url TEXT PRIMARY KEY,
  posted_at TEXT NOT NULL
);

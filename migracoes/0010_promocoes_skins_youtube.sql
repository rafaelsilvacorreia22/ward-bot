-- Três avisos novos, cada um com seu canal: skins em promoção na loja,
-- skins novas no jogo e vídeos novos do canal oficial do LoL no YouTube.
ALTER TABLE guild_config ADD COLUMN sale_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guild_config ADD COLUMN sale_channel_id TEXT;
ALTER TABLE guild_config ADD COLUMN sale_last_error TEXT;
ALTER TABLE guild_config ADD COLUMN sale_last_error_at TEXT;
ALTER TABLE guild_config ADD COLUMN skins_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guild_config ADD COLUMN skins_channel_id TEXT;
ALTER TABLE guild_config ADD COLUMN skins_last_error TEXT;
ALTER TABLE guild_config ADD COLUMN skins_last_error_at TEXT;
ALTER TABLE guild_config ADD COLUMN youtube_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guild_config ADD COLUMN youtube_channel_id TEXT;
ALTER TABLE guild_config ADD COLUMN youtube_last_error TEXT;
ALTER TABLE guild_config ADD COLUMN youtube_last_error_at TEXT;

-- Toda skin que o bot já viu no Data Dragon. O que aparecer num patch novo e
-- não estiver aqui é skin nova (ver varrerSkinsNovas em avisos.js).
CREATE TABLE IF NOT EXISTS skins_conhecidas (
  skin_id INTEGER PRIMARY KEY,
  campeao_id INTEGER NOT NULL,
  nome TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS skins_conhecidas_campeao ON skins_conhecidas (campeao_id);

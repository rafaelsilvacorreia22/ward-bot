-- Cargo (opcional) que cada aviso marca ao ser postado, escolhido no painel.
-- Vazio = não marca ninguém (o padrão).
ALTER TABLE guild_config ADD COLUMN patch_role_id TEXT;
ALTER TABLE guild_config ADD COLUMN news_role_id TEXT;
ALTER TABLE guild_config ADD COLUMN sale_role_id TEXT;
ALTER TABLE guild_config ADD COLUMN skins_role_id TEXT;
ALTER TABLE guild_config ADD COLUMN youtube_role_id TEXT;

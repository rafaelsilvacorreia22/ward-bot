-- Horário fixo diário (opcional) por servidor: se preenchido, posta a
-- informação atual todo dia nesse horário em vez de só quando muda.
ALTER TABLE guild_config ADD COLUMN patch_daily_hour INTEGER;
ALTER TABLE guild_config ADD COLUMN patch_last_daily_date TEXT;
ALTER TABLE guild_config ADD COLUMN rotation_daily_hour INTEGER;
ALTER TABLE guild_config ADD COLUMN rotation_last_daily_date TEXT;

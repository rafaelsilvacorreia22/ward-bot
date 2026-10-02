-- Quantas vezes cada comando foi usado em cada servidor. Guarda só a
-- contagem: nada de quem usou, pra não passar a armazenar dado pessoal (ver
-- a política de privacidade).
CREATE TABLE IF NOT EXISTS command_usage (
  guild_id TEXT NOT NULL,
  comando TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  ultimo_uso TEXT,
  PRIMARY KEY (guild_id, comando)
);

-- Uso de comandos por servidor e por dia (fuso de Brasília), para o painel
-- admin mostrar o que aconteceu nas últimas 24h / 7 dias e perceber spam. A
-- command_usage continua com o total desde sempre. As vezes em que o servidor
-- bateu no limite de comandos entram aqui com comando = '__limite'.
CREATE TABLE IF NOT EXISTS comandos_por_dia (
  guild_id TEXT NOT NULL,
  dia TEXT NOT NULL,
  comando TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, dia, comando)
) WITHOUT ROWID;

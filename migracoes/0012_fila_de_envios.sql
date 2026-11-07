-- Fila dos avisos automáticos (patch, notícias, promoções, skins, YouTube).
-- Em vez de mandar para todos os servidores numa execução só — o plano free
-- do Worker para em ~50 envios —, cada aviso entra aqui e o cron manda um
-- lote por rodada (ver enfileirar e drenarFila em src/index.js).
CREATE TABLE IF NOT EXISTS envios_pendentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  canal_id TEXT NOT NULL,
  corpo TEXT NOT NULL,       -- a mensagem do Discord, em JSON
  funcao TEXT NOT NULL,      -- patch / noticias / promocoes / skins / youtube
  tentativas INTEGER NOT NULL DEFAULT 0,
  criado TEXT NOT NULL
);

-- Post que se atualiza (promoções da semana, skins novas do patch): quando
-- sai uma versão nova do MESMO assunto, o Ward apaga a anterior no canal e
-- deixa só a nova. Antes, a lista de promoções crescendo ao longo da semana
-- virava vários posts quase iguais seguidos.
--
-- `grupo` diz qual é o assunto: para promoções, a data de fim da promoção;
-- para skins novas, a versão do patch. Mesmo grupo = atualização (apaga o
-- anterior); grupo diferente = assunto novo (o anterior fica).
ALTER TABLE envios_pendentes ADD COLUMN grupo TEXT;

CREATE TABLE IF NOT EXISTS ultimas_mensagens (
  guild_id TEXT NOT NULL,
  funcao TEXT NOT NULL,
  grupo TEXT NOT NULL,
  canal_id TEXT NOT NULL,
  mensagem_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, funcao)
) WITHOUT ROWID;

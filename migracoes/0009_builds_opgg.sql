-- O /build passou a usar as estatísticas do OP.GG em vez de coletar partidas
-- pela API da Riot (a coleta própria, limitada pelo plano free, juntava só
-- um punhado de jogos por campeão). As tabelas da coleta saem.
DROP TABLE IF EXISTS build_amostra;
DROP TABLE IF EXISTS build_partidas;
DELETE FROM bot_state WHERE key IN ('coleta_estado', 'coleta_jogadores', 'coleta_ok_em', 'coleta_erro', 'coleta_erro_em', 'vitrine_build', 'vitrine_build_em');

-- Cache das builds já buscadas no OP.GG ("build:<CAMPEAO>:<modo>:<rota>") e
-- da rota principal de cada campeão ("rota:<CAMPEAO>").
CREATE TABLE IF NOT EXISTS build_cache (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  em TEXT NOT NULL
);

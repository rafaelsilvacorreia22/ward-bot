-- 1) A rotação semanal saiu do bot (o endpoint oficial da Riot congelou e a
-- lista ficava velha). As colunas rotation_* ficam onde estão — nada mais lê
-- nem grava nelas —, mas a função é desligada em todo mundo para o painel de
-- uso não contar servidor com "aviso ligado" que não existe mais.
UPDATE guild_config SET rotation_enabled = 0;

-- 2) Resumo de cada participante das partidas coletadas para o /build. Sem
-- nada que identifique o jogador. A chave começa por (fila, campeao) porque
-- é exatamente a busca do /build: lê só as linhas daquele campeão, sem
-- índice extra (no plano free cada índice dobra as linhas gravadas).
CREATE TABLE IF NOT EXISTS build_amostra (
  fila INTEGER NOT NULL,          -- 420 ranqueada solo/duo, 450 ARAM
  campeao INTEGER NOT NULL,       -- championId (o "key" do Data Dragon)
  patch INTEGER NOT NULL,         -- 16.21 -> 1621, para ordenar certo
  match_id TEXT NOT NULL,
  participante INTEGER NOT NULL,
  rota TEXT NOT NULL DEFAULT '',  -- TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY; vazio no ARAM
  vitoria INTEGER NOT NULL,
  itens TEXT NOT NULL DEFAULT '', -- itens finais na ordem dos slots
  botas INTEGER NOT NULL DEFAULT 0,
  inicio TEXT NOT NULL DEFAULT '',
  runas TEXT NOT NULL DEFAULT '',
  feiticos TEXT NOT NULL DEFAULT '',
  habilidades TEXT NOT NULL DEFAULT '', -- ex.: "QEWQQRQ..."
  PRIMARY KEY (fila, campeao, patch, match_id, participante)
) WITHOUT ROWID;

-- 3) Partidas já lidas (inclusive as descartadas, como remake), para a coleta
-- não buscar a mesma duas vezes. Limpa depois de 4 dias.
CREATE TABLE IF NOT EXISTS build_partidas (
  match_id TEXT PRIMARY KEY,
  em TEXT NOT NULL
);

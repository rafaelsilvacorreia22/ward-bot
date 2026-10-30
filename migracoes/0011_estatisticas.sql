-- Estatísticas do painel de administração. Tudo agregado por dia (fuso de
-- Brasília) — nenhuma tabela guarda IP, nome ou conta de quem visitou.

-- Visitas por página.
CREATE TABLE IF NOT EXISTS acessos (
  dia TEXT NOT NULL,
  caminho TEXT NOT NULL,
  visitas INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, caminho)
) WITHOUT ROWID;

-- Visitante único do dia: um hash de (dia + IP + navegador + segredo do
-- servidor). Como o dia entra no hash, não dá para seguir a mesma pessoa de
-- um dia pro outro, nem voltar do hash para o IP. Apagado depois de 60 dias.
CREATE TABLE IF NOT EXISTS visitantes (
  dia TEXT NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (dia, hash)
) WITHOUT ROWID;

-- De onde a visita veio (domínio do link anterior: google, discord, top.gg...).
CREATE TABLE IF NOT EXISTS origens (
  dia TEXT NOT NULL,
  origem TEXT NOT NULL,
  visitas INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, origem)
) WITHOUT ROWID;

-- Ações que importam: clique em "Adicionar ao Discord", login no painel.
CREATE TABLE IF NOT EXISTS eventos (
  dia TEXT NOT NULL,
  evento TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, evento)
) WITHOUT ROWID;

-- Quais builds as pessoas pedem no /build e no /build-aram.
CREATE TABLE IF NOT EXISTS builds_pedidas (
  campeao TEXT NOT NULL,
  modo TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  ultimo TEXT,
  PRIMARY KEY (campeao, modo)
) WITHOUT ROWID;

-- Retrato diário do bot: em quantos servidores está e quantos membros alcança.
CREATE TABLE IF NOT EXISTS metricas_diarias (
  dia TEXT PRIMARY KEY,
  servidores INTEGER NOT NULL,
  membros INTEGER NOT NULL
);

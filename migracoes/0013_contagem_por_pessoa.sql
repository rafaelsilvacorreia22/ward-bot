-- Contagem nova de acessos (08/11/2026), que substitui acessos/visitantes/
-- origens da 0011 — essas ficam só como histórico.
--
-- O que mudou:
-- - Só conta quem abre a página num navegador de verdade: a própria página
--   avisa o Ward (por JavaScript) que foi vista. Robô de busca, prévia de link
--   e programa que só baixa o HTML não rodam isso e ficam de fora.
-- - Cada pessoa (IP) conta uma vez: recarregar a página ou voltar nela no
--   mesmo dia não soma de novo.
-- - Cada pessoa tem um "código" que é o hash de IP + segredo do servidor. Não
--   dá para voltar do código para o IP, e o IP não é guardado. O código some
--   depois de 90 dias sem a pessoa voltar.

-- Uma linha por pessoa. A origem é a de quando ela chegou pela primeira vez:
-- é o que diz qual divulgação trouxe a pessoa.
CREATE TABLE IF NOT EXISTS pessoas (
  hash TEXT PRIMARY KEY,
  primeiro_dia TEXT NOT NULL,
  ultimo_dia TEXT NOT NULL,
  origem TEXT NOT NULL,
  dias INTEGER NOT NULL DEFAULT 1,
  convidou INTEGER NOT NULL DEFAULT 0,
  entrou INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS pessoas_primeiro_dia ON pessoas (primeiro_dia);

-- Em quais dias cada pessoa apareceu (visitantes por dia, novos x voltaram).
CREATE TABLE IF NOT EXISTS presencas (
  dia TEXT NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (dia, hash)
) WITHOUT ROWID;

-- Quais páginas cada pessoa viu no dia, sem repetir a mesma página.
CREATE TABLE IF NOT EXISTS vistas (
  dia TEXT NOT NULL,
  hash TEXT NOT NULL,
  caminho TEXT NOT NULL,
  PRIMARY KEY (dia, hash, caminho)
) WITHOUT ROWID;

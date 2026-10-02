-- O controle de "notícia já anunciada" era global, o que trazia dois
-- problemas: postar uma notícia à mão num servidor impedia que ela saísse nos
-- outros, e um servidor que ligasse a função depois nunca recebia nada até
-- aparecer artigo novo. Agora o controle é por servidor.
DROP TABLE IF EXISTS news_posted;

CREATE TABLE news_posted (
  guild_id TEXT NOT NULL,
  url TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  PRIMARY KEY (guild_id, url)
);

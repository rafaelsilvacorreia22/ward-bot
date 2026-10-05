-- As notícias do próprio leagueoflegends.com vinham com caminho relativo
-- ("/pt-br/news/..."), e o Discord recusa embed cuja url não seja absoluta.
-- O buscarNoticias passou a resolver contra o site; estas linhas foram
-- gravadas no formato antigo e precisam acompanhar, senão o bot trataria
-- todas como novidade e reanunciaria tudo de uma vez.
--
-- Rodar ANTES do deploy do código novo: no intervalo, o código antigo ainda
-- gera url relativa, não casa com estas linhas e só tenta postar — falhando
-- com 400, como já falhava. Na ordem inversa haveria uma janela em que as
-- notícias antigas seriam reanunciadas.
UPDATE news_posted
SET url = 'https://www.leagueoflegends.com' || url
WHERE url LIKE '/%';

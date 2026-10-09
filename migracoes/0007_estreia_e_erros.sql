-- 1) Marca explícita de "este servidor já recebeu a carga inicial".
--
-- Antes isso era inferido de "news_posted está vazio para este servidor", um
-- proxy que quebrou na prática: o botão "Postar notícia" do painel grava uma
-- linha, e a partir daí o servidor nunca mais era tratado como estreante —
-- passava a ter que *enviar* o mês inteiro de atrasado, item por item. Foi
-- assim que o "Hora do Chá" acabou com 17 notícias na fila.
ALTER TABLE guild_config ADD COLUMN news_seeded_at TEXT;

-- 2) Último erro de envio, por função.
--
-- Até aqui a falha era só um console.log: o feed de um servidor podia ficar
-- morto por dias sem nada em lugar nenhum. Agora fica gravado e aparece no
-- painel de quem administra o servidor e no /admin/uso.
ALTER TABLE guild_config ADD COLUMN patch_last_error TEXT;
ALTER TABLE guild_config ADD COLUMN patch_last_error_at TEXT;
ALTER TABLE guild_config ADD COLUMN news_last_error TEXT;
ALTER TABLE guild_config ADD COLUMN news_last_error_at TEXT;
ALTER TABLE guild_config ADD COLUMN rotation_last_error TEXT;
ALTER TABLE guild_config ADD COLUMN rotation_last_error_at TEXT;

-- 3) Backfill obrigatório: quem já tem notícia marcada já passou da estreia.
-- Sem isto, o primeiro cron depois do deploy trataria todos como estreantes.
-- Não causaria spam (a estreia marca sem postar), mas pularia uma rodada à
-- toa e zeraria a noção de quem é realmente novo.
UPDATE guild_config
SET news_seeded_at = datetime('now')
WHERE guild_id IN (SELECT DISTINCT guild_id FROM news_posted);

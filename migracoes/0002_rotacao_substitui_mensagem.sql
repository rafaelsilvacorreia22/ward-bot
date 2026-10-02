-- Guarda qual foi a última mensagem de rotação de cada servidor, pra apagá-la
-- antes de postar a nova. A rotação muda toda semana; sem isso o canal vai
-- acumulando listas velhas. Guarda o canal também porque o admin pode ter
-- trocado o canal entre uma postagem e a outra.
ALTER TABLE guild_config ADD COLUMN rotation_last_message_id TEXT;
ALTER TABLE guild_config ADD COLUMN rotation_last_message_channel_id TEXT;

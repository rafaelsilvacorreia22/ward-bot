# Ward — bot de League of Legends para Discord

Bot que qualquer servidor pode adicionar (não precisa mexer em código). Dois
avisos, cada um com seu canal, configurados pelo **dashboard web**, e um
comando de build:

- **Patch novo**: a versão e o resumo oficial traduzido, quando sai patch.
- **Notícias oficiais**: CBLOL e outros esports, skins, atualizações do jogo
  e comunicados — direto do site da Riot em português.
- **`/build <campeão> [modo] [rota]`**: a build que mais ganha no meta atual
  (itens iniciais, build principal, botas, opções de 4º item em diante,
  runas, feitiços e ordem de habilidades), com o ícone de cada item. Também
  em página no site: `/build` e `/build/<campeão>`.

Comandos: `/patch`, `/build`, `/dashboard` (manda o link de configuração
daquele servidor).

A **rotação semanal** existiu até 10/2026 e saiu: o endpoint oficial da Riot
(`champion-rotations`) congelou e passou a devolver a mesma lista por
semanas, então o bot anunciava rotação velha como se fosse nova.

## Como o /build se mantém no meta

Nenhum site de builds (op.gg, u.gg, Porofessor) tem API pública, e raspar
HTML deles quebra a cada mudança de layout. Então o Ward monta as próprias
estatísticas com a chave da Riot (`src/builds.js`):

1. A cada 2 minutos (cron próprio), pega o histórico recente de um jogador
   Desafiante/Grão-Mestre do BR (lista renovada 1×/dia) — 2 de cada 3 vezes
   na ranqueada solo/duo, 1 no ARAM — e lê algumas partidas novas (match-v5 +
   timeline). ~3 partidas por rodada, ~2 mil por dia, folgado no limite da
   chave e no plano free do Worker.
2. De cada participante guarda só o anônimo em `build_amostra`: campeão,
   rota, vitória, itens finais, botas, itens iniciais, runas, feitiços e
   ordem de habilidades. Fica só o patch atual e o anterior (faxina diária).
3. No `/build`, agrega na hora: entre as opções usadas em pelo menos 4% das
   partidas, escolhe a de maior vitória ajustada pelo tamanho da amostra
   (limite inferior de Wilson). Patch novo com menos de 60 partidas usa o
   anterior junto.

Os ícones viram **emojis do aplicativo** (itens `i<id>`, runas `r<id>`,
feitiços `s<key>`), subidos aos poucos pelo próprio cron da coleta — item
novo de patch novo aparece sozinho. Os slash commands também se registram
sozinhos quando a lista muda (`comandos_registrados` no `bot_state`).

## Por que não tem contagem de jogadores nem elo/partida ao vivo

Diferente dos bots de Steam (ARC Raiders, WARDOGS, HELLDIVERS 2), o LoL usa a
**Riot Games API**, que não expõe contagem de jogadores online. E qualquer
recurso que olhe dados de um jogador específico (elo, partida ao vivo)
precisa de uma **Production Key** da Riot (pedido de aprovação deles). Uma
chave pessoal ("Personal API Key") funciona, mas **expira sozinha a cada
24h** e precisa ser renovada à mão — por isso o v1 só usa:

- **Alerta de patch**: não precisa de chave nenhuma (Data Dragon é público).
- **Notícias**: também sem chave — vêm do site oficial em pt-BR.
- **/build**: precisa de chave da Riot com acesso a league-v4 e match-v5 (a
  chave de produto/"Personal API Key" aprovada não expira). Se a chave
  falhar, a coleta para e o erro aparece no `/admin/uso`; o `/build` segue
  respondendo com o que já foi coletado.

Uma pegadinha descoberta na marra: a numeração pública do patch não é a mesma
do Data Dragon (o "16.19" de lá é o "26.19" do site), e isso não está
documentado em lugar nenhum — ver `urlNotasPatch` em `src/riot.js`.

## Arquitetura

Um único Cloudflare Worker + banco D1, sem framework, sem build:

```
src/index.js      # rotas HTTP + crons (patch / notícias; coleta do /build)
src/discord.js    # verificação de assinatura + chamadas REST da Discord
src/oauth.js      # "Entrar com Discord" do dashboard (sessão em cookie assinado)
src/riot.js       # versão do jogo e roster de campeões (Data Dragon)
src/builds.js     # coleta de partidas (Riot API) e agregação do /build
src/noticias.js   # notícias oficiais do site da Riot em pt-BR
src/traducao.js   # tradução do resumo do patch (Workers AI, com reservas)
src/comandos.js   # /patch, /build, /dashboard
src/paginas.js    # HTML do site e do dashboard
src/db.js         # consultas ao D1
schema.sql        # tabelas do D1
migracoes/        # alterações de schema aplicadas depois, uma por arquivo
```

O dashboard mora no mesmo Worker (não é um site separado): `/` é a página
pública com o link de convite, `/login` entra com Discord, `/dashboard`
lista os servidores que a pessoa administra e onde o Ward já está,
`/dashboard/<id do servidor>` é o formulário de configuração daquele
servidor. Nele também dá pra:
- **Postar agora**: manda o patch atual (ou uma notícia escolhida) pro canal
  na hora, sem esperar o cron (bom pra testar o canal antes de salvar).

Cada aviso só sai quando há novidade de verdade: a versão do jogo mudou ou
saiu um artigo que ainda não foi anunciado.

Rotas de administração (protegidas pelo `SETUP_KEY`): `/admin/uso` mostra em
quais servidores o bot está e quanto cada função é usada, `/admin/checar`
força uma verificação (exige `?servidor=<id>`, pra um teste nunca postar em
todos os servidores de uma vez) e `/admin/sincronizar` marca tudo como já
anunciado sem postar nada. `/admin/coletar` roda uma rodada da coleta do
`/build` na hora (bom pra testar a chave da Riot).

## Colocar no ar (passo a passo)

### 1. Criar a aplicação no Discord

1. Acesse https://discord.com/developers/applications → **New Application**
   → nome "Ward".
2. Guarde o **Application ID** (é o `DISCORD_CLIENT_ID`).
3. Aba **OAuth2** → **Client Secret** → copie (é o `DISCORD_CLIENT_SECRET`).
   Em **Redirects**, adicione `https://SEU-WORKER.workers.dev/auth/callback`
   (troque pela URL real depois do deploy).
4. Aba **Bot** → copie o **Public Key** (que fica em General Information,
   não em Bot) — é o `DISCORD_PUBLIC_KEY`. Em Bot, clique **Reset Token** e
   copie o token (é o `DISCORD_TOKEN`).

Guarde essas quatro coisas num lugar seguro (não vão pro GitHub).

### 2. Criar o banco D1 e ajustar o `wrangler.jsonc`

```bash
npx wrangler d1 create ward-bot
```

Copie o `database_id` que aparecer e cole no lugar de
`PREENCHER_DEPOIS_DO_WRANGLER_D1_CREATE` em `wrangler.jsonc`. Depois:

```bash
npm run banco
```

E aplique as migrações, em ordem (`migracoes/0001...` até a última):

```bash
npx wrangler d1 execute ward-bot --remote --file=migracoes/0008_builds.sql
```

### 3. Configurar os segredos do Worker

Pela aba **Settings → Variables and Secrets** do Worker no painel da
Cloudflare (ou `npx wrangler secret put NOME`, um de cada vez):

| Nome | O que é |
|---|---|
| `DISCORD_TOKEN` | Token do bot (aba Bot) |
| `DISCORD_PUBLIC_KEY` | Public Key (General Information) |
| `DISCORD_CLIENT_ID` | Application ID — pode ser variável normal, não é segredo |
| `DISCORD_CLIENT_SECRET` | Client Secret (aba OAuth2) |
| `SESSION_SECRET` | Uma string aleatória grande (ex: gerada com `openssl rand -hex 32`) — assina o cookie de login |
| `SETUP_KEY` | Uma senha inventada por você — protege as rotas `/registrar-comandos` e `/admin/checar` |
| `RIOT_API_KEY` | Chave da Riot (https://developer.riotgames.com/) para o `/build`. Use a chave de produto aprovada — a de desenvolvimento expira a cada 24h |

### 4. Deploy

```bash
npm install
npm run deploy
```

Copie a URL que aparecer (tipo `https://ward-bot.SEU-USUARIO.workers.dev`) e:
- volte no Discord Developer Portal → aba **General Information** → em
  **Interactions Endpoint URL**, cole `<sua-url>` (a raiz mesmo — é lá que o
  Worker recebe os POSTs de interação);
- confirme que o Redirect do OAuth2 (passo 1.3) bate com `<sua-url>/auth/callback`.

### 5. Registrar os comandos

Acesse (no navegador) `<sua-url>/registrar-comandos?chave=SUA_SETUP_KEY`.
Deve responder `{"ok":true,...}`. Os comandos levam até ~1h pra aparecer em
todo lugar (comando global).

### 6. Testar

1. Convide o bot pro seu servidor de teste pelo link que aparece na página
   inicial (`<sua-url>`).
2. Entre em `<sua-url>` → **Entrar com Discord** → escolha o servidor →
   marque "Avisar quando sair patch novo" e escolha o canal → Salvar.
3. Force uma checagem sem esperar o cron:
   `<sua-url>/admin/checar?chave=SUA_SETUP_KEY` — deve aparecer uma
   mensagem no canal escolhido (só posta se a versão mudou desde a última
   vez; na primeira vez sempre posta, porque não tem versão salva ainda).
4. No Discord, teste `/patch`, `/build` e `/dashboard`.

## Rodando localmente

```bash
cp .dev.vars.example .dev.vars   # preenche com valores de teste
npm run dev
```

Sem uma URL pública (túnel), o Discord não consegue validar a assinatura das
interações em `wrangler dev` local — dá pra testar as rotas do dashboard
(`/`, `/login` etc.) mas os slash commands só funcionam depois do deploy.

## Troubleshooting

| Sintoma | Causa provável |
|---|---|
| `/patch` ou `/build` não respondem nada | Comando ainda não propagou (espera até 1h após registrar) ou `DISCORD_PUBLIC_KEY` errada |
| `/build` sempre diz "ainda juntando partidas" | Coleta parada: veja o cartão "Coleta do /build" em `/admin/uso` (chave da Riot recusada, por exemplo) |
| Tudo que posta no Discord falha com 401 | `DISCORD_TOKEN` inválido (foi resetado no Developer Portal) — gere um novo e salve no Worker |
| Dashboard fica voltando pro login | `SESSION_SECRET` mudou (invalida cookies antigos) ou cookie expirou (7 dias) |
| "Você não administra esse servidor" | Sua conta não tem permissão de Gerenciar Servidor lá, ou o bot não foi convidado ainda |
| Patch não chega no canal mesmo com tudo configurado | Rode `/admin/checar?chave=...` e veja a resposta JSON — ela mostra o erro exato |
| Erro ao salvar no D1 | `database_id` no `wrangler.jsonc` não bate com o banco criado, ou o schema não foi aplicado (`npm run banco`) |

## Limite conhecido de escala

O cron posta em lotes de 8 servidores por vez pra não estourar rate limit da
Discord nem o limite de sub-requests do Worker (50 por execução no plano
free da Cloudflare). Se o Ward crescer além de uns 30–40 servidores com
alertas ligados ao mesmo tempo, vale migrar pro plano pago da Cloudflare ou
trocar o loop por uma fila (Cloudflare Queues).

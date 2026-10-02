# Ward — bot de League of Legends para Discord

Bot que qualquer servidor pode adicionar (não precisa mexer em código):
avisa quando sai patch novo do LoL e mostra a rotação semanal de campeões
grátis. Cada servidor configura sozinho, pelo **dashboard web**, em qual
canal o bot posta.

Comandos: `/patch`, `/rotacao`, `/dashboard` (manda o link de configuração
daquele servidor).

## Por que não tem contagem de jogadores nem elo/partida ao vivo

Diferente dos bots de Steam (ARC Raiders, WARDOGS, HELLDIVERS 2), o LoL usa a
**Riot Games API**, que não expõe contagem de jogadores online. E qualquer
recurso que olhe dados de um jogador específico (elo, partida ao vivo)
precisa de uma **Production Key** da Riot (pedido de aprovação deles). Uma
chave pessoal ("Personal API Key") funciona, mas **expira sozinha a cada
24h** e precisa ser renovada à mão — por isso o v1 só usa:

- **Alerta de patch**: não precisa de chave nenhuma (Data Dragon é público). A
  mensagem traz quais campeões tiveram atributos alterados (comparando os
  dados da versão antiga com a nova) e um link pra listagem oficial de notas
  — a Riot não publica o texto das notas em nenhuma API, e tentar adivinhar a
  URL do artigo de cada patch se mostrou não confiável (deu 404 nos testes).
- **Rotação semanal**: precisa de chave, mas se a chave vencer o recurso só
  fica quieto (não quebra o bot, não spama erro) até alguém renovar.

## Arquitetura

Um único Cloudflare Worker + banco D1, sem framework, sem build:

```
src/index.js      # rotas HTTP + cron (patch/rotação)
src/discord.js    # verificação de assinatura + chamadas REST da Discord
src/oauth.js      # "Entrar com Discord" do dashboard (sessão em cookie assinado)
src/riot.js       # versão do jogo (Data Dragon) + rotação de campeões
src/comandos.js   # /patch, /rotacao, /dashboard
src/paginas.js    # HTML do dashboard
src/db.js         # consultas ao D1
schema.sql        # tabelas do D1
```

O dashboard mora no mesmo Worker (não é um site separado): `/` é a página
pública com o link de convite, `/login` entra com Discord, `/dashboard`
lista os servidores que a pessoa administra e onde o Ward já está,
`/dashboard/<id do servidor>` é o formulário de configuração daquele
servidor. Nele também dá pra:
- **Postar agora**: manda o patch/rotação atual pro canal escolhido na hora,
  sem esperar o cron (bom pra testar o canal antes de salvar).
- **Horário fixo diário**: em vez de só avisar quando muda, posta a
  informação atual todo dia num horário escolhido (fuso de Brasília). Fica
  desligado por padrão (mantém o comportamento de "só avisa quando muda").

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
| `RIOT_API_KEY` | Opcional. Chave pessoal em https://developer.riotgames.com/ — **expira a cada 24h**, sem ela a rotação só fica desligada |

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
4. No Discord, teste `/patch`, `/rotacao` e `/dashboard`.

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
| `/patch` ou `/rotacao` não respondem nada | Comando ainda não propagou (espera até 1h após registrar) ou `DISCORD_PUBLIC_KEY` errada |
| `/rotacao` sempre diz "indisponível" | `RIOT_API_KEY` vencida (renove em developer.riotgames.com) ou não configurada |
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

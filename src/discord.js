// Camada fina sobre a API do Discord: verificação de assinatura e chamadas
// REST usadas tanto pelas interações quanto pelo dashboard.

export const API = "https://discord.com/api/v10";

// Endereço público do site. O cron não tem requisição de onde tirar a
// origem, então fica fixo aqui. O antigo (ward-bot.ghostbot.workers.dev)
// ainda responde, mas redireciona as páginas para cá (ver index.js).
export const SITE = "https://wardbot.com.br";

// Os avisos saem limpos, sem "Enviado pelo Ward" nem link do site: a linha
// ficava colada no link do vídeo/da notícia e atrapalhava. Quem quer saber
// de onde vem o aviso clica no Ward e vê o link no perfil do bot (descrição
// no Developer Portal).

export const TIPO_INTERACAO = {
  PING: 1,
  COMANDO: 2,
  AUTOCOMPLETE: 4,
};

export const RESPOSTA = {
  PONG: 1,
  MENSAGEM: 4,
  ADIAR_MENSAGEM: 5, // mostra "pensando..." e libera os 3s de prazo
  SUGESTOES: 8, // resposta do autocomplete
};

export const EFEMERA = 64; // flag de mensagem que só o autor enxerga

function hexParaBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// O Discord assina cada requisição com Ed25519 e periodicamente manda pedidos
// com assinatura inválida de propósito, para conferir que o endpoint rejeita.
// Responder 401 nesses casos é obrigatório — sem isso ele recusa salvar a URL.
export async function assinaturaValida(request, corpoBruto, chavePublica) {
  const assinatura = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  if (!assinatura || !timestamp || !chavePublica) return false;

  try {
    const chave = await crypto.subtle.importKey(
      "raw",
      hexParaBytes(chavePublica),
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      chave,
      hexParaBytes(assinatura),
      new TextEncoder().encode(timestamp + corpoBruto)
    );
  } catch {
    return false;
  }
}

// Quando o Discord pede calma (429) por pouco tempo, espera o que ele mandou
// e tenta de novo (até 2 vezes) em vez de quebrar a página. Cliques
// seguidos no painel (salvar sozinho + postar + recarregar) caíam nisso.
const ESPERA_MAXIMA_429_MS = 3000;

export async function api(env, caminho, opcoes = {}, tentativa = 0) {
  const res = await fetch(`${API}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bot ${(env.DISCORD_TOKEN ?? "").trim()}`,
      "Content-Type": "application/json",
      ...(opcoes.headers ?? {}),
    },
  });

  if (res.status === 429 && tentativa < 2) {
    const corpo = await res.json().catch(() => ({}));
    const esperaMs = Math.ceil(Number(corpo.retry_after ?? res.headers.get("Retry-After") ?? 1) * 1000);
    if (esperaMs <= ESPERA_MAXIMA_429_MS) {
      await new Promise((r) => setTimeout(r, esperaMs + 50));
      return api(env, caminho, opcoes, tentativa + 1);
    }
    throw new Error(`Discord ${opcoes.method ?? "GET"} ${caminho} -> 429 ${JSON.stringify(corpo)}`);
  }

  if (!res.ok) {
    throw new Error(
      `Discord ${opcoes.method ?? "GET"} ${caminho} -> ${res.status} ${await res.text()}`
    );
  }
  return res.status === 204 ? null : res.json();
}

// Nenhuma mensagem do bot marca ninguém, a não ser quando quem chama pede
// explicitamente. Sem isto, texto vindo de fora repetido pelo bot (o nome
// de campeão digitado no /build, por exemplo) poderia disparar @everyone ou
// marcar cargos no servidor com a permissão do bot.
const SEM_MENCOES = { parse: [] };
const semMencoes = (corpo) => ({ allowed_mentions: SEM_MENCOES, ...corpo });

// Edita a mensagem que o bot já respondeu (depois de ADIAR_MENSAGEM). Usa o
// token da interação, não o do bot — por isso não passa pelo api() acima.
export async function editarResposta(interacao, corpo) {
  const res = await fetch(
    `${API}/webhooks/${interacao.application_id}/${interacao.token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(semMencoes(corpo)),
    }
  );
  if (!res.ok) {
    throw new Error(`Falha ao editar resposta: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Mensagem extra na mesma interação (o Discord só deixa 10 embeds por
// mensagem, e a rotação de campeões costuma ter 20).
export async function enviarFollowup(interacao, corpo) {
  const res = await fetch(`${API}/webhooks/${interacao.application_id}/${interacao.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(semMencoes(corpo)),
  });
  if (!res.ok) {
    throw new Error(`Falha ao enviar mensagem extra: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// Todos os servidores onde o bot está, paginado (o máximo por página é 200).
// Usado pra responder "o Ward está no servidor X?" sem precisar de uma
// chamada por servidor: pedir /guilds/{id} direto não dá 404 quando o bot
// não está lá, dá 403 — não dá pra distinguir "não existe" de "sem acesso"
// checando servidor a servidor.
// with_counts traz o número aproximado de membros de cada servidor, usado na
// página de acompanhamento de uso.
// Fica 30 segundos em memória: cada clique no painel precisa dessa lista
// (para saber se a pessoa administra o servidor), e pedir de novo a cada
// clique estourava o limite do Discord.
const VALIDADE_SERVIDORES_MS = 30_000;
let servidoresEmCache = null;
let servidoresValidosAte = 0;

export async function listarServidoresDoBot(env) {
  if (servidoresEmCache && Date.now() < servidoresValidosAte) return servidoresEmCache;
  const lista = await buscarServidoresDoBot(env);
  servidoresEmCache = lista;
  servidoresValidosAte = Date.now() + VALIDADE_SERVIDORES_MS;
  return lista;
}

async function buscarServidoresDoBot(env) {
  const servidores = [];
  let after = "0";
  for (;;) {
    const pagina = await api(env, `/users/@me/guilds?limit=200&with_counts=true&after=${after}`);
    servidores.push(...pagina);
    if (pagina.length < 200) break;
    after = pagina[pagina.length - 1].id;
  }
  return servidores;
}

export async function listarCanaisTexto(env, guildId) {
  const canais = await api(env, `/guilds/${guildId}/channels`);
  return canais.filter((c) => c.type === 0);
}

// Perfil público de um usuário do Discord (nome, @, avatar, se é bot).
export async function pegarUsuario(env, usuarioId) {
  return api(env, `/users/${usuarioId}`);
}

// Cargos que dá para marcar nos avisos: tira o @everyone (o id dele é o do
// próprio servidor) e os cargos de bots/integrações (managed). Do mais alto
// para o mais baixo, como no Discord.
export async function listarCargos(env, guildId) {
  const cargos = await api(env, `/guilds/${guildId}/roles`);
  return cargos
    .filter((c) => c.id !== guildId && !c.managed)
    .sort((a, b) => b.position - a.position);
}

// Dados do servidor: nome, dono (owner_id) e canal de boas-vindas
// (system_channel_id). Só funciona em servidor onde o bot está.
export async function pegarServidor(env, guildId) {
  return api(env, `/guilds/${guildId}`);
}

// Mensagem privada. O Discord exige abrir (ou reaproveitar) o canal de DM
// antes de mandar; falha com 50007 se a pessoa não aceita DM de membros do
// servidor.
export async function enviarDM(env, usuarioId, corpo) {
  const canal = await api(env, "/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: usuarioId }),
  });
  return enviarMensagem(env, canal.id, corpo);
}

// Único caminho por onde o bot posta em canal (avisos e "postar agora").
export async function enviarMensagem(env, canalId, corpo) {
  return api(env, `/channels/${canalId}/messages`, {
    method: "POST",
    body: JSON.stringify(semMencoes(corpo)),
  });
}

// Apaga uma mensagem do próprio Ward (não precisa de permissão extra para
// apagar o que o bot mesmo postou). Mensagem já apagada (10008) conta como
// feito.
export async function apagarMensagem(env, canalId, mensagemId) {
  const res = await fetch(`${API}/channels/${canalId}/messages/${mensagemId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${(env.DISCORD_TOKEN ?? "").trim()}` },
  });
  if (res.ok || res.status === 404) return;
  throw new Error(`Discord DELETE mensagem -> ${res.status} ${await res.text()}`);
}

// Tira o bot de um servidor (botão do painel de uso, só para o dono do bot).
// Chamada direta, sem o Content-Type JSON do api(): é um DELETE sem corpo.
// "Servidor desconhecido" (10004) quer dizer que o bot já não está lá —
// conta como saída feita.
export async function sairDoServidor(env, guildId) {
  servidoresEmCache = null; // a lista em memória deixa de valer
  const res = await fetch(`${API}/users/@me/guilds/${guildId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${(env.DISCORD_TOKEN ?? "").trim()}` },
  });
  if (res.ok) return;
  const texto = await res.text();
  if (res.status === 404 || /10004/.test(texto)) return;
  throw new Error(`Discord DELETE /users/@me/guilds/${guildId} -> ${res.status} ${texto}`);
}

// Comando global (não por servidor): propaga pra todo lugar onde o bot está
// em até ~1h, sem precisar registrar servidor a servidor — essencial pra um
// bot pensado pra entrar em vários servidores diferentes.
export async function registrarComandosGlobais(env, definicoes) {
  const app = await api(env, "/oauth2/applications/@me");
  await api(env, `/applications/${app.id}/commands`, {
    method: "PUT",
    body: JSON.stringify(definicoes),
  });
  return app;
}

// Emojis do próprio aplicativo (não de um servidor): dá pra usar em qualquer
// mensagem que o bot mandar, em qualquer servidor, sem gastar os slots de
// emoji de ninguém. É assim que o /build mostra o ícone de cada item, runa e
// feitiço — vira texto com emoji, um embed só.
export async function listarEmojisDoApp(env) {
  const app = await api(env, "/oauth2/applications/@me");
  const resposta = await api(env, `/applications/${app.id}/emojis`);
  return { appId: app.id, emojis: resposta.items ?? resposta ?? [] };
}

export async function criarEmojiDoApp(env, appId, nome, dataUri) {
  return api(env, `/applications/${appId}/emojis`, {
    method: "POST",
    body: JSON.stringify({ name: nome, image: dataUri }),
  });
}

// Nome do emoji → id. Listar custa duas chamadas à Discord, e o conjunto só
// muda quando a sincronização sobe ícone novo, então fica 10 minutos em
// memória.
const VALIDADE_EMOJIS_MS = 10 * 60_000;
let emojisEmCache = null;
let emojisValidosAte = 0;

export async function mapaDeEmojis(env) {
  if (emojisEmCache && Date.now() < emojisValidosAte) return emojisEmCache;
  const { emojis } = await listarEmojisDoApp(env);
  emojisEmCache = new Map(emojis.map((e) => [e.name, e.id]));
  emojisValidosAte = Date.now() + VALIDADE_EMOJIS_MS;
  return emojisEmCache;
}

// Emoji se já tiver sido subido; senão, nada (quem chama põe o nome ao lado).
export function emoji(mapa, nome) {
  const id = mapa?.get(nome);
  return id ? `<:${nome}:${id}>` : "";
}

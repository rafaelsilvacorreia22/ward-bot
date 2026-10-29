// Camada fina sobre a API do Discord: verificação de assinatura e chamadas
// REST usadas tanto pelas interações quanto pelo dashboard.

export const API = "https://discord.com/api/v10";

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

export async function api(env, caminho, opcoes = {}) {
  const res = await fetch(`${API}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bot ${(env.DISCORD_TOKEN ?? "").trim()}`,
      "Content-Type": "application/json",
      ...(opcoes.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(
      `Discord ${opcoes.method ?? "GET"} ${caminho} -> ${res.status} ${await res.text()}`
    );
  }
  return res.status === 204 ? null : res.json();
}

// Edita a mensagem que o bot já respondeu (depois de ADIAR_MENSAGEM). Usa o
// token da interação, não o do bot — por isso não passa pelo api() acima.
export async function editarResposta(interacao, corpo) {
  const res = await fetch(
    `${API}/webhooks/${interacao.application_id}/${interacao.token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
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
    body: JSON.stringify(corpo),
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
export async function listarServidoresDoBot(env) {
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

export async function enviarMensagem(env, canalId, corpo) {
  return api(env, `/channels/${canalId}/messages`, {
    method: "POST",
    body: JSON.stringify(corpo),
  });
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

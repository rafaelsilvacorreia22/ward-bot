// Avisos de loja e mídia: skins em promoção, skins novas no jogo e vídeos
// novos do canal oficial do LoL no YouTube. Aqui só fica a parte de buscar e
// montar as mensagens; quem decide quando postar e para quem é o cron em
// index.js, igual ao patch e às notícias.

import { chamarOpgg } from "./builds.js";
import { versaoAtual, todosOsCampeoes } from "./riot.js";
import { pegarEstado, salvarEstado } from "./db.js";

const DDRAGON = "https://ddragon.leagueoflegends.com";

// A imagem de cada skin no Data Dragon é "<Campeão>_<número>", onde o número
// é o id da skin sem os três últimos dígitos do campeão (103015 -> Ahri_15).
export function urlSplashSkin(arquivoCampeao, skinId) {
  return `${DDRAGON}/cdn/img/champion/splash/${arquivoCampeao}_${skinId % 1000}.jpg`;
}

export function urlQuadroSkin(arquivoCampeao, skinId) {
  return `${DDRAGON}/cdn/img/champion/tiles/${arquivoCampeao}_${skinId % 1000}.jpg`;
}

const dataCurta = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

// ---------- promoções da loja ----------

// A Riot não publica a loja em API nenhuma; o OP.GG publica (mesma API aberta
// do /build). A promoção gira uma vez por semana.
export async function buscarPromocoes(env) {
  const dados = await chamarOpgg(
    {
      lang: "pt_BR",
      desired_output_fields: [
        "data[].{champion_id,skin_id,cost,discount_rate,started_at,ended_at,champion_name,skin_name}",
      ],
    },
    "lol_list_discounted_skins"
  );
  const lista = Array.isArray(dados) ? dados : [];
  const porId = new Map((await todosOsCampeoes(env, await versaoAtual())).map((c) => [c.id, c]));

  return lista
    .filter((s) => s?.skin_id && s?.cost)
    .map((s) => ({
      skinId: s.skin_id,
      nome: s.skin_name,
      arquivoCampeao: porId.get(s.champion_id)?.arquivoImagem ?? null,
      preco: s.cost,
      // O OP.GG dá o preço já com desconto; o cheio sai dele.
      precoCheio: Math.round(s.cost / (1 - s.discount_rate) / 5) * 5,
      desconto: Math.round(s.discount_rate * 100),
      termina: s.ended_at,
    }))
    .sort((a, b) => b.desconto - a.desconto);
}

// A assinatura muda quando a lista de skins ou o fim da promoção muda — é o
// que diz "saiu promoção nova".
export const assinaturaPromocoes = (lista) =>
  lista
    .map((s) => s.skinId)
    .sort((a, b) => a - b)
    .join(",") + `@${lista[0]?.termina ?? ""}`;

export function embedPromocoes(lista) {
  const linhas = lista.map(
    (s) => `**${s.nome}** — ~~${s.precoCheio}~~ **${s.preco} RP** · -${s.desconto}%`
  );
  const destaque = lista.find((s) => s.arquivoCampeao);
  return {
    title: "Skins em promoção na loja",
    description: linhas.join("\n").slice(0, 4000),
    color: 0xc8a24a,
    image: destaque ? { url: urlSplashSkin(destaque.arquivoCampeao, destaque.skinId) } : undefined,
    footer: { text: lista[0]?.termina ? `Promoção até ${dataCurta(lista[0].termina)} · dados OP.GG` : "dados OP.GG" },
  };
}

// ---------- skins novas ----------

// As skins de cada campeão estão no JSON dele no Data Dragon, que muda a
// cada patch. Baixar o arquivo com todos os campeões (2,3 MB) estouraria o
// limite de CPU do plano free, então a varredura vai de pouco em pouco:
// alguns campeões por rodada do cron de 2 minutos, só quando o patch muda.
// Ao fim da volta completa, o que não estava no banco é skin nova.
const CAMPEOES_POR_RODADA = 10;

export async function varrerSkinsNovas(env) {
  const versao = await versaoAtual();
  if ((await pegarEstado(env, "skins_versao")) === versao) return { completo: true };

  let estado = null;
  try {
    estado = JSON.parse((await pegarEstado(env, "skins_varredura")) ?? "null");
  } catch {}
  if (estado?.versao !== versao) estado = { versao, cursor: 0, novas: [] };

  const campeoes = (await todosOsCampeoes(env, versao)).sort((a, b) => a.id - b.id);
  const lote = campeoes.slice(estado.cursor, estado.cursor + CAMPEOES_POR_RODADA);

  const { results } = await env.DB.prepare(
    `SELECT skin_id FROM skins_conhecidas WHERE campeao_id IN (${lote.map(() => "?").join(",")})`
  )
    .bind(...lote.map((c) => c.id))
    .all();
  const conhecidas = new Set(results.map((r) => r.skin_id));
  // A primeira volta de todas só aprende o que já existe — sem isso, o
  // primeiro deploy anunciaria as ~1.900 skins do jogo como "novas".
  const aprendendo = !(await pegarEstado(env, "skins_semeado"));

  const linhas = [];
  for (const campeao of lote) {
    const res = await fetch(`${DDRAGON}/cdn/${versao}/data/pt_BR/champion/${campeao.arquivoImagem}.json`);
    if (!res.ok) continue; // tenta de novo no próximo patch
    const skins = (await res.json()).data?.[campeao.arquivoImagem]?.skins ?? [];
    for (const skin of skins) {
      const id = Number(skin.id);
      if (!skin.num || conhecidas.has(id)) continue; // num 0 é a aparência padrão
      linhas.push([id, campeao.id, skin.name]);
      if (!aprendendo) estado.novas.push({ skinId: id, nome: skin.name, campeao: campeao.nome, arquivoCampeao: campeao.arquivoImagem });
    }
  }

  // Várias linhas por INSERT: o plano free limita consultas por execução.
  const consultas = [];
  for (let i = 0; i < linhas.length; i += 25) {
    const grupo = linhas.slice(i, i + 25);
    consultas.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO skins_conhecidas (skin_id, campeao_id, nome) VALUES ${grupo.map(() => "(?, ?, ?)").join(",")}`
      ).bind(...grupo.flat())
    );
  }
  if (consultas.length) await env.DB.batch(consultas);

  estado.cursor += lote.length;
  if (estado.cursor < campeoes.length) {
    await salvarEstado(env, "skins_varredura", JSON.stringify(estado));
    return { cursor: estado.cursor, total: campeoes.length, novas: estado.novas.length };
  }

  // Volta completa: as novas ficam na fila para o cron de 15 minutos postar.
  // Postar aqui mesmo dividiria o limite de sub-requests com a varredura.
  if (estado.novas.length) {
    const fila = JSON.parse((await pegarEstado(env, "skins_para_postar")) ?? "[]");
    await salvarEstado(env, "skins_para_postar", JSON.stringify([...fila, ...estado.novas]));
  }
  await salvarEstado(env, "skins_versao", versao);
  await salvarEstado(env, "skins_varredura", "");
  if (aprendendo) await salvarEstado(env, "skins_semeado", new Date().toISOString());
  return { terminou: true, novas: estado.novas.length, aprendendo };
}

// Uma imagem por skin: até 10 embeds por mensagem, então a lista vira
// quantas mensagens precisar.
export function mensagensSkinsNovas(novas) {
  const mensagens = [];
  for (let i = 0; i < novas.length; i += 10) {
    mensagens.push({
      content: i === 0 ? `**${novas.length === 1 ? "Skin nova no jogo!" : `${novas.length} skins novas no jogo!`}**` : undefined,
      embeds: novas.slice(i, i + 10).map((s) => ({
        title: s.nome,
        description: `Nova skin de **${s.campeao}**`,
        color: 0xc8a24a,
        image: { url: urlSplashSkin(s.arquivoCampeao, s.skinId) },
      })),
    });
  }
  return mensagens;
}

// ---------- vídeos do YouTube ----------

const CANAL_YOUTUBE = "UC2t5bjwHdUX4vM2g8TRDq5g"; // @leagueoflegends
const PAGINA_VIDEOS = "https://www.youtube.com/@leagueoflegends/videos";

// O feed RSS do YouTube (o jeito tradicional de acompanhar um canal) está
// respondendo 404 para todo mundo desde 10/2026. Com uma chave da YouTube
// Data API (gratuita) o bot usa a API oficial; sem ela, lê a própria página
// de vídeos do canal, que é mais frágil — o YouTube muda esse HTML de tempos
// em tempos.
export async function buscarVideos(env) {
  const chave = (env.YOUTUBE_API_KEY ?? "").trim();
  if (chave) {
    // Playlist de uploads do canal: mesmo id, com "UU" no lugar de "UC".
    const playlist = `UU${CANAL_YOUTUBE.slice(2)}`;
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=8&playlistId=${playlist}&key=${encodeURIComponent(chave)}`
    );
    if (!res.ok) throw new Error(`YouTube API -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const dados = await res.json();
    return (dados.items ?? []).map((i) => ({
      id: i.snippet.resourceId.videoId,
      titulo: i.snippet.title,
    }));
  }

  const res = await fetch(PAGINA_VIDEOS, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9",
      // Sem isto, um cron rodando num data center europeu cai na tela de
      // consentimento de cookies em vez da lista de vídeos.
      Cookie: "SOCS=CAI; CONSENT=YES+cb",
    },
  });
  if (!res.ok) throw new Error(`Página de vídeos do YouTube -> ${res.status}`);
  const html = await res.text();

  // Cada vídeo da grade é um "lockupViewModel"; os primeiros são os mais
  // recentes. Recorte por texto em vez de JSON.parse: o HTML tem 1,3 MB.
  const videos = [];
  for (const bloco of html.split('"richItemRenderer":{"content":{"lockupViewModel"').slice(1, 9)) {
    const id = bloco.match(/"videoId":"([\w-]{11})"/)?.[1] ?? bloco.match(/\/vi(?:_lc)?\/([\w-]{11})\//)?.[1];
    const titulo = bloco.match(/"title":\{"content":"((?:[^"\\]|\\.)*)"/)?.[1];
    if (!id || !titulo) continue;
    videos.push({ id, titulo: JSON.parse(`"${titulo}"`) });
  }
  if (!videos.length) throw new Error("Não achei vídeos na página do canal (o YouTube mudou o HTML?)");
  return videos;
}

// Só o link: o próprio Discord mostra a miniatura e o player do vídeo.
export function mensagemVideo(video) {
  return { content: `🎬 **Vídeo novo no canal oficial do LoL:** ${video.titulo}\nhttps://www.youtube.com/watch?v=${video.id}` };
}

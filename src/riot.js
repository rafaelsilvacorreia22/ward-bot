// Dados da Riot: versão do jogo (Data Dragon, CDN pública, sem chave) e
// rotação semanal de campeões grátis (precisa de chave — ver README sobre a
// Personal API Key da Riot expirar sozinha a cada 24h).

import { pegarEstado, salvarEstado, limparCacheCampeoesAntigo } from "./db.js";

const DDRAGON = "https://ddragon.leagueoflegends.com";
const RIOT_API = "https://br1.api.riotgames.com";

// Uma rodada do cron chamava versaoAtual() duas ou três vezes (checarPatch,
// a rotação e, quando há horário diário, a rotação de novo), sempre com a
// mesma resposta. O cache é curto de propósito: o checarPatch depende de ver
// a versão mudar, e um cache longo faria o bot perder o anúncio do patch.
const VALIDADE_VERSAO_MS = 60_000;
let versaoEmCache = null;
let versaoValidaAte = 0;

export async function versaoAtual() {
  if (versaoEmCache && Date.now() < versaoValidaAte) return versaoEmCache;

  const res = await fetch(`${DDRAGON}/api/versions.json`);
  if (!res.ok) throw new Error(`Data Dragon (versions) -> ${res.status}`);
  const versoes = await res.json();

  versaoEmCache = versoes[0];
  versaoValidaAte = Date.now() + VALIDADE_VERSAO_MS;
  return versaoEmCache;
}

// Link genérico de reserva (sempre existe, sempre mostra o patch mais recente
// no topo) — usado só se não der pra montar/confirmar o link do artigo exato.
export const LINK_NOTAS_PATCH = "https://www.leagueoflegends.com/en-us/news/tags/patch-notes/";

const CABECALHO_NAVEGADOR = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

function decodificarEntidadesHtml(texto) {
  return texto
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#8220;|&#8221;/g, '"');
}

// A numeração PÚBLICA do patch (a que aparece na URL do site) não é a mesma
// do Data Dragon: o major interno vem sempre 10 números atrás do que a Riot
// anuncia (ex: Data Dragon "16.19" = site "26.19"). Isso não está documentado
// em lugar nenhum — só foi possível descobrir comparando o Data Dragon com o
// título real de artigos publicados.
function urlNotasPatch(versao) {
  const [majorInterno, minor] = versao.split(".");
  const majorPublico = Number(majorInterno) + 10;
  return `https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-${majorPublico}-${minor}-notes/`;
}

// Busca o resumo oficial do patch em inglês. Usa o <meta name="description">
// da própria página — é o texto que a Riot escreve à mão pra aparecer em
// buscas e compartilhamentos, bem mais estável do que tentar ler o corpo do
// artigo (que muda de layout com frequência). Quem chama decide se traduz.
export async function resumoPatchEmIngles(versao) {
  const url = urlNotasPatch(versao);
  const res = await fetch(url, { headers: CABECALHO_NAVEGADOR });
  if (!res.ok) throw new Error(`Página de notas do patch -> ${res.status}`);

  const html = await res.text();
  const match = html.match(/<meta name="description" content="([^"]+)"/);
  if (!match) throw new Error("Não achei o resumo (description) na página de notas");

  return { url, resumo: decodificarEntidadesHtml(match[1]) };
}

// Usado pelo /admin/emojis pra saber o roster completo (pra subir o ícone de
// cada campeão como emoji do app).
export async function todosOsCampeoes(env, versao) {
  return Object.values(await campeoesPorId(env, versao));
}

export function urlIconeCampeao(versao, arquivoImagem) {
  return `${DDRAGON}/cdn/${versao}/img/champion/${arquivoImagem}.png`;
}

// O champion.json tem ~155 KB e só muda quando muda o patch (a cada duas
// semanas), mas era baixado inteiro a cada rodada do cron — ~15 MB por dia à
// toa. Agora o mapa reduzido (só os três campos que o bot usa, uns 7 KB)
// fica guardado no banco com a versão na chave, e em memória enquanto o
// isolate viver. Falha de cache nunca derruba a busca: cai para a rede.
const mapaEmMemoria = new Map();

async function campeoesPorId(env, versao) {
  const emMemoria = mapaEmMemoria.get(versao);
  if (emMemoria) return emMemoria;

  const chave = `campeoes_${versao}`;
  if (env?.DB) {
    try {
      const guardado = await pegarEstado(env, chave);
      if (guardado) {
        const mapa = JSON.parse(guardado);
        mapaEmMemoria.set(versao, mapa);
        return mapa;
      }
    } catch (err) {
      console.log("Cache de campeões ilegível, buscando de novo:", err.message);
    }
  }

  const res = await fetch(`${DDRAGON}/cdn/${versao}/data/en_US/champion.json`);
  if (!res.ok) throw new Error(`Data Dragon (champion.json) -> ${res.status}`);
  const dados = await res.json();
  const porId = {};
  for (const campeao of Object.values(dados.data)) {
    // "id" aqui é o nome usado no arquivo de imagem (ex: "MonkeyKing" pro
    // Wukong), diferente de "name" (nome de exibição) e "key" (id numérico).
    porId[campeao.key] = { nome: campeao.name, arquivoImagem: campeao.id };
  }
  mapaEmMemoria.set(versao, porId);

  if (env?.DB) {
    try {
      await salvarEstado(env, chave, JSON.stringify(porId));
      // Só a versão atual interessa — sem isso sobraria uma linha por patch.
      await limparCacheCampeoesAntigo(env, chave);
    } catch (err) {
      console.log("Não consegui guardar o cache de campeões:", err.message);
    }
  }

  return porId;
}

// Lança erro se a chave estiver ausente/vencida — quem chama decide o que
// fazer (o cron loga e segue sem postar, o /rotacao avisa "indisponível").
export async function rotacaoAtual(env) {
  const chave = (env.RIOT_API_KEY ?? "").trim();
  if (!chave) throw new Error("RIOT_API_KEY não configurada");

  const res = await fetch(`${RIOT_API}/lol/platform/v3/champion-rotations`, {
    headers: { "X-Riot-Token": chave },
  });
  const bruto = await res.text();
  if (!res.ok) {
    throw new Error(`Riot API (rotação) -> ${res.status}: ${bruto.slice(0, 300)}`);
  }

  let dados;
  try {
    dados = JSON.parse(bruto);
  } catch {
    throw new Error(`Riot API (rotação) devolveu algo que não é JSON: ${bruto.slice(0, 300)}`);
  }
  // A resposta mudou de formato em algum momento sem aviso: o campo com a
  // rotação do Summoner's Rift se chama "sr" agora (documentação antiga da
  // Riot ainda fala em "freeChampionIds").
  const ids = dados.sr ?? dados.freeChampionIds;
  if (!Array.isArray(ids)) {
    throw new Error(`Riot API (rotação) em formato inesperado: ${bruto.slice(0, 300)}`);
  }

  const versao = await versaoAtual();
  const porId = await campeoesPorId(env, versao);
  return ids.map((id) => {
    const campeao = porId[id];
    return { nome: campeao?.nome ?? `#${id}`, arquivoImagem: campeao?.arquivoImagem ?? null };
  });
}

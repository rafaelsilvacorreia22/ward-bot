// Notícias oficiais do LoL, direto do site da Riot em português — inclui
// Esports (CBLOL), skins, atualizações do jogo e comunicados. Como já vem em
// pt-BR, não passa por tradução.
//
// O site é um app Next.js e os dados vêm do JSON que ele mesmo usa para
// montar a listagem. O "buildId" dessa URL muda a cada publicação do site,
// então é lido da página antes de cada busca, em vez de ficar fixo no código.

import { pegarEstado, salvarEstado } from "./db.js";

const SITE = "https://www.leagueoflegends.com";
const CABECALHO_NAVEGADOR = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

// As notas de atualização já têm aviso próprio (ver checarPatch), então ficam
// de fora daqui pra não anunciar a mesma coisa duas vezes.
const CATEGORIAS_IGNORADAS = /notas d[ea] atualiza/i;

const DIAS_CONSIDERADOS = 30;

async function buildIdAtual() {
  const res = await fetch(`${SITE}/pt-br/news/`, { headers: CABECALHO_NAVEGADOR });
  if (!res.ok) throw new Error(`Página de notícias -> ${res.status}`);
  const html = await res.text();
  const achado = html.match(/\/_next\/static\/([^/]+)\/_buildManifest\.js/);
  if (!achado) throw new Error("Não encontrei o identificador de build do site");
  return achado[1];
}

function limparHtml(texto) {
  return String(texto ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .trim();
}

// Busca a lista usando um buildId já conhecido. Devolve null quando esse id
// venceu (o site responde erro nessa URL) — assim quem chamou sabe que é só
// redescobrir, e não uma falha de verdade.
async function listaComBuildId(buildId) {
  const res = await fetch(`${SITE}/_next/data/${buildId}/pt-br/news.json`, {
    headers: CABECALHO_NAVEGADOR,
  });
  if (!res.ok) return null;
  return extrairNoticias(await res.json());
}

// Retorna as notícias recentes, da mais antiga para a mais nova (é nessa
// ordem que elas devem ser postadas, pra o canal ficar cronológico).
//
// A página de notícias tem ~494 KB e era baixada inteira a cada rodada do
// cron só para ler o buildId dela — quase 50 MB por dia só nisso. Agora o
// buildId fica guardado e a página só é buscada de novo quando ele vence,
// o que acontece quando a Riot publica.
export async function buscarNoticias(env) {
  const guardado = env ? await pegarEstado(env, "news_build_id").catch(() => null) : null;
  if (guardado) {
    const lista = await listaComBuildId(guardado);
    if (lista) return lista;
  }

  const buildId = await buildIdAtual();
  const lista = await listaComBuildId(buildId);
  if (!lista) throw new Error("Lista de notícias -> não respondeu nem com buildId recém-descoberto");
  if (env && buildId !== guardado) {
    await salvarEstado(env, "news_build_id", buildId).catch(() => {});
  }
  return lista;
}

function extrairNoticias(dados) {
  const blocos = dados?.pageProps?.page?.blades ?? [];
  // Procura o bloco da listagem em vez de usar índice fixo: a ordem dos
  // blocos da página muda conforme a Riot mexe no layout.
  const bloco = blocos.find(
    (b) => Array.isArray(b?.items) && b.items.some((i) => i?.title && i?.publishedAt)
  );
  if (!bloco) throw new Error("Não achei a lista de artigos no JSON do site");

  const limite = Date.now() - DIAS_CONSIDERADOS * 86400000;

  return bloco.items
    .filter((item) => {
      const url = item?.action?.payload?.url;
      if (!url || !item.publishedAt) return false;
      if (new Date(item.publishedAt).getTime() < limite) return false;
      return !CATEGORIAS_IGNORADAS.test(item.category?.title ?? "");
    })
    .map((item) => ({
      // As notícias do próprio site vêm com caminho relativo
      // ("/pt-br/news/..."); só as do lolesports e do YouTube vêm completas.
      // O Discord recusa embed cuja `url` não seja absoluta (400), então
      // resolver aqui é obrigatório — e é o único lugar que monta esse campo.
      url: new URL(item.action.payload.url, SITE).href,
      titulo: limparHtml(item.title),
      resumo: limparHtml(item.description?.body).slice(0, 300),
      categoria: item.category?.title ?? "Notícias",
      data: item.publishedAt,
      imagem: item.media?.url ?? null,
    }))
    .sort((a, b) => new Date(a.data) - new Date(b.data));
}

export function embedDaNoticia(noticia) {
  return {
    title: noticia.titulo.slice(0, 256),
    url: noticia.url,
    description: noticia.resumo || undefined,
    color: 0x0ac8b9,
    image: noticia.imagem ? { url: noticia.imagem } : undefined,
    footer: { text: noticia.categoria },
    timestamp: noticia.data,
  };
}

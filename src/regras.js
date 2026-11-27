// Regras pequenas e sem efeito colateral (não chamam rede nem banco), em
// arquivo próprio para poderem ser testadas sozinhas — ver test/.

import { FLAG_V2 } from "./visual.js";
import { SITE } from "./discord.js";

// Põe a menção do cargo no começo da mensagem e libera só aquele cargo para
// ser marcado (todo o resto continua sem marcar ninguém — ver semMencoes).
// No layout novo a menção vai num texto antes do bloco colorido.
export function comCargo(corpo, cargoId) {
  if (!cargoId || !/^\d{5,25}$/.test(cargoId)) return corpo;
  const mencoes = { parse: [], roles: [cargoId] };
  if (corpo.flags & FLAG_V2) {
    return { ...corpo, components: [{ type: 10, content: `<@&${cargoId}>` }, ...corpo.components], allowed_mentions: mencoes };
  }
  return { ...corpo, content: `<@&${cargoId}>${corpo.content ? ` ${corpo.content}` : ""}`, allowed_mentions: mencoes };
}

const NAVEGADOR_ROBO =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|embed|monitor|curl|wget|python|headless|lighthouse|httpclient|java\/|go-http|axios|node-fetch|powershell|scrapy|phantom|selenium|puppeteer|playwright/i;
const REDE_DE_DATA_CENTER =
  /amazon|aws|google cloud|google llc|microsoft|azure|digitalocean|ovh|hetzner|linode|akamai|oracle|alibaba|tencent|contabo|vultr|choopa|scaleway|leaseweb|m247|datacamp|cloudflare|hostinger|hostgator|locaweb|kinghost|fastly|zenlayer|psychz|colocrossing|servers\.com|hosting|data ?cent(er|re)/i;

export function ehRobo(request) {
  const navegador = request.headers.get("User-Agent") ?? "";
  if (!navegador || NAVEGADOR_ROBO.test(navegador)) return true;
  return REDE_DE_DATA_CENTER.test(request.cf?.asOrganization ?? "");
}

// Só páginas que existem entram na conta (o aviso vem do navegador, então
// qualquer um poderia mandar um caminho inventado). /build/Fizz fica como
// está para dar para ver quais campeões são vistos.
export function caminhoParaContar(caminho) {
  if (typeof caminho !== "string") return null;
  if (/^\/dashboard\/\d+/.test(caminho)) return "/dashboard/servidor";
  if (/^\/build\/[A-Za-z]{2,20}$/.test(caminho)) return caminho;
  return ["/", "/build", "/promocoes", "/dashboard", "/privacidade", "/termos"].includes(caminho) ? caminho : null;
}

// Por onde a pessoa chegou. Primeiro vale a etiqueta do link
// (wardbot.com.br/?ref=tiktok) — é o único jeito de saber de onde vem quem
// clica dentro do app do Discord, que não diz de onde a pessoa veio. Sem
// etiqueta, usa o site anterior (Referer), agrupado do jeito que interessa.
export function origemDaVisita(busca, referer) {
  const etiqueta = /[?&](?:ref|utm_source)=([a-z0-9._-]{1,30})/i.exec(busca ?? "");
  if (etiqueta) return etiqueta[1].toLowerCase();
  if (!referer) return "direto";
  try {
    const dominio = new URL(referer).hostname.replace(/^(www|m|l|lm)\./, "");
    if (dominio === new URL(SITE).hostname || dominio.endsWith("workers.dev")) return "direto";
    if (/(^|\.)google\./.test(dominio)) return "google";
    if (/(^|\.)bing\.com$/.test(dominio)) return "bing";
    if (/duckduckgo\.com$/.test(dominio)) return "duckduckgo";
    if (/discord(app)?\.com$/.test(dominio)) return "discord";
    if (/(^|\.)t\.co$|(^|\.)x\.com$|twitter\.com$/.test(dominio)) return "x (twitter)";
    if (/youtube\.com$|youtu\.be$/.test(dominio)) return "youtube";
    if (/facebook\.com$/.test(dominio)) return "facebook";
    if (/instagram\.com$/.test(dominio)) return "instagram";
    if (/tiktok\.com$/.test(dominio)) return "tiktok";
    if (/reddit\.com$/.test(dominio)) return "reddit";
    return dominio.slice(0, 40);
  } catch {
    return "direto";
  }
}

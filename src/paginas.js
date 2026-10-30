// Templates HTML simples, sem framework e sem build — só strings com um
// escape básico pra evitar XSS a partir de nomes de servidor/canal.

import { FRAGMENTOS } from "./builds.js";
import { faltaConfigurar } from "./db.js";
import { SITE } from "./discord.js";

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function convite(clientId) {
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot+applications.commands&permissions=19456`;
}

// Arte decorativa da página inicial. Qualquer versão serve: o Data Dragon
// mantém as antigas para sempre, então isto não precisa acompanhar o patch.
const VERSAO_ARTE = "16.19.1";
// Build de exemplo da prévia do /build na inicial, usada só enquanto a build
// ainda não juntou amostra para a build do dia de verdade.
const BUILD_EXEMPLO = {
  campeao: { nome: "Ahri", img: "Ahri" },
  rota: "MIDDLE",
  itens: [6655, 4645, 3157, 3020],
};

const DDRAGON = "https://ddragon.leagueoflegends.com";
const NOMES_ROTA = { TOP: "Topo", JUNGLE: "Selva", MIDDLE: "Meio", BOTTOM: "Atirador", UTILITY: "Suporte" };
const porcentagem = (taxa) => `${(taxa * 100).toFixed(1).replace(".", ",")}%`;

// Brasas do fundo. Os valores são fixos e variados à mão em vez de
// aleatórios: assim o resultado é o mesmo em toda visita e dá para ajustar
// uma que ficou feia. O atraso é NEGATIVO de propósito — cada brasa já
// começa no meio do percurso, senão a página abre vazia e só depois "liga".
const BRASAS = [
  [4, 42, -5], [11, 31, -22], [18, 55, -11, "verde"], [26, 37, -38],
  [33, 48, -17], [41, 29, -2], [48, 61, -29, "verde"], [56, 35, -44],
  [63, 44, -9], [71, 52, -33], [78, 33, -26, "verde"], [85, 58, -14],
  [92, 39, -48], [96, 46, -19],
]
  .map(([x, dur, atraso, cor]) =>
    `<span class="${cor ?? ""}" style="left:${x}%;--dur:${dur}s;--atraso:${atraso}s"></span>`
  )
  .join("");

// Logo do Discord (o "Clyde"), usado no título da inicial no lugar da
// palavra e como partícula no fundo do topo. O role/aria-label mantém
// "Discord" para leitor de tela e busca.
const CAMINHO_DISCORD =
  "M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z";
const LOGO_DISCORD = `<svg class="logo-discord" viewBox="0 0 127.14 96.36" role="img" aria-label="Discord"><defs><linearGradient id="grad-logo-discord" x1="0" y1="0" x2="0" y2="1"><stop class="topo" offset="0"/><stop class="base" offset="1"/></linearGradient></defs><path fill="url(#grad-logo-discord)" d="${CAMINHO_DISCORD}"/></svg>`;

const ICONE_LUA =`<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const ICONE_SOL = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>`;

// Duas famílias, uma de cada lado da mistura:
//
// - Spiegel é a fonte de texto do próprio League of Legends. É o fio que
//   ainda liga o site ao jogo.
// - Big Shoulders é condensada e geométrica, com cara de letreiro art déco —
//   o lado Deadlock. Entrou no lugar da Beaufort, que era o elemento mais
//   "LoL puro" do design e puxava tudo de volta pro Hextech.
//
// As duas ficam HOSPEDADAS AQUI, em public/fontes (262 KB). Antes vinham da
// CDN da Riot e do Google Fonts: dois domínios de terceiro que o navegador
// tinha de alcançar antes de desenhar o texto, e dois pontos de falha fora
// do nosso controle — se a Riot mudasse a URL, o site caía no Georgia.
//
// Licenças: Big Shoulders Display é OFL (ver public/fontes/LICENCA.txt).
// Spiegel é da Riot, usada dentro da mesma política de conteúdo de fã que já
// cobre os ícones de campeão vindos do Data Dragon.
const FONTES = `
  @font-face { font-family: "Spiegel"; src: url("/fontes/Spiegel-Regular.woff") format("woff"); font-weight: 400; font-display: swap; }
  @font-face { font-family: "Spiegel"; src: url("/fontes/Spiegel-SemiBold.woff") format("woff"); font-weight: 600; font-display: swap; }
  /* A Big Shoulders é VARIÁVEL: um arquivo só carrega o eixo de peso
     inteiro, e por isso é declarada com a faixa 100-900 em vez de três
     regras de peso fixo. Declarar pesos fixos apontando para o mesmo
     arquivo variável faria o navegador desenhar 500, 700 e 800 idênticos —
     além de baixar a mesma fonte três vezes. */
  @font-face { font-family: "Big Shoulders Display"; src: url("/fontes/BigShoulders.woff2") format("woff2"); font-weight: 100 900; font-display: swap; }
`;

const ESTILO = `
  /* Mistura de League of Legends com Deadlock.
     Do LoL ficam o latão como único metal, as linhas retas e a fonte de
     texto. Do Deadlock vêm o quase-preto neutro (em vez do azul Hextech), o
     verde-dinheiro de contraste, o grão de filme e, principalmente, a
     geometria art déco: canto em degrau de zigurate, filete duplo e
     estriado vertical no lugar do chanfro simples. */
  :root {
    color-scheme: dark;
    --fundo: #0b0d0e;
    --superficie: #14181a;
    --superficie-2: #1b2023;
    --linha: #35373a;
    --texto: #e9e2d4;
    --texto-fraco: #948b7d;
    --latao: #c8a24a;
    --latao-claro: #f2dfab;
    --latao-escuro: #6d5323;
    --verde: #2fbba0;
    --verde-escuro: #11463f;
    --btn-texto: #0b0d0e;
    --grad-titulo: linear-gradient(176deg, #f6e8bf 0%, #c8a24a 55%, #8a6a26 100%);
    --alerta: #c6443e;
    --alerta-texto: #f3ece0;
    --veu-topo: rgba(11, 13, 14, .92);

    /* Canto em degrau: a escadinha de zigurate que o art déco usa em
       moldura, porta e letreiro. É o que substitui o chanfro simples do
       Hextech e carrega sozinho metade do tema. */
    --degrau: polygon(
      0 15px, 8px 15px, 8px 8px, 15px 8px, 15px 0,
      calc(100% - 15px) 0, calc(100% - 15px) 8px, calc(100% - 8px) 8px, calc(100% - 8px) 15px, 100% 15px,
      100% calc(100% - 15px), calc(100% - 8px) calc(100% - 15px), calc(100% - 8px) calc(100% - 8px), calc(100% - 15px) calc(100% - 8px), calc(100% - 15px) 100%,
      15px 100%, 15px calc(100% - 8px), 8px calc(100% - 8px), 8px calc(100% - 15px), 0 calc(100% - 15px)
    );
    /* Octógono achatado, para botão e etiqueta. */
    --degrau-p: polygon(
      0 9px, 9px 0, calc(100% - 9px) 0, 100% 9px,
      100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px)
    );
  }

  /* Tema claro: papel envelhecido de arquivo, não branco de painel. */
  :root[data-tema="claro"] {
    color-scheme: light;
    --fundo: #e3dbc9;
    --superficie: #f3ecda;
    --superficie-2: #e9e0cb;
    --linha: #bcae8e;
    --texto: #1b1d1c;
    --texto-fraco: #5f5a4e;
    --latao: #7a5c22;
    --latao-claro: #4a3613;
    --latao-escuro: #a98c4a;
    --verde: #11705f;
    --verde-escuro: #bfd9ce;
    --btn-texto: #f3ecda;
    --grad-titulo: linear-gradient(176deg, #7a5c22 0%, #4a3613 100%);
    --alerta: #a3302a;
    --alerta-texto: #f3ecda;
    --veu-topo: rgba(227, 219, 201, .94);
  }
  @media (prefers-color-scheme: light) {
    :root:not([data-tema="escuro"]) {
      color-scheme: light;
      --fundo: #e3dbc9;
      --superficie: #f3ecda;
      --superficie-2: #e9e0cb;
      --linha: #bcae8e;
      --texto: #1b1d1c;
      --texto-fraco: #5f5a4e;
      --latao: #7a5c22;
      --latao-claro: #4a3613;
      --latao-escuro: #a98c4a;
      --verde: #11705f;
      --verde-escuro: #bfd9ce;
      --btn-texto: #f3ecda;
      --grad-titulo: linear-gradient(176deg, #7a5c22 0%, #4a3613 100%);
      --alerta: #a3302a;
      --alerta-texto: #f3ecda;
      --veu-topo: rgba(227, 219, 201, .94);
    }
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Spiegel", system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 15.5px;
    background: var(--fundo);
    min-height: 100vh;
    color: var(--texto);
    line-height: 1.6;
    overflow-x: hidden;
  }

  /* Fundo vivo do site inteiro: duas manchas de luz enormes, uma de latão e
     uma verde, que derivam devagar em sentidos opostos. Fica atrás de todo o
     conteúdo e acompanha a página inteira, não só a inicial.

     Anima só "transform", nunca "background-position": transform é composto
     pela GPU e não força repintura. Foi a lição do vídeo de fundo, que
     derrubava o framerate porque tinha filtro de CSS recalculado por quadro. */
  body::before {
    content: ""; position: fixed; inset: -30%; z-index: -2; pointer-events: none;
    background:
      radial-gradient(34% 34% at 26% 20%, color-mix(in srgb, var(--latao) 15%, transparent) 0%, transparent 70%),
      radial-gradient(40% 40% at 78% 74%, color-mix(in srgb, var(--verde) 11%, transparent) 0%, transparent 72%),
      radial-gradient(30% 30% at 62% 18%, color-mix(in srgb, var(--latao) 8%, transparent) 0%, transparent 70%);
    animation: derivar 54s ease-in-out infinite alternate;
    will-change: transform;
  }
  @keyframes derivar {
    from { transform: translate3d(-2.5%, -1.5%, 0) scale(1); }
    to   { transform: translate3d(3%, 2.5%, 0) scale(1.1); }
  }

  /* Brasas subindo, como a poeira em suspensão do Deadlock. São losangos
     (rima com o ornamento), não círculos. Cada uma leva atraso negativo para
     já começar no meio do percurso — senão a página abre vazia e só depois
     "liga". */
  .brasas { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
  .brasas span {
    position: absolute; bottom: -24px; width: 5px; height: 5px; rotate: 45deg;
    background: var(--latao); opacity: 0;
    animation: subir var(--dur, 38s) linear var(--atraso, 0s) infinite;
  }
  .brasas span.verde { background: var(--verde); width: 4px; height: 4px; }
  @keyframes subir {
    0%   { transform: translateY(0) scale(.5); opacity: 0; }
    10%  { opacity: .55; }
    75%  { opacity: .3; }
    100% { transform: translateY(-108vh) scale(1); opacity: 0; }
  }

  /* Barra de progresso do scroll: o fio de latão que vira verde conforme a
     página anda. É o "cheguei no fim" que o resto da animação não dá. */
  .progresso {
    position: fixed; top: 60px; left: 0; z-index: 49;
    height: 2px; width: 100%; transform-origin: 0 50%;
    transform: scaleX(var(--p, 0));
    background: linear-gradient(90deg, var(--latao-escuro), var(--latao) 55%, var(--verde));
    pointer-events: none;
  }

  /* Grão de filme por cima de tudo. É o que tira o aspecto "vetor limpo" e
     dá a textura suja de cartaz antigo que o Deadlock tem. Fica por fora do
     fluxo e não intercepta clique. */
  body::after {
    content: ""; position: fixed; inset: 0; z-index: 9; pointer-events: none;
    opacity: .055; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23g)'/%3E%3C/svg%3E");
  }

  h1, h2, h3, .fonte-deco {
    font-family: "Big Shoulders Display", "Haettenschweiler", "Arial Narrow", sans-serif;
    font-weight: 800; text-transform: uppercase; letter-spacing: .01em;
    line-height: .98;
  }
  h1 { font-size: clamp(2rem, 5.5vw, 3.1rem); margin: 0 0 16px; }
  h2 { font-size: clamp(1.4rem, 3vw, 1.9rem); margin: 0 0 12px; color: var(--texto); }
  h3 { font-size: 1.3rem; margin: 0 0 8px; color: var(--latao-claro); }
  p { margin: 0 0 12px; }
  a { color: var(--latao); text-decoration-color: var(--latao-escuro); text-underline-offset: 3px; }
  a:hover { color: var(--latao-claro); }
  code {
    font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
    background: var(--superficie-2); border: 1px solid var(--linha);
    padding: 1px 6px; font-size: .86em; color: var(--latao);
  }

  /* Filete duplo: linha grossa + linha fina logo abaixo. Separador clássico
     de art déco e a assinatura mais barata do tema. */
  .filete-duplo {
    height: 4px; border: 0; margin: 0;
    background:
      linear-gradient(var(--latao), var(--latao)) top/100% 2px no-repeat,
      linear-gradient(var(--latao-escuro), var(--latao-escuro)) bottom/100% 1px no-repeat;
  }

  /* ---------- barra de topo ---------- */
  .topo {
    position: fixed; inset: 0 0 auto; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; height: 60px; padding: 0 clamp(14px, 4vw, 34px);
    background: var(--veu-topo);
    border-bottom: 2px solid var(--latao-escuro);
    box-shadow: 0 1px 0 var(--latao-escuro) inset, 0 3px 0 -1px color-mix(in srgb, var(--latao) 22%, transparent);
  }
  .marca {
    display: flex; align-items: center; gap: 11px;
    color: var(--texto); text-decoration: none;
    font-family: "Big Shoulders Display", sans-serif;
    font-weight: 800; font-size: 1.3rem;
    text-transform: uppercase; letter-spacing: .22em;
  }
  .marca img { width: 32px; height: 32px; }
  .topo-dir { display: flex; align-items: center; gap: 10px; }
  .topo-link {
    font-family: "Big Shoulders Display", sans-serif; font-weight: 700;
    font-size: .95rem; text-transform: uppercase; letter-spacing: .16em;
    color: var(--texto-fraco); text-decoration: none; padding: 8px 10px;
  }
  .topo-link:hover { color: var(--latao); }
  .tema {
    display: grid; place-items: center; width: 34px; height: 34px;
    border: 1px solid var(--latao-escuro);
    background: transparent; color: var(--texto-fraco); cursor: pointer;
    clip-path: var(--degrau-p); transition: color .15s, border-color .15s;
  }
  .tema:hover { color: var(--latao); border-color: var(--latao); }
  .tema .sol { display: none; }
  :root[data-tema="claro"] .tema .sol { display: block; }
  :root[data-tema="claro"] .tema .lua { display: none; }
  @media (prefers-color-scheme: light) {
    :root:not([data-tema="escuro"]) .tema .sol { display: block; }
    :root:not([data-tema="escuro"]) .tema .lua { display: none; }
  }

  /* ---------- botões ---------- */
  .botao {
    position: relative; isolation: isolate;
    display: inline-flex; align-items: center; justify-content: center;
    padding: 14px 32px; margin: 5px 6px 5px 0;
    border: 0; cursor: pointer; text-decoration: none;
    clip-path: var(--degrau-p);
    background: linear-gradient(176deg, var(--latao-claro) 0%, var(--latao) 42%, var(--latao-escuro) 100%);
    color: var(--btn-texto);
    font-family: "Big Shoulders Display", sans-serif;
    font-size: 1.05rem; font-weight: 800;
    text-transform: uppercase; letter-spacing: .16em;
    transition: filter .15s ease, transform .15s ease;
  }
  .botao:hover { filter: brightness(1.12); color: var(--btn-texto); }
  .botao:active { transform: translateY(1px); }
  .botao:focus-visible { outline: 2px solid var(--latao-claro); outline-offset: 3px; }
  .botao.vazado { background: var(--latao-escuro); color: var(--latao); }
  .botao.vazado::before {
    content: ""; position: absolute; inset: 1px; z-index: -1;
    background: var(--superficie); clip-path: var(--degrau-p);
    transition: background .15s ease;
  }
  .botao.vazado:hover { filter: none; color: var(--latao-claro); background: var(--latao); }
  .botao.vazado:hover::before { background: color-mix(in srgb, var(--latao) 10%, var(--superficie)); }
  /* Variante verde: só para a ação principal, o que dá ao verde o papel de
     "isto aqui é o que importa" em vez de mais um enfeite. */
  .botao.destaque { background: linear-gradient(176deg, #6fe3c9 0%, var(--verde) 45%, #11705f 100%); }
  .botao.discreto { padding: 10px 20px; font-size: .9rem; }

  /* ---------- molduras ---------- */
  .cartao {
    position: relative; isolation: isolate;
    background: var(--latao-escuro); clip-path: var(--degrau);
    padding: 26px; transition: background .18s ease;
  }
  .cartao::before {
    content: ""; position: absolute; inset: 1px; z-index: -1;
    background: var(--superficie-2); clip-path: var(--degrau);
  }
  .cartao:hover { background: var(--latao); }
  .cartao > :first-child { margin-top: 0; }
  .cartao > :last-child { margin-bottom: 0; }

  /* ---------- hero sem vídeo ---------- */
  /* O fundo agora é desenhado: brilho de latão no alto, verde embaixo, um
     arco déco ao centro e estriado vertical nas laterais. Pesa alguns bytes
     de CSS em vez dos 2,4 MB do vídeo. */
  /* Ocupa a tela inteira (menos nada: a barra do topo é fixa e fica por
     cima). svh e não vh: no celular, vh conta a área atrás da barra de
     endereço e o hero ficaria maior que a tela visível. O resto da página só
     aparece ao rolar, com a revelação de cada seção. */
  .heroi {
    position: relative; overflow: hidden;
    min-height: 100vh; min-height: 100svh;
    display: flex; flex-direction: column; justify-content: center;
    padding: 90px clamp(18px, 5vw, 40px) 70px;
    text-align: center;
    background:
      radial-gradient(92% 62% at 50% -12%, color-mix(in srgb, var(--latao) 20%, transparent) 0%, transparent 62%),
      radial-gradient(70% 48% at 50% 112%, color-mix(in srgb, var(--verde) 14%, transparent) 0%, transparent 70%),
      var(--fundo);
  }
  /* Anéis concêntricos girando atrás do título, em velocidades e sentidos
     diferentes. O terceiro tem só um lado aceso, então vira um arco de luz
     varrendo o círculo — é o que dá vida sem roubar atenção do texto. */
  .heroi-aneis {
    position: absolute; left: 50%; top: 46%; translate: -50% -50%;
    width: min(740px, 112vw); aspect-ratio: 1; pointer-events: none;
  }
  .heroi-aneis i { position: absolute; inset: 0; border-radius: 50%; display: block; }
  .heroi-aneis i:nth-child(1) {
    border: 1px solid color-mix(in srgb, var(--latao) 20%, transparent);
    animation: girar 150s linear infinite;
  }
  .heroi-aneis i:nth-child(2) {
    inset: 9%; border: 1px dashed color-mix(in srgb, var(--latao) 26%, transparent);
    animation: girar 96s linear infinite reverse;
  }
  .heroi-aneis i:nth-child(3) {
    inset: 20%; border: 2px solid color-mix(in srgb, var(--verde) 9%, transparent);
    border-top-color: color-mix(in srgb, var(--verde) 46%, transparent);
    animation: girar 38s linear infinite;
  }
  .heroi-aneis i:nth-child(4) {
    inset: 31%; border: 1px solid color-mix(in srgb, var(--latao) 14%, transparent);
    border-left-color: color-mix(in srgb, var(--latao-claro) 50%, transparent);
    animation: girar 64s linear infinite reverse;
  }
  @keyframes girar { to { rotate: 360deg; } }

  /* Estriado vertical nas bordas, como as colunas caneladas do déco. */
  .heroi::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background:
      repeating-linear-gradient(90deg, color-mix(in srgb, var(--latao) 16%, transparent) 0 1px, transparent 1px 11px) left/88px 100% no-repeat,
      repeating-linear-gradient(90deg, color-mix(in srgb, var(--latao) 16%, transparent) 0 1px, transparent 1px 11px) right/88px 100% no-repeat;
    -webkit-mask-image: linear-gradient(180deg, transparent, #000 35%, #000 65%, transparent);
            mask-image: linear-gradient(180deg, transparent, #000 35%, #000 65%, transparent);
  }
  .heroi-dentro { position: relative; z-index: 1; max-width: 760px; margin: 0 auto; }
  .sobrancelha {
    display: inline-block;
    font-family: "Big Shoulders Display", sans-serif; font-weight: 700;
    font-size: .95rem; text-transform: uppercase; letter-spacing: .3em;
    color: var(--latao); margin: 0 0 16px;
    padding: 5px 16px; border-block: 1px solid color-mix(in srgb, var(--latao) 40%, transparent);
  }
  .heroi h1 {
    font-size: clamp(2.4rem, 7vw, 4.6rem); font-weight: 800;
    margin: 0 0 18px;
    background: var(--grad-titulo);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .heroi .ornamento { margin-bottom: 22px; }
  /* O logo do Discord no lugar da palavra, no mesmo latão do título. A
     altura acompanha a das letras (em), então escala junto com o h1. */
  .logo-discord {
    display: inline-block; height: .78em; width: auto;
    vertical-align: -.04em; margin-left: .06em;
  }
  .logo-discord .topo { stop-color: var(--latao-claro); }
  .logo-discord .base { stop-color: var(--latao); }
  .selos {
    list-style: none; padding: 0; margin: 0 auto 30px;
    display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;
  }
  .selos li {
    display: inline-flex; align-items: center; gap: 9px; margin: 0;
    padding: 9px 16px; border: 1px solid var(--latao-escuro);
    background: color-mix(in srgb, var(--superficie) 70%, transparent);
    font-family: "Big Shoulders Display", sans-serif; font-weight: 700;
    font-size: .95rem; text-transform: uppercase; letter-spacing: .12em; color: var(--texto);
    clip-path: var(--degrau-p);
  }
  .selos code { background: none; border: 0; padding: 0; font-size: .95em; text-transform: none; letter-spacing: 0; }
  /* Pontinho "ligado", como o status online do Discord. */
  .selos .ponto {
    width: 8px; height: 8px; border-radius: 50%; flex: none;
    background: #23a55a; box-shadow: 0 0 8px #23a55a;
  }
  .rolar {
    position: absolute; left: 50%; bottom: 22px; z-index: 1; translate: -50% 0;
    display: grid; place-items: center; width: 42px; height: 42px;
    color: var(--latao); border: 1px solid var(--latao-escuro); clip-path: var(--degrau-p);
    animation: quicar 2.2s ease-in-out infinite;
  }
  .rolar:hover { color: var(--latao-claro); border-color: var(--latao); }
  @keyframes quicar { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(7px); } }
  .acoes { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }

  /* Losango entre dois filetes, versão enxuta do separador déco. */
  .ornamento { display: flex; align-items: center; justify-content: center; gap: 13px; margin: 0 0 22px; }
  .ornamento::before, .ornamento::after {
    content: ""; height: 1px; width: clamp(40px, 12vw, 110px);
    background: linear-gradient(90deg, transparent, var(--latao));
  }
  .ornamento::after { background: linear-gradient(90deg, var(--latao), transparent); }
  .ornamento i { width: 7px; height: 7px; rotate: 45deg; background: var(--latao); }

  /* ---------- as funções, em destaque ---------- */
  .faixa { padding: clamp(48px, 7vw, 76px) clamp(18px, 5vw, 40px); }
  .faixa.escura { background: var(--superficie); border-block: 1px solid var(--latao-escuro); }
  .limite { max-width: 1120px; margin: 0 auto; }
  .titulo-secao { text-align: center; margin-bottom: 36px; }
  .titulo-secao h2 { margin-bottom: 14px; }
  .titulo-secao .ornamento { margin-bottom: 0; }

  .funcoes { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); }
  /* Cada função é um painel alto com a amostra ao vivo embaixo: o que o bot
     faz deixa de ser texto e vira demonstração. */
  .funcao {
    position: relative; isolation: isolate; display: flex; flex-direction: column;
    background: var(--latao-escuro); clip-path: var(--degrau);
    padding: 1px; transition: background .2s ease, transform .2s ease;
  }
  .funcao::before {
    content: ""; position: absolute; inset: 1px; z-index: -1;
    background: linear-gradient(180deg, var(--superficie-2) 0%, var(--superficie) 100%);
    clip-path: var(--degrau);
  }
  .funcao:hover { background: var(--latao); transform: translateY(-3px); }
  .funcao-corpo { padding: 28px 26px 20px; flex: 1; }
  .funcao-num {
    display: block; font-family: "Big Shoulders Display", sans-serif;
    font-weight: 800; font-size: 2.6rem; line-height: 1;
    color: transparent; -webkit-text-stroke: 1px var(--latao-escuro);
    margin-bottom: 10px;
  }
  .funcao h3 { color: var(--texto); margin-bottom: 10px; font-size: 1.5rem; }
  .funcao p { color: var(--texto-fraco); font-size: .95rem; margin: 0; }
  /* Rodapé da função: a amostra do dado real, separada por filete duplo. */
  .funcao-ao-vivo {
    margin: 18px 26px 24px; padding-top: 16px;
    border-top: 2px solid var(--latao-escuro);
    box-shadow: 0 -4px 0 -3px var(--latao-escuro);
  }
  .rotulo-vivo {
    display: flex; align-items: center; gap: 7px;
    font-family: "Big Shoulders Display", sans-serif; font-weight: 700;
    font-size: .8rem; text-transform: uppercase; letter-spacing: .18em;
    color: var(--verde); margin: 0 0 8px;
  }
  .rotulo-vivo::before {
    content: ""; width: 6px; height: 6px; rotate: 45deg;
    background: var(--verde); box-shadow: 0 0 7px var(--verde);
  }
  .valor-vivo {
    font-family: "Big Shoulders Display", sans-serif; font-weight: 700;
    font-size: 1.55rem; color: var(--latao-claro); margin: 0; line-height: 1.1;
  }
  .valor-vivo small { display: block; font-family: "Spiegel", sans-serif; font-weight: 400; font-size: .8rem; letter-spacing: 0; text-transform: none; color: var(--texto-fraco); margin-top: 5px; }
  .campeoes-vivo { display: flex; flex-wrap: wrap; gap: 4px; }
  .campeoes-vivo img { width: 34px; height: 34px; border: 1px solid var(--latao-escuro); background: var(--fundo); }
  .campeoes-vivo img.quadro-skin { width: 48px; height: 48px; object-fit: cover; }
  .video-vivo { display: flex; flex-direction: column; gap: 7px; text-decoration: none; color: var(--texto); font-size: .86rem; line-height: 1.35; }
  .video-vivo img { width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; border: 1px solid var(--latao-escuro); }
  .video-vivo:hover img { border-color: var(--latao); }

  /* ---------- prévia da mensagem no Discord ---------- */
  .previa { max-width: 620px; margin: 0 auto; border: 1px solid var(--linha); background: #313338; text-align: left; }
  .previa-barra {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 16px; border-bottom: 1px solid #26282c;
    color: #b5bac1; font-size: .85rem; font-weight: 600;
  }
  .previa-msg { display: flex; gap: 14px; padding: 16px; }
  .previa-avatar { width: 38px; height: 38px; border-radius: 50%; flex: none; background: #1e1f22; }
  .previa-nome { color: #f2f3f5; font-weight: 600; font-size: .92rem; margin: 0 0 6px; }
  .previa-tag { background: #5865f2; color: #fff; font-size: .62rem; font-weight: 700; padding: 1px 5px; border-radius: 3px; margin-left: 5px; vertical-align: 2px; }
  .previa-hora { color: #949ba4; font-size: .72rem; font-weight: 400; margin-left: 7px; }
  .previa-embed { border-left: 4px solid var(--latao); background: #2b2d31; padding: 13px 16px; max-width: 460px; }
  .previa-embed strong { display: block; color: #f2f3f5; font-size: .94rem; margin-bottom: 9px; }
  .previa-campeoes { display: flex; flex-wrap: wrap; gap: 5px; }
  .previa-campeoes img { width: 38px; height: 38px; border: 1px solid var(--latao); background: #1e1f22; }
  .previa-rodape { color: #949ba4; font-size: .75rem; margin: 10px 0 0; }

  .previa-comando { color: #949ba4; font-size: .78rem; margin: 0 0 6px; }
  .previa-comando code { background: none; border: 0; padding: 0; color: #c9cdfb; }
  .previa-rotulo { color: #b5bac1; font-size: .78rem; font-weight: 600; margin: 0 0 6px; }

  /* ---------- builds ---------- */
  .busca {
    width: 100%; font: inherit; color: var(--texto); padding: 12px 14px; margin: 6px 0 18px;
    border: 1px solid var(--linha); border-radius: 0; background: var(--fundo);
  }
  .busca:focus-visible { outline: 2px solid var(--latao); outline-offset: 2px; border-color: var(--latao); }
  .grade-campeoes { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 10px; }
  .grade-campeoes a {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    text-decoration: none; color: var(--texto-fraco); font-size: .74rem; text-align: center; line-height: 1.2;
  }
  .grade-campeoes a:hover { color: var(--latao-claro); }
  .grade-campeoes img { width: 56px; height: 56px; border: 1px solid var(--latao-escuro); background: var(--fundo); }
  .grade-campeoes a:hover img { border-color: var(--latao); }
  .build-topo { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
  .build-topo img { width: 72px; height: 72px; border: 2px solid var(--latao); flex: none; }
  .build-topo h1 { margin: 0 0 4px; }
  .build-topo p { margin: 0; }
  .abas { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0 4px; }
  .abas a { text-decoration: none; }
  .abas .tag.ok { background: color-mix(in srgb, var(--verde) 14%, transparent); }
  .linha-itens { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; }
  .item { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 76px; text-align: center; font-size: .74rem; line-height: 1.2; color: var(--texto-fraco); }
  .item img { width: 50px; height: 50px; border: 1px solid var(--latao); background: var(--fundo); }
  .item.runa img { border-radius: 50%; border-color: var(--latao-escuro); background: var(--superficie); padding: 3px; }
  .item.runa.chave img { width: 60px; height: 60px; border-color: var(--latao); }
  .seta { align-self: center; margin-top: -18px; color: var(--latao); font-size: 1.1rem; }
  .estat { font-size: .84rem; color: var(--texto-fraco); margin: 12px 0 0; }
  .estat strong { color: var(--verde); }
  .teclas { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-family: "Big Shoulders Display", sans-serif; font-weight: 800; font-size: 1.4rem; color: var(--latao-claro); }
  .teclas span.tecla { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid var(--latao); background: var(--fundo); clip-path: var(--degrau-p); }
  .duas-colunas { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  main.conteudo .duas-colunas .cartao { margin: 0; }
  /* ---------- comandos ---------- */
  .comandos { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
  .comando {
    display: flex; align-items: baseline; gap: 11px; padding: 15px 20px;
    background: var(--superficie-2); border-left: 3px solid var(--latao);
  }
  .comando code { background: none; border: 0; padding: 0; font-size: 1rem; font-weight: 600; }
  .comando span { color: var(--texto-fraco); font-size: .88rem; }

  /* ---------- páginas internas ---------- */
  main.conteudo { max-width: 720px; margin: 0 auto; padding: 100px 20px 70px; }
  main.cheio { padding: 0; }
  .centro { text-align: center; }
  .voltar {
    display: inline-block; font-family: "Big Shoulders Display", sans-serif;
    font-weight: 700; font-size: .92rem; text-transform: uppercase;
    letter-spacing: .16em; text-decoration: none; margin-bottom: 18px;
  }
  main.conteudo .cartao { margin: 16px 0; }
  main.conteudo .cartao:hover { background: var(--latao-escuro); }

  /* ---------- formulário ---------- */
  .interruptor { display: flex; align-items: center; gap: 15px; font-size: .95rem; font-weight: 600; margin: 0 0 18px; cursor: pointer; }
  .campo { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 12px; }
  .campo > span {
    color: var(--texto-fraco); min-width: 150px;
    font-family: "Big Shoulders Display", sans-serif; font-weight: 700;
    font-size: .92rem; text-transform: uppercase; letter-spacing: .13em;
  }
  .campo select { flex: 1; min-width: 200px; }

  select {
    appearance: none; -webkit-appearance: none; -moz-appearance: none;
    font: inherit; font-size: .9rem; color: var(--texto); cursor: pointer;
    padding: 10px 36px 10px 13px;
    border: 1px solid var(--linha); border-radius: 0;
    background-color: var(--fundo);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23c8a24a' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 13px center; background-size: 13px;
    transition: border-color .15s ease;
  }
  select:hover { border-color: var(--latao); }
  select:focus-visible { outline: 2px solid var(--latao); outline-offset: 2px; border-color: var(--latao); }
  option { background: var(--superficie); color: var(--texto); }

  /* Losango, não quadrado: rima com o ornamento e com o ponto do rótulo
     "ao vivo". A margem compensa a sobra da diagonal (17px girado desenha
     24px), senão ele encosta na moldura do cartão. */
  input[type="checkbox"] {
    appearance: none; -webkit-appearance: none;
    width: 17px; height: 17px; flex: none; margin: 0 0 0 4px; cursor: pointer;
    border: 1px solid var(--linha); border-radius: 0; rotate: 45deg;
    background: var(--fundo); transition: background-color .15s ease, border-color .15s ease;
  }
  input[type="checkbox"]:hover { border-color: var(--latao); }
  input[type="checkbox"]:checked { background-color: var(--verde); border-color: var(--verde); }
  input[type="checkbox"]:focus-visible { outline: 2px solid var(--latao); outline-offset: 3px; }

  .aviso, .fraco { color: var(--texto-fraco); font-size: .88rem; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 18px 0; }
  .tile { background: var(--superficie-2); border: 1px solid var(--linha); padding: 16px; text-align: center; clip-path: var(--degrau-p); }
  .tile strong { display: block; font-family: "Big Shoulders Display", sans-serif; font-weight: 800; font-size: 2rem; line-height: 1.1; color: var(--latao); }
  .tile span {
    color: var(--texto-fraco); font-size: .78rem;
    text-transform: uppercase; letter-spacing: .12em;
  }
  .tag {
    display: inline-block; padding: 2px 10px; font-size: .72rem;
    font-family: "Big Shoulders Display", sans-serif; font-weight: 700;
    text-transform: uppercase; letter-spacing: .12em;
    border: 1px solid var(--linha); color: var(--texto-fraco);
  }
  .tag.ok { border-color: var(--verde); color: var(--verde); }
  .tag.atencao { border-color: var(--alerta); color: var(--alerta); }
  .noticias { display: flex; flex-direction: column; gap: 7px; margin: 12px 0 16px; }
  .noticia {
    display: flex; align-items: flex-start; gap: 11px; margin: 0; cursor: pointer;
    padding: 11px 14px; border: 1px solid var(--linha);
    background: var(--fundo); font-weight: 400;
  }
  .noticia:hover { border-color: var(--latao); }
  .noticia > span { display: flex; flex-direction: column; gap: 2px; }
  .noticia strong { font-size: .92rem; font-weight: 600; }
  .noticia input[type="radio"] { flex: none; margin-top: 4px; accent-color: var(--verde); width: 15px; height: 15px; }
  .banner {
    display: inline-block; padding: 12px 20px;
    font-family: "Big Shoulders Display", sans-serif; font-weight: 700;
    text-transform: uppercase; letter-spacing: .1em; font-size: .95rem;
    background: var(--verde); color: var(--btn-texto); clip-path: var(--degrau-p);
  }
  .banner.atencao { background: var(--alerta); color: var(--alerta-texto); }

  .rodape {
    text-align: center; color: var(--texto-fraco); font-size: .82rem;
    padding: 36px clamp(18px, 5vw, 40px) 44px;
    border-top: 2px solid var(--latao-escuro);
  }
  .rodape .legal { max-width: 620px; margin: 16px auto 0; font-size: .74rem; opacity: .75; line-height: 1.55; }
  ul { padding-left: 20px; }
  li { margin-bottom: 7px; }

  /* Revelação no scroll.
     O estado escondido só existe quando a classe "com-revelar" entra no
     <html>, e quem põe ela é o próprio JS. Sem isso, quem estiver com o
     JavaScript desligado ficaria com a página em branco — o conteúdo estaria
     lá, invisível para sempre. */
  .com-revelar .revelar {
    opacity: 0; transform: translateY(28px);
    transition: opacity .75s ease, transform .75s cubic-bezier(.2, .7, .3, 1);
  }
  .com-revelar .revelar.visivel { opacity: 1; transform: none; }

  /* Escalonado: os filhos entram em cascata, um atrás do outro. Usado nos
     três cartões de função e nos comandos. */
  .com-revelar .escalonar > * {
    opacity: 0; transform: translateY(24px);
    transition: opacity .65s ease, transform .65s cubic-bezier(.2, .7, .3, 1);
  }
  .com-revelar .escalonar.visivel > * { opacity: 1; transform: none; }
  .com-revelar .escalonar.visivel > :nth-child(2) { transition-delay: .11s; }
  .com-revelar .escalonar.visivel > :nth-child(3) { transition-delay: .22s; }
  .com-revelar .escalonar.visivel > :nth-child(4) { transition-delay: .33s; }
  .com-revelar .escalonar.visivel > :nth-child(5) { transition-delay: .44s; }
  .com-revelar .escalonar.visivel > :nth-child(6) { transition-delay: .55s; }

  /* ---------- carregamento entre páginas ---------- */
  /* Começa visível em toda página e some sozinho por CSS — assim funciona
     até sem JavaScript. Ao clicar num link interno, o JS liga de novo
     (classe "ativo") enquanto a próxima página carrega. */
  .carregando {
    position: fixed; inset: 0; z-index: 100;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
    background:
      radial-gradient(60% 50% at 50% 45%, color-mix(in srgb, var(--latao) 12%, transparent) 0%, transparent 70%),
      var(--fundo);
    pointer-events: none;
    animation: sumir-carregando .35s ease .45s both;
  }
  .carregando.ativo { animation: aparecer-carregando .18s ease both; pointer-events: auto; }
  /* Trava do JS: o navegador pode congelar a animação de sumir (aba em
     segundo plano, por exemplo), e aí a tela de carregamento ficaria por
     cima da página pronta. */
  .carregando.pronto:not(.ativo) { display: none; }
  @keyframes sumir-carregando { to { opacity: 0; visibility: hidden; } }
  @keyframes aparecer-carregando { from { opacity: 0; } to { opacity: 1; visibility: visible; } }
  .carregando-logo { position: relative; width: 96px; height: 96px; }
  .carregando-logo img { position: relative; z-index: 1; width: 100%; height: 100%; border-radius: 50%; animation: pulsar-logo 1.1s ease-in-out infinite; }
  /* Dois arcos girando em sentidos opostos em volta da logo. */
  .carregando-logo::before, .carregando-logo::after {
    content: ""; position: absolute; border-radius: 50%; border: 2px solid transparent;
  }
  .carregando-logo::before { inset: -14px; border-top-color: var(--latao); border-right-color: var(--latao); animation: girar .9s linear infinite; }
  .carregando-logo::after { inset: -24px; border-bottom-color: var(--verde); border-left-color: var(--verde); animation: girar 1.4s linear infinite reverse; opacity: .7; }
  .carregando-texto {
    font-family: "Big Shoulders Display", sans-serif; font-weight: 800; font-size: 1rem;
    letter-spacing: .5em; text-transform: uppercase; color: var(--latao); padding-left: .5em;
  }
  .carregando-texto span { display: inline-block; animation: piscar-letra 1.2s ease-in-out infinite; }
  @keyframes pulsar-logo {
    0%, 100% { transform: scale(.93); filter: drop-shadow(0 0 0 transparent); }
    50% { transform: scale(1.05); filter: drop-shadow(0 0 16px color-mix(in srgb, var(--latao) 70%, transparent)); }
  }
  @keyframes piscar-letra { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }

  /* ---------- botões vivos ---------- */
  .botao, .topo-link, .tema, .selos li, .abas .tag { position: relative; overflow: hidden; }
  .botao { transition: filter .15s ease, transform .18s cubic-bezier(.3, 1.6, .5, 1); }
  .botao:hover { transform: translateY(-2px); }
  .botao:active { transform: translateY(1px) scale(.96); transition-duration: .06s; }
  /* Faixa de brilho que atravessa o botão ao passar o mouse. */
  .botao::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, .38) 50%, transparent 70%);
    transform: translateX(-130%); transition: transform .65s ease;
  }
  .botao:hover::after { transform: translateX(130%); }
  /* O botão principal "respira", chamando atenção sem piscar. */
  .botao.destaque { animation: respirar 2.8s ease-in-out infinite; }
  .botao.destaque:hover { animation: none; }
  @keyframes respirar { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.18) saturate(1.15); } }
  /* Onda que sai do ponto clicado (criada pelo JS). */
  .onda {
    position: absolute; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, rgba(255, 255, 255, .55) 0%, rgba(255, 255, 255, .15) 60%, transparent 70%);
    transform: translate(-50%, -50%) scale(0); animation: onda .6s ease-out forwards;
  }
  @keyframes onda { to { transform: translate(-50%, -50%) scale(1); opacity: 0; } }
  /* Faíscas em losango que espirram do clique. */
  .faisca {
    position: fixed; z-index: 99; width: 7px; height: 7px; pointer-events: none;
    background: var(--cor, var(--latao)); rotate: 45deg;
    box-shadow: 0 0 8px var(--cor, var(--latao));
    animation: faisca .65s cubic-bezier(.2, .8, .3, 1) forwards;
  }
  @keyframes faisca { to { transform: translate(var(--dx), var(--dy)) scale(.2); opacity: 0; } }

  /* ---------- topo vivo ---------- */
  .particulas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  /* A logo do Discord do título balança, sobe e desce e brilha. */
  .logo-discord { transform-origin: 50% 65%; animation: dancar-logo 3.4s ease-in-out infinite; }
  .heroi h1:hover .logo-discord { animation: pular-logo .7s cubic-bezier(.3, 1.6, .5, 1); }
  @keyframes dancar-logo {
    0%, 100% { transform: translateY(0) rotate(-6deg); filter: drop-shadow(0 0 0 transparent); }
    25% { transform: translateY(-.09em) rotate(5deg); }
    50% { transform: translateY(-.03em) rotate(-3deg) scale(1.06); filter: drop-shadow(0 0 .18em color-mix(in srgb, var(--latao) 75%, transparent)); }
    75% { transform: translateY(-.1em) rotate(6deg); }
  }
  @keyframes pular-logo {
    0% { transform: translateY(0) scale(1); }
    40% { transform: translateY(-.3em) scale(1.15) rotate(-12deg); }
    100% { transform: translateY(0) scale(1); }
  }
  /* Entrada do topo em cascata. */
  .heroi-dentro > * { animation: subir-entrada .8s cubic-bezier(.2, .7, .3, 1) both; }
  .heroi-dentro > :nth-child(1) { animation-delay: .5s; }
  .heroi-dentro > :nth-child(2) { animation-delay: .62s; }
  .heroi-dentro > :nth-child(3) { animation-delay: .74s; }
  .heroi-dentro > :nth-child(4) { animation-delay: .86s; }
  .heroi-dentro > :nth-child(5) { animation-delay: .98s; }
  @keyframes subir-entrada { from { opacity: 0; transform: translateY(26px); filter: blur(4px); } }
  /* Mesma trava da tela de carregamento: depois do tempo da entrada, o JS
     desliga a animação, e o texto nunca fica preso invisível. */
  .entrada-pronta .heroi-dentro > * { animation: none; }
  /* O pontinho "online" dos selos pisca de leve, um de cada vez. */
  .selos .ponto { animation: online 2.4s ease-in-out infinite; }
  .selos li:nth-child(2) .ponto { animation-delay: .8s; }
  .selos li:nth-child(3) .ponto { animation-delay: 1.6s; }
  @keyframes online { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .45; transform: scale(.7); } }
  .selos li { transition: transform .2s ease, border-color .2s ease; }
  .selos li:hover { transform: translateY(-2px); border-color: var(--latao); }

  @view-transition { navigation: auto; }
  .topo { view-transition-name: topo; }
  @keyframes entrar-conteudo { from { opacity: 0; transform: translateY(10px); } }
  @keyframes sair-conteudo { to { opacity: 0; transform: translateY(-6px); } }
  ::view-transition-old(root) { animation: sair-conteudo .2s ease both; }
  ::view-transition-new(root) { animation: entrar-conteudo .28s ease both; }
  @supports not (view-transition-name: none) {
    main { animation: entrar-conteudo .28s ease both; }
  }
  /* Quem pediu menos animação no sistema recebe a página parada e completa:
     nada de brasa subindo, anel girando ou conteúdo escondido esperando
     scroll. O conteúdo aparece de uma vez, que é o ponto. */
  @media (prefers-reduced-motion: reduce) {
    .botao, .cartao, .funcao, select, input { transition: none; }
    main, ::view-transition-old(root), ::view-transition-new(root) { animation: none; }
    body::before, .brasas span, .heroi-aneis i, .rolar { animation: none; }
    .carregando, .particulas, .faisca, .onda { display: none; }
    .logo-discord, .heroi-dentro > *, .selos .ponto, .botao.destaque { animation: none; }
    .botao::after { display: none; }
    .brasas { display: none; }
    .com-revelar .revelar,
    .com-revelar .escalonar > * { opacity: 1; transform: none; transition: none; }
  }

  @media (max-width: 620px) {
    br.so-largo { display: none; }
    .heroi h1 { text-wrap: balance; }
    .heroi { padding-top: 80px; }
    .heroi::after { display: none; }
    .cartao { padding: 19px; }
    .funcao-corpo { padding: 22px 20px 16px; }
    .funcao-ao-vivo { margin: 14px 20px 20px; }
    .previa-msg { padding: 13px; }
    .marca { font-size: 1.05rem; letter-spacing: .16em; }
  }
`;


// Texto que o Google mostra embaixo do link e que aparece na prévia quando o
// link é colado no Discord ou no WhatsApp.
const DESCRICAO_PADRAO =
  "Bot de Discord de League of Legends, grátis e em português: /build com a build do meta de cada campeão, " +
  "aviso de patch novo, notícias oficiais, skins novas e em promoção e vídeos do canal oficial.";

function layout(titulo, corpo, opcoes = {}) {
  const classeMain = opcoes.cheio ? "cheio" : "conteudo";
  const descricao = opcoes.descricao ?? DESCRICAO_PADRAO;
  const imagem = opcoes.imagem ?? `${SITE}/og.png`;
  // Página só para quem está logado (painel, admin) não deve ir para o
  // Google — e nem tem conteúdo útil para quem chega por lá.
  const indexar = opcoes.indexar !== false;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escapar(descricao)}">
${indexar ? "" : '<meta name="robots" content="noindex">'}
${opcoes.caminho ? `<link rel="canonical" href="${SITE}${escapar(opcoes.caminho)}">` : ""}
<meta property="og:site_name" content="Ward">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${escapar(titulo)}">
<meta property="og:description" content="${escapar(descricao)}">
<meta property="og:image" content="${escapar(imagem)}">
${opcoes.caminho ? `<meta property="og:url" content="${SITE}${escapar(opcoes.caminho)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#c8a24a">
<link rel="icon" href="/favicon.webp" type="image/webp">
<!-- Sem preconnect nem stylesheet de terceiro: as fontes são servidas por
     este mesmo domínio, então não há handshake externo antes do texto
     aparecer. Só o Data Dragon continua de fora, para os ícones. -->
<link rel="preload" href="/fontes/BigShoulders.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fontes/Spiegel-Regular.woff" as="font" type="font/woff" crossorigin>
<title>${escapar(titulo)}</title>
<style>${FONTES}${ESTILO}</style>
<script>
  // Antes de pintar a tela, senão o tema claro pisca escuro ao carregar.
  try { var t = localStorage.getItem("tema"); if (t) document.documentElement.dataset.tema = t; } catch (e) {}
</script>
</head>
<body>
<div class="carregando" id="carregando" aria-hidden="true">
  <div class="carregando-logo"><img src="/favicon.webp" alt="" width="96" height="96"></div>
  <p class="carregando-texto">${[..."WARD"].map((l, i) => `<span style="animation-delay:${i * 0.12}s">${l}</span>`).join("")}</p>
</div>
<div class="brasas" aria-hidden="true">${BRASAS}</div>
<div class="progresso" aria-hidden="true"></div>
<header class="topo">
  <a class="marca" href="/"><img src="/favicon.webp" alt=""> Ward</a>
  <div class="topo-dir">
    <a class="topo-link" href="/build">Builds</a>
    <a class="topo-link" href="/dashboard">Painel</a>
    <button class="tema" type="button" id="alternar-tema" aria-label="Alternar tema claro e escuro">
      <span class="lua">${ICONE_LUA}</span><span class="sol">${ICONE_SOL}</span>
    </button>
  </div>
</header>
<main class="${classeMain}">
${corpo}
</main>
<script>
  document.getElementById("alternar-tema").addEventListener("click", function () {
    var raiz = document.documentElement;
    var escuroAgora = raiz.dataset.tema
      ? raiz.dataset.tema === "escuro"
      : !window.matchMedia("(prefers-color-scheme: light)").matches;
    raiz.dataset.tema = escuroAgora ? "claro" : "escuro";
    try { localStorage.setItem("tema", raiz.dataset.tema); } catch (e) {}
  });

  // Revelação no scroll e barra de progresso.
  //
  // Quem pediu menos animação no sistema não entra aqui: a página fica
  // parada e inteira, que é o comportamento certo nesse caso.
  (function () {
    var parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var raiz = document.documentElement;

    if (!parado && "IntersectionObserver" in window) {
      // A classe que esconde só entra agora, com o JS rodando. Se o
      // JavaScript estiver desligado, nada fica escondido.
      raiz.classList.add("com-revelar");

      // Nas páginas internas não há marcação própria: os cartões entram na
      // revelação automaticamente.
      document.querySelectorAll("main.conteudo .cartao").forEach(function (e) {
        e.classList.add("revelar");
      });

      var observador = new IntersectionObserver(
        function (entradas) {
          entradas.forEach(function (entrada) {
            if (!entrada.isIntersecting) return;
            entrada.target.classList.add("visivel");
            observador.unobserve(entrada.target);  // revela uma vez e esquece
          });
        },
        // A margem negativa embaixo faz o elemento esperar entrar de verdade
        // no campo de visão, em vez de disparar ao encostar na borda.
        { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
      );
      document.querySelectorAll(".revelar, .escalonar").forEach(function (e) {
        observador.observe(e);
      });
    }

    var barra = document.querySelector(".progresso");
    if (barra && !parado) {
      var agendado = false;
      function medir() {
        agendado = false;
        var rolavel = document.documentElement.scrollHeight - window.innerHeight;
        var p = rolavel > 0 ? window.scrollY / rolavel : 0;
        barra.style.setProperty("--p", Math.min(1, Math.max(0, p)).toFixed(4));
      }
      // Passivo e limitado a um cálculo por quadro: ouvinte de scroll é o
      // lugar clássico de travar a rolagem.
      window.addEventListener(
        "scroll",
        function () {
          if (agendado) return;
          agendado = true;
          requestAnimationFrame(medir);
        },
        { passive: true }
      );
      medir();
    }
  })();

  // Tela de carregamento ao trocar de página, onda e faíscas nos cliques e
  // partículas no fundo do topo. Nada disso roda para quem pediu menos
  // animação no sistema.
  (function () {
    var carregando = document.getElementById("carregando");
    // Garante que a tela de carregamento sai, mesmo se a animação de CSS
    // não andar: o tempo dela (0,45s + 0,35s) e um pouco de folga.
    setTimeout(function () { carregando.classList.add("pronto"); }, 900);
    // A entrada do topo dura até ~1,8s (último atraso + duração).
    setTimeout(function () { document.documentElement.classList.add("entrada-pronta"); }, 2000);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Liga a tela de carregamento só em navegação interna de verdade: link
    // do próprio site, sem nova aba, sem âncora (#funcoes rola a página) e
    // sem tecla modificadora (ctrl+clique abre em outra aba).
    document.addEventListener("click", function (e) {
      var link = e.target.closest && e.target.closest("a[href]");
      if (!link || e.defaultPrevented || e.button !== 0) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      var destino = new URL(link.href, location.href);
      if (destino.origin !== location.origin) return;
      if (destino.pathname === location.pathname && destino.hash) return;
      carregando.classList.add("ativo");
    });
    document.addEventListener("submit", function () { carregando.classList.add("ativo"); });
    // Voltar pelo navegador reaproveita a página da memória: sem isto ela
    // voltaria com a tela de carregamento ainda ligada.
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) carregando.classList.remove("ativo");
    });

    // Onda a partir do ponto do clique e faíscas espirrando dele.
    var CORES = ["var(--latao)", "var(--latao-claro)", "var(--verde)"];
    document.addEventListener("pointerdown", function (e) {
      var alvo = e.target.closest && e.target.closest(".botao, .topo-link, .tema, .selos li, .abas .tag");
      if (!alvo) return;
      var caixa = alvo.getBoundingClientRect();
      var tamanho = Math.max(caixa.width, caixa.height) * 2.2;
      var onda = document.createElement("span");
      onda.className = "onda";
      onda.style.width = onda.style.height = tamanho + "px";
      onda.style.left = e.clientX - caixa.left + "px";
      onda.style.top = e.clientY - caixa.top + "px";
      alvo.appendChild(onda);
      setTimeout(function () { onda.remove(); }, 650);

      if (!alvo.classList.contains("botao")) return;
      for (var i = 0; i < 10; i++) {
        var f = document.createElement("span");
        var angulo = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
        var distancia = 40 + Math.random() * 45;
        f.className = "faisca";
        f.style.left = e.clientX - 3 + "px";
        f.style.top = e.clientY - 3 + "px";
        f.style.setProperty("--dx", Math.cos(angulo) * distancia + "px");
        f.style.setProperty("--dy", Math.sin(angulo) * distancia + "px");
        f.style.setProperty("--cor", CORES[i % CORES.length]);
        document.body.appendChild(f);
        setTimeout(function (el) { el.remove(); }, 700, f);
      }
    });

    // Partículas do topo: pontos de luz subindo, ligados por fios finos
    // quando passam perto, e algumas logos do Discord flutuando devagar. O
    // mouse empurra as partículas de leve. Para de desenhar quando o topo
    // sai da tela ou a aba fica escondida, para não gastar bateria à toa.
    var tela = document.getElementById("particulas");
    if (!tela || !tela.getContext) return;
    var ctx = tela.getContext("2d");
    var logo = new Path2D(tela.dataset.logo);
    var largura = 0, altura = 0, pontos = [], logos = [], visivel = true, quadro = 0;
    var mouse = { x: -9999, y: -9999 };

    // As cores do tema viram "r,g,b" uma vez só (e de novo ao trocar de
    // tema) — ler o CSS a cada partícula a cada quadro pesaria.
    var rgb = {};
    function lerCores() {
      var estilo = getComputedStyle(document.documentElement);
      ["--latao", "--verde"].forEach(function (nome) {
        var n = parseInt((estilo.getPropertyValue(nome).trim() || "#c8a24a").slice(1), 16);
        rgb[nome] = (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255);
      });
    }
    function cor(nome, alfa) { return "rgba(" + rgb[nome] + "," + alfa.toFixed(3) + ")"; }
    lerCores();

    function ajustar() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      largura = tela.clientWidth;
      altura = tela.clientHeight;
      tela.width = largura * dpr;
      tela.height = altura * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var quantos = Math.min(110, Math.round((largura * altura) / 13000));
      pontos = [];
      for (var i = 0; i < quantos; i++) pontos.push(novoPonto(true));
      logos = [];
      var nLogos = largura < 620 ? 4 : 8;
      for (var j = 0; j < nLogos; j++) logos.push(novaLogo(true));
    }

    function novoPonto(espalhado) {
      return {
        x: Math.random() * largura,
        y: espalhado ? Math.random() * altura : altura + 10,
        r: 0.6 + Math.random() * 1.9,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -(0.15 + Math.random() * 0.55),
        fase: Math.random() * Math.PI * 2,
        verde: Math.random() < 0.3,
      };
    }

    function novaLogo(espalhado) {
      return {
        x: Math.random() * largura,
        y: espalhado ? Math.random() * altura : altura + 40,
        tam: 16 + Math.random() * 22,
        vy: -(0.12 + Math.random() * 0.3),
        giro: Math.random() * Math.PI * 2,
        vgiro: (Math.random() - 0.5) * 0.01,
        fase: Math.random() * Math.PI * 2,
        verde: Math.random() < 0.35,
      };
    }

    function desenhar() {
      if (!visivel || document.hidden) { quadro = 0; return; }
      quadro = requestAnimationFrame(desenhar);
      ctx.clearRect(0, 0, largura, altura);
      var agora = performance.now() / 1000;

      for (var i = 0; i < pontos.length; i++) {
        var p = pontos[i];
        // Empurrão do mouse: quanto mais perto, mais forte.
        var dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 14400) {
          var forca = (1 - d2 / 14400) * 1.6;
          var d = Math.sqrt(d2) || 1;
          p.x += (dx / d) * forca;
          p.y += (dy / d) * forca;
        }
        p.x += p.vx + Math.sin(agora + p.fase) * 0.15;
        p.y += p.vy;
        if (p.y < -10 || p.x < -20 || p.x > largura + 20) pontos[i] = p = novoPonto(false);
        var brilho = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(agora * 2 + p.fase));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = cor(p.verde ? "--verde" : "--latao", brilho);
        ctx.fill();
        // Halo: um círculo maior e quase transparente, mais barato que
        // shadowBlur.
        if (p.r > 1.6) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
          ctx.fillStyle = cor(p.verde ? "--verde" : "--latao", brilho * 0.12);
          ctx.fill();
        }
      }

      // Fios entre pontos próximos, como uma constelação.
      for (var a = 0; a < pontos.length; a++) {
        for (var b = a + 1; b < pontos.length; b++) {
          var ex = pontos[a].x - pontos[b].x, ey = pontos[a].y - pontos[b].y;
          var dist2 = ex * ex + ey * ey;
          if (dist2 > 9000) continue;
          ctx.strokeStyle = cor("--latao", (1 - dist2 / 9000) * 0.18);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(pontos[a].x, pontos[a].y);
          ctx.lineTo(pontos[b].x, pontos[b].y);
          ctx.stroke();
        }
      }

      for (var k = 0; k < logos.length; k++) {
        var l = logos[k];
        l.y += l.vy;
        l.giro += l.vgiro;
        if (l.y < -50) logos[k] = l = novaLogo(false);
        var escala = l.tam / 127;
        var oscila = Math.sin(agora * 1.3 + l.fase);
        ctx.save();
        ctx.translate(l.x + oscila * 12, l.y);
        ctx.rotate(l.giro + oscila * 0.25);
        ctx.scale(escala, escala);
        ctx.translate(-63.5, -48);
        ctx.fillStyle = cor(l.verde ? "--verde" : "--latao", 0.1 + 0.08 * (0.5 + 0.5 * oscila));
        ctx.fill(logo);
        ctx.restore();
      }
    }

    function retomar() { if (!quadro && visivel && !document.hidden) desenhar(); }

    ajustar();
    desenhar();
    var redimensionar;
    window.addEventListener("resize", function () {
      clearTimeout(redimensionar);
      redimensionar = setTimeout(ajustar, 150);
    });
    tela.parentElement.addEventListener("pointermove", function (e) {
      var caixa = tela.getBoundingClientRect();
      mouse.x = e.clientX - caixa.left;
      mouse.y = e.clientY - caixa.top;
    });
    tela.parentElement.addEventListener("pointerleave", function () { mouse.x = mouse.y = -9999; });
    document.addEventListener("visibilitychange", retomar);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entradas) {
        visivel = entradas[0].isIntersecting;
        retomar();
      }).observe(tela);
    }
    // O tema pode trocar as cores (claro/escuro).
    document.getElementById("alternar-tema").addEventListener("click", function () {
      setTimeout(lerCores, 0);
    });
  })();
</script>
</body>
</html>`;
}

// As funções abaixo devolvem só o conteúdo da página; quem coloca o esqueleto
// (cabeçalho, estilo, alternador de tema) é o paginaHtml, uma única vez.
export function paginaHtml(titulo, corpo, opcoes = {}) {
  return new Response(layout(titulo, corpo, opcoes), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Aviso exigido pela política de conteúdo de fãs da Riot, traduzido.
const RODAPE_LEGAL = `O Ward não é endossado pela Riot Games e não reflete as
visões ou opiniões da Riot Games nem de ninguém oficialmente envolvido na
produção ou gestão das propriedades da Riot Games. Riot Games e todas as
propriedades associadas são marcas comerciais ou marcas registradas da Riot
Games, Inc.`;

function rodape() {
  return `
    <footer class="rodape">
      <a href="/privacidade">Política de privacidade</a> · <a href="/termos">Termos de uso</a>
      <p class="legal">${RODAPE_LEGAL}</p>
    </footer>
  `;
}

export function landing(clientId, vitrine) {
  const patch = vitrine?.patch || VERSAO_ARTE;
  const noticias = Array.isArray(vitrine?.noticias) ? vitrine.noticias : [];

  // A build do dia vem pronta do cron (ver atualizarVitrineBuild). Sem ela
  // — OP.GG fora do ar —, a prévia usa um exemplo fixo e o bloco "ao
  // vivo" simplesmente não aparece, em vez de fingir que é dado real.
  const buildReal = vitrine?.build?.itens?.length ? vitrine.build : null;
  const build = buildReal ?? BUILD_EXEMPLO;
  const versaoIcones = buildReal ? patch : VERSAO_ARTE;

  const iconeCampeao = (img, nome, tamanho) =>
    `<img src="${DDRAGON}/cdn/${escapar(versaoIcones)}/img/champion/${escapar(img)}.png"` +
    ` alt="${escapar(nome ?? "")}" title="${escapar(nome ?? "")}" width="${tamanho}" height="${tamanho}" loading="lazy">`;
  const iconeItem = (id, tamanho) =>
    `<img src="${DDRAGON}/cdn/${escapar(versaoIcones)}/img/item/${Number(id)}.png" alt="" width="${tamanho}" height="${tamanho}" loading="lazy">`;

  const itensPrevia = build.itens.map((id) => iconeItem(id, 38)).join("");
  const tituloPrevia = `${build.campeao.nome}${build.rota ? ` · ${NOMES_ROTA[build.rota] ?? ""}` : ""} · Partida normal`;
  const rodapePrevia = buildReal
    ? `${porcentagem(buildReal.taxa)} de vitória em ${buildReal.jogos.toLocaleString("pt-BR")} partidas · dados OP.GG.`
    : "Itens, runas, feitiços e habilidades de quem mais ganha no BR.";

  // Cada função mostra o dado de verdade que o bot acabou de ver. É a
  // diferença entre dizer "aviso patch novo" e provar que o patch no ar
  // agora é o 16.20.1. Se a vitrine faltar, o bloco simplesmente não sai e
  // o cartão continua inteiro.
  const aoVivo = (rotulo, conteudo) =>
    conteudo
      ? `<div class="funcao-ao-vivo">
            <p class="rotulo-vivo">${escapar(rotulo)}</p>
            ${conteudo}
          </div>`
      : "";

  const destaque = noticias[0];
  const promocoes = Array.isArray(vitrine?.promocoes) ? vitrine.promocoes : [];
  const skinsNovas = Array.isArray(vitrine?.skins) ? vitrine.skins : [];
  const video = vitrine?.video ?? null;
  // Recorte quadrado da arte da skin ("tiles" no Data Dragon).
  const quadroSkin = (s, titulo) =>
    `<img class="quadro-skin" src="${DDRAGON}/cdn/img/champion/tiles/${escapar(s.img)}_${Number(s.skinId) % 1000}.jpg"` +
    ` alt="${escapar(titulo)}" title="${escapar(titulo)}" width="48" height="48" loading="lazy">`;

  const funcao = (num, titulo, texto, vivo) => `
        <article class="funcao">
          <div class="funcao-corpo">
            <span class="funcao-num">${num}</span>
            <h3>${titulo}</h3>
            <p>${texto}</p>
          </div>
          ${vivo}
        </article>`;

  return `
    <section class="heroi">
      <canvas class="particulas" id="particulas" aria-hidden="true" data-logo="${CAMINHO_DISCORD}"></canvas>
      <div class="heroi-aneis" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="heroi-dentro">
        <p class="sobrancelha">Bot de Discord · League of Legends</p>
        <!-- O espaço antes de cada <br> é necessário: no celular o <br> some
             (display:none) e sem ele as palavras encostariam uma na outra. -->
        <h1>Fique por dentro do LoL, <br>direto no seu ${LOGO_DISCORD}</h1>
        <div class="ornamento"><i></i></div>
        <!-- As funções como selos: deixa claro, logo de cara, que tudo roda
             dentro do servidor, sem abrir outro site. -->
        <ul class="selos">
          <li><span class="ponto"></span>Patch e notícias</li>
          <li><span class="ponto"></span>Skins novas e em promoção</li>
          <li><span class="ponto"></span><code>/build</code> do meta</li>
        </ul>
        <div class="acoes">
          <a class="botao destaque" href="${convite(clientId)}">Adicionar ao Discord</a>
          <a class="botao vazado" href="#funcoes">Ver o que ele faz</a>
        </div>
      </div>
      <!-- O hero ocupa a tela inteira, então sem esta seta não fica claro
           que tem conteúdo embaixo. -->
      <a class="rolar" href="#funcoes" aria-label="Ver o que ele faz">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </a>
    </section>

    <section class="faixa escura" id="funcoes">
      <div class="limite">
        <div class="titulo-secao revelar">
          <h2>Seis funções, zero esforço</h2>
          <div class="ornamento"><i></i></div>
        </div>
        <div class="funcoes escalonar">
          ${funcao(
            "01",
            "Patch novo",
            `Assim que a Riot publica um patch, o Ward posta a versão e o resumo
             oficial das novidades traduzido para português, com link para as
             notas completas.`,
            aoVivo(
              "No ar agora",
              patch ? `<p class="valor-vivo">${escapar(patch)}<small>versão atual do jogo</small></p>` : ""
            )
          )}
          ${funcao(
            "02",
            "Notícias oficiais",
            `CBLOL e outros esports, skins, atualizações do jogo e comunicados —
             direto do site oficial em português, sem passar por tradução de
             máquina.`,
            aoVivo(
              "Última publicação",
              destaque
                ? `<p class="valor-vivo">${escapar(destaque.titulo ?? "")}<small>${escapar(destaque.categoria ?? "Notícias")}</small></p>`
                : ""
            )
          )}
          ${funcao(
            "03",
            "Skins em promoção",
            `Toda semana, quando a loja troca as promoções, o Ward posta as skins
             com desconto, o preço cheio, o preço novo e até quando vale.`,
            aoVivo(
              "Em promoção agora",
              promocoes.length
                ? `<div class="campeoes-vivo">${promocoes
                    .filter((s) => s.img)
                    .map((s) => quadroSkin(s, `${s.nome} · -${s.desconto}%`))
                    .join("")}</div>`
                : ""
            )
          )}
          ${funcao(
            "04",
            "Skins novas",
            `Quando um patch traz skins novas para o jogo, o Ward avisa no canal
             com a arte de cada uma.`,
            aoVivo(
              "Últimas que chegaram",
              skinsNovas.length
                ? `<div class="campeoes-vivo">${skinsNovas
                    .filter((s) => s.arquivoCampeao)
                    .map((s) => quadroSkin({ img: s.arquivoCampeao, skinId: s.skinId }, s.nome))
                    .join("")}</div>`
                : ""
            )
          )}
          ${funcao(
            "05",
            "Vídeos do YouTube",
            `Trailer, cinemática ou clipe novo no canal oficial do League of
             Legends? O vídeo chega no canal, pronto para assistir no Discord.`,
            aoVivo(
              "Último vídeo",
              video?.id
                ? `<a class="video-vivo" href="https://www.youtube.com/watch?v=${escapar(video.id)}" target="_blank" rel="noopener">
                     <img src="https://i.ytimg.com/vi/${escapar(video.id)}/mqdefault.jpg" alt="" width="320" height="180" loading="lazy">
                     <span>${escapar(video.titulo ?? "")}</span>
                   </a>`
                : ""
            )
          )}
          ${funcao(
            "06",
            "Build do meta",
            `Digite <code>/build</code> e o campeão (ou <code>/build-aram</code> para
             o ARAM): itens, runas, feitiços e ordem de habilidades que mais
             ganham, a partir de dezenas de milhares de partidas por campeão
             (dados do OP.GG). Atualiza sozinho conforme o meta muda.`,
            aoVivo(
              `Build do dia · ${buildReal ? escapar(buildReal.campeao.nome) : ""}`,
              buildReal
                ? `<div class="campeoes-vivo"><a href="/build/${encodeURIComponent(buildReal.campeao.img)}">${iconeCampeao(
                    buildReal.campeao.img,
                    buildReal.campeao.nome,
                    34
                  )}</a>${buildReal.itens.map((id) => iconeItem(id, 34)).join("")}</div>`
                : ""
            )
          )}
        </div>
      </div>
    </section>

    <section class="faixa">
      <div class="limite">
        <div class="titulo-secao revelar">
          <h2>É isso que chega no canal</h2>
          <div class="ornamento"><i></i></div>
        </div>
        <div class="previa revelar">
          <div class="previa-barra">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>
            avisos-lol
          </div>
          <div class="previa-msg">
            <img class="previa-avatar" src="/favicon.webp" alt="" width="38" height="38">
            <div>
              <p class="previa-nome">Ward <span class="previa-tag">BOT</span><span class="previa-hora">hoje às 09:00</span></p>
              <p class="previa-comando">usou <code>/build ${escapar(build.campeao.nome)}</code></p>
              <div class="previa-embed">
                <strong>${escapar(tituloPrevia)}</strong>
                <p class="previa-rotulo">Build principal + botas</p>
                <div class="previa-campeoes">${itensPrevia}</div>
                <p class="previa-rodape">${escapar(rodapePrevia)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="faixa escura">
      <div class="limite">
        <div class="titulo-secao revelar">
          <h2>Comandos</h2>
          <div class="ornamento"><i></i></div>
        </div>
        <div class="comandos escalonar">
          <div class="comando"><code>/patch</code><span>o patch atual</span></div>
          <div class="comando"><code>/build</code><span>a build do meta de um campeão</span></div>
          <div class="comando"><code>/build-aram</code><span>a build do meta no ARAM</span></div>
          <div class="comando"><code>/dashboard</code><span>o link de configuração</span></div>
        </div>
      </div>
    </section>

    <section class="faixa">
      <div class="limite centro revelar">
        <h2>Configuração sem código</h2>
        <div class="ornamento"><i></i></div>
        <p class="aviso" style="max-width:520px;margin:0 auto 26px">Adicione o bot,
        entre no painel com sua conta do Discord e escolha o canal de cada aviso.
        O <code>/build</code> funciona assim que o bot entra, sem configurar nada.</p>
        <div class="acoes">
          <a class="botao destaque" href="${convite(clientId)}">Adicionar ao seu servidor</a>
        </div>
      </div>
    </section>

    ${rodape()}
  `;
}


export function precisaLogar() {
  return `
    <div class="centro">
      <h1>Precisa entrar primeiro</h1>
      <div class="ornamento"><i></i></div>
      <p class="aviso">Entre com sua conta do Discord para ver os servidores que você administra.</p>
      <p><a class="botao" href="/login">Entrar com Discord</a></p>
    </div>
  `;
}

export function listaServidores(servidores, clientId, ehDono) {
  const itens = servidores.length
    ? servidores
        .map(
          (s) =>
            `<div class="cartao centro"><h3>${escapar(s.name)}</h3><p><a class="botao discreto" href="/dashboard/${s.id}">Configurar</a></p></div>`
        )
        .join("")
    : `<div class="cartao centro"><p>O Ward ainda não está em nenhum servidor que você administra.</p>
       <p><a class="botao" href="${convite(clientId)}">Adicionar ao Discord</a></p></div>`;

  // O link do painel de uso só aparece para a conta dona do bot.
  const linkUso = ehDono
    ? `<p class="centro"><a class="botao vazado discreto" href="/admin/uso">Painel de uso</a></p>`
    : "";

  return `
    <div class="centro">
      <h1>Seus servidores</h1>
      <div class="ornamento"><i></i></div>
    </div>
    ${itens}
    <p class="centro"><a class="botao vazado discreto" href="${convite(clientId)}">Adicionar em outro servidor</a></p>
    ${linkUso}
  `;
}

const MENSAGENS_STATUS = {
  patch: "✓ Patch postado no canal!",
  promocoes: "✓ Promoções postadas no canal!",
  youtube: "✓ Último vídeo postado no canal!",
  sem_canal: "Escolhe um canal antes de postar.",
  erro: "Não consegui postar agora — tenta de novo em instantes.",
  noticia: "✓ Notícia postada no canal!",
  sem_noticia: "Escolhe uma notícia da lista antes de postar.",
  sem_permissao: "Não consegui escrever nesse canal — confere se o Ward tem permissão de ver o canal e enviar mensagens nele.",
};

// O que fica gravado no banco é o erro cru da Discord ("... -> 403 {...}").
// Aqui vira uma frase que o dono do servidor entende, dizendo o que ele pode
// fazer. Antes disso a falha era só console.log e ninguém ficava sabendo.
function explicarFalha(mensagem) {
  const texto = String(mensagem ?? "");
  if (/50001|50013|-> 403\b/.test(texto)) {
    return "o Ward não tem permissão nesse canal — confere se ele consegue ver o canal e enviar mensagem nele";
  }
  if (/-> 404\b/.test(texto)) return "o canal escolhido não existe mais — é só escolher outro aqui embaixo";
  if (/-> 400\b/.test(texto)) return "o Discord recusou o conteúdo da mensagem";
  if (/RIOT_API_KEY/.test(texto) || /Riot API.*-> (401|403)\b/.test(texto)) {
    return "a Riot recusou a chave da API — confira o RIOT_API_KEY do Worker";
  }
  if (/Riot API.*-> 429\b/.test(texto)) return "a Riot pediu para o bot ir mais devagar (limite da chave)";
  if (/-> 401\b/.test(texto)) {
    return "o Discord recusou o token do bot — o DISCORD_TOKEN do Worker precisa ser trocado por um válido";
  }
  if (/-> 429\b/.test(texto)) return "o Discord pediu para o bot ir mais devagar";
  return "o envio falhou";
}

// O banco grava em UTC (datetime('now')); mostra no fuso de quem lê o painel.
function quandoFalhou(quando) {
  if (!quando) return "";
  // Chegam dois formatos: o do SQLite ("2026-10-21 20:15:00", sempre UTC, sem
  // marca de fuso) e o ISO completo do JS, que já traz o Z. Só o primeiro
  // precisa que a gente diga que é UTC.
  const bruto = String(quando);
  const temFuso = /[Zz]|[+-]\d{2}:?\d{2}$/.test(bruto);
  const data = new Date(temFuso ? bruto : `${bruto.replace(" ", "T")}Z`);
  if (isNaN(data.getTime())) return "";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// Os avisos de um servidor que estão com erro gravado, na ordem em que
// aparecem no painel. Devolve [] quando está tudo certo.
function falhasDe(config) {
  return [
    ["Patch", config?.patch_last_error, config?.patch_last_error_at],
    ["Notícias", config?.news_last_error, config?.news_last_error_at],
    ["Promoções", config?.sale_last_error, config?.sale_last_error_at],
    ["Skins novas", config?.skins_last_error, config?.skins_last_error_at],
    ["YouTube", config?.youtube_last_error, config?.youtube_last_error_at],
  ].filter(([, erro]) => erro);
}

function avisoDeFalha(mensagem, quando) {
  if (!mensagem) return "";
  const data = quandoFalhou(quando);
  return `<p class="banner atencao">Último envio falhou${data ? ` (${data})` : ""}: ${escapar(explicarFalha(mensagem))}.</p>`;
}

const STATUS_DE_ATENCAO = new Set([
  "sem_canal",
  "sem_noticia",
  "erro",
  "sem_permissao",
]);

// A Riot exige URLs públicas de política de privacidade e termos de uso pra
// aprovar a API key. O conteúdo abaixo descreve exatamente o que o bot faz
// hoje — se as funções mudarem, estas páginas têm que mudar junto.
const AVISO_RIOT = RODAPE_LEGAL;

export function paginaPrivacidade() {
  return `
    <a class="voltar" href="/">← início</a>
    <h1>Política de privacidade</h1>
    <p class="aviso">Atualizada em 29 de outubro de 2026.</p>

    <div class="cartao">
      <h2>O que o Ward guarda</h2>
      <p>Só o necessário pra saber onde postar:</p>
      <ul>
        <li>o identificador do servidor do Discord onde o bot foi adicionado;</li>
        <li>o identificador do canal escolhido para cada aviso;</li>
        <li>se cada aviso está ligado ou desligado, e o horário diário escolhido;</li>
        <li>a data do último aviso enviado, pra não repetir no mesmo dia;</li>
        <li>a última versão de patch e quais notícias já foram anunciadas,
        para não repetir;</li>
        <li>quantas vezes cada comando foi usado em cada servidor — só o
        número total, sem registrar quem executou.</li>
      </ul>
    </div>

    <div class="cartao">
      <h2>O que o Ward não guarda</h2>
      <ul>
        <li>não lê nem armazena mensagens de ninguém;</li>
        <li>não guarda e-mail, telefone, endereço nem dados de pagamento;</li>
        <li>não guarda conta da Riot, nome de invocador nem histórico de
        partidas de ninguém (ver "Estatísticas de build" abaixo);</li>
        <li>não usa nada disso para publicidade e não vende dado nenhum.</li>
      </ul>
    </div>

    <div class="cartao">
      <h2>Login no painel</h2>
      <p>Ao entrar com o Discord, o Ward pede só duas permissões de leitura:
      seu nome de usuário e a lista de servidores em que você está. Essas
      informações ficam num cookie assinado no seu próprio navegador, válido
      por 7 dias, e servem apenas para mostrar quais servidores você
      administra. Elas não vão para o banco de dados. Sair da conta ou limpar
      os cookies apaga tudo isso.</p>
    </div>

    <div class="cartao">
      <h2>Estatísticas de build</h2>
      <p>As builds do comando <code>/build</code> vêm das estatísticas públicas
      agregadas do OP.GG (taxas de vitória e escolhas mais comuns por campeão).
      O Ward guarda só esse resultado agregado, por algumas horas, para responder
      mais rápido. Nenhum dado de jogador é consultado nem armazenado.</p>
    </div>

    <div class="cartao">
      <h2>Serviços usados</h2>
      <ul>
        <li><strong>Discord</strong>: para entrar no painel e enviar as mensagens;</li>
        <li><strong>Riot Games (Data Dragon)</strong>: versão do jogo, nomes e ícones;</li>
        <li><strong>OP.GG</strong>: estatísticas de build e skins em promoção na loja;</li>
        <li><strong>YouTube</strong>: vídeos novos do canal oficial do League of Legends;</li>
        <li><strong>leagueoflegends.com</strong>: resumo das notas do patch e as notícias oficiais em português;</li>
        <li><strong>Cloudflare</strong>: hospedagem, banco de dados e tradução do resumo do patch.</li>
      </ul>
    </div>

    <div class="cartao">
      <h2>Apagar os dados</h2>
      <p>Basta remover o Ward do servidor: a configuração daquele servidor
      deixa de ser usada. Para apagar o registro na hora, peça pelo canal de
      contato do servidor onde você usa o bot.</p>
    </div>

    <p class="aviso">${AVISO_RIOT}</p>
  `;
}

export function paginaTermos() {
  return `
    <a class="voltar" href="/">← início</a>
    <h1>Termos de uso</h1>
    <p class="aviso">Atualizados em 29 de outubro de 2026.</p>

    <div class="cartao">
      <h2>O que é</h2>
      <p>O Ward é um bot gratuito e sem fins lucrativos para servidores do
      Discord. Ele avisa quando sai um patch novo de League of Legends, posta
      as notícias oficiais e mostra a build mais vitoriosa de cada campeão.
      As builds são estatística de partidas reais e servem como sugestão, não
      como garantia de vitória.</p>
    </div>

    <div class="cartao">
      <h2>Como usar</h2>
      <p>Qualquer pessoa com permissão de gerenciar um servidor pode adicionar
      o Ward e escolher os canais. Quem adiciona é responsável por usá-lo
      dentro dos Termos de Serviço do Discord e das leis aplicáveis.</p>
    </div>

    <div class="cartao">
      <h2>Sem garantias</h2>
      <p>O serviço é oferecido "como está", sem garantia de funcionamento
      contínuo. Os dados vêm de serviços de terceiros (Discord e Riot Games) e
      podem falhar, atrasar ou mudar de formato sem aviso — quando isso
      acontece, o bot deixa de postar até que seja corrigido. O bot pode ficar
      indisponível ou ser desativado a qualquer momento.</p>
    </div>

    <div class="cartao">
      <h2>Conteúdo do jogo</h2>
      <p>Nomes, imagens e dados de League of Legends pertencem à Riot Games.
      O Ward apenas exibe informações públicas obtidas dos serviços oficiais
      da Riot, sem cobrar por elas.</p>
    </div>

    <p class="aviso">${AVISO_RIOT}</p>
  `;
}

// Painel privado de acompanhamento (rota /admin/uso). Mostra só dados de
// servidor e contagem de comandos — nada que identifique pessoas.
export function paginaUso(servidores, configs, uso, estadoGlobal = {}) {
  const configPorGuild = new Map(configs.map((c) => [c.guild_id, c]));

  // Saúde da fonte do /build. É o único estado que não pertence a um
  // servidor específico: se o OP.GG parar de responder, o /build de todo
  // mundo fica preso no cache — e isso tem que aparecer aqui, não só no log.
  const painelColeta = `<div class="cartao">
       <h2>Fonte do /build (OP.GG)</h2>
       ${
         estadoGlobal.opggErro
           ? `<p class="banner atencao">A última consulta ao OP.GG falhou</p>
              <p class="fraco">${escapar(quandoFalhou(estadoGlobal.opggErroEm) || "?")}: ${escapar(estadoGlobal.opggErro)}</p>`
           : `<p class="fraco">Respondendo normalmente.</p>`
       }
       <p class="fraco">${Number(estadoGlobal.buildsEmCache ?? 0)} builds em cache ·
       emojis de itens/runas: ${estadoGlobal.emojisCompletos ? "completos" : "subindo aos poucos"}.</p>
     </div>`;

  const usoPorGuild = new Map();
  for (const u of uso) {
    if (!usoPorGuild.has(u.guild_id)) usoPorGuild.set(u.guild_id, []);
    usoPorGuild.get(u.guild_id).push(u);
  }

  const membros = servidores.reduce((soma, g) => soma + (g.approximate_member_count ?? 0), 0);
  const ativos = servidores.filter((g) => {
    const c = configPorGuild.get(g.id);
    return c && (c.patch_enabled || c.news_enabled || c.sale_enabled || c.skins_enabled || c.youtube_enabled);
  }).length;
  const totalComandos = uso.reduce((soma, u) => soma + u.total, 0);
  const comFalha = servidores.filter((g) => falhasDe(configPorGuild.get(g.id)).length > 0).length;

  const tile = (valor, rotulo) => `<div class="tile"><strong>${valor}</strong><span>${rotulo}</span></div>`;

  const aviso = (ligado, canal, hora) => {
    const temHora = hora !== null && hora !== undefined;
    const relogio = temHora ? `${String(hora).padStart(2, "0")}:00` : "";
    // Mostra o horário guardado mesmo com o aviso desligado. Era isso que
    // escondia o bug do "Hora do Chá": o painel dizia só "desligado" enquanto
    // um horário diário continuava salvo na linha e disparando a postagem.
    if (!ligado) {
      return `<span class="tag">desligado</span>${temHora ? ` <span class="fraco">(${relogio} guardado, sem efeito)</span>` : ""}`;
    }
    if (!canal) return `<span class="tag atencao">ligado, sem canal</span>`;
    const quando = temHora ? `todo dia às ${relogio}` : "quando muda";
    return `<span class="tag ok">ligado</span> <span class="fraco">${quando}</span>`;
  };

  // "Avisar o dono": manda para o dono do servidor o que falta configurar.
  // Mostra a última vez que foi mandado, para não insistir à toa.
  const RESULTADOS_AVISO = {
    dm: "✓ Aviso enviado por mensagem privada ao dono.",
    canal: "✓ O dono não aceita mensagem privada — o aviso foi postado no canal de boas-vindas do servidor, marcando ele.",
    dm_fechada: "O dono não aceita mensagem privada e o servidor não tem canal de boas-vindas. Não deu para avisar.",
    erro: "Não consegui mandar o aviso agora — tenta de novo em instantes.",
  };
  const resultado = estadoGlobal.resultadoAviso ?? {};
  const blocoAvisarDono = (g, c) => {
    if (!estadoGlobal.podeAvisarDono) return "";
    const faltam = faltaConfigurar(c);
    const ultimo = estadoGlobal.avisosAoDono?.get(g.id);
    const banner =
      resultado.servidor === g.id && RESULTADOS_AVISO[resultado.tipo]
        ? `<p class="banner${["dm_fechada", "erro"].includes(resultado.tipo) ? " atencao" : ""}">${RESULTADOS_AVISO[resultado.tipo]}</p>`
        : "";
    // Aspas e barra saem do nome antes de ir para dentro do confirm() — senão
    // um servidor chamado "Bar do Zé's" quebraria o JavaScript do botão.
    const nomeSeguro = escapar(String(g.name).replace(/['"\\]/g, ""));
    return `
        ${banner}
        <form method="POST" action="/admin/avisar-dono/${g.id}"
              onsubmit="return confirm('Mandar para o dono de ${nomeSeguro} o que falta configurar?')">
          <button class="botao vazado discreto" type="submit">${
            faltam.length ? `Avisar o dono: falta${faltam.length === 1 ? "" : "m"} ${faltam.length}` : "Avisar o dono (tudo ligado)"
          }</button>
          <span class="fraco">${ultimo ? `último aviso ${escapar(quandoFalhou(ultimo))}` : "nunca avisado"}</span>
        </form>
        <form method="POST" action="/admin/sair/${g.id}"
              onsubmit="return confirm('Tirar o Ward do servidor ${nomeSeguro}? Para voltar, alguém de lá teria que adicionar de novo.')">
          <button class="botao vazado discreto" type="submit">Tirar o Ward deste servidor</button>
        </form>`;
  };

  const cartoes = servidores
    .map((g) => {
      const c = configPorGuild.get(g.id);
      // Comandos do Discord aparecem como /nome; ações feitas no painel vêm
      // gravadas com o prefixo "painel:" e são mostradas separadas.
      const eventos = usoPorGuild.get(g.id) ?? [];
      const formatar = (u) =>
        u.comando.startsWith("painel:")
          ? `<span class="tag">painel</span> ${escapar(u.comando.slice(7))} ${u.total}`
          : `<code>/${escapar(u.comando)}</code> ${u.total}`;
      const listaComandos = eventos.length
        ? eventos.map(formatar).join(" · ")
        : `<span class="fraco">nada usado ainda</span>`;

      // Só lista o que está falhando — servidor saudável não ganha linha.
      const falhas = falhasDe(c)
        .map(
          ([nome, erro, quando]) =>
            `<p class="banner atencao">${nome}: ${escapar(explicarFalha(erro))}${
              quandoFalhou(quando) ? ` <span class="fraco">(${quandoFalhou(quando)})</span>` : ""
            }</p>`
        )
        .join("");

      return `
      <div class="cartao" id="s${g.id}">
        <h2>${escapar(g.name)}</h2>
        <p class="fraco">${g.approximate_member_count ?? "?"} membros · id ${g.id}</p>
        ${falhas}
        <p>Patch: ${aviso(c?.patch_enabled, c?.patch_channel_id, null)}</p>
        <p>Notícias: ${aviso(c?.news_enabled, c?.news_channel_id, null)}</p>
        <p>Promoções: ${aviso(c?.sale_enabled, c?.sale_channel_id, null)}</p>
        <p>Skins novas: ${aviso(c?.skins_enabled, c?.skins_channel_id, null)}</p>
        <p>YouTube: ${aviso(c?.youtube_enabled, c?.youtube_channel_id, null)}</p>
        <p>${listaComandos}</p>
        ${blocoAvisarDono(g, c)}
      </div>`;
    })
    .join("");

  // Configurações de servidores de onde o bot já saiu: ajuda a perceber
  // desistências que não apareceriam na lista acima.
  const idsAtuais = new Set(servidores.map((g) => g.id));
  const saiu = configs.filter((c) => !idsAtuais.has(c.guild_id));
  const bloqueSaiu = saiu.length
    ? `<div class="cartao"><h2>Saíram do servidor</h2><p class="fraco">${saiu
        .map((c) => escapar(c.guild_id))
        .join(", ")}</p></div>`
    : "";

  return `
    <a class="voltar" href="/">← início</a>
    <h1>Uso do Ward</h1>
    ${
      resultado.tipo === "saiu"
        ? `<p class="banner">✓ O Ward saiu do servidor.</p>`
        : resultado.tipo === "erro_saida"
          ? `<p class="banner atencao">Não consegui tirar o Ward desse servidor agora — tenta de novo.</p>`
          : ""
    }
    <div class="tiles">
      ${tile(servidores.length, "servidores")}
      ${tile(ativos, "com aviso ligado")}
      ${tile(membros.toLocaleString("pt-BR"), "membros alcançados")}
      ${tile(totalComandos, "comandos usados")}
      ${tile(comFalha, "com falha no envio")}
    </div>
    ${painelColeta}
    ${cartoes}
    ${bloqueSaiu}
    <p class="aviso">Esta página conta uso por servidor. Ela não mostra (nem o
    bot guarda) quem executou cada comando.</p>
  `;
}

// Mostrada quando algo estoura de verdade. Sem isso, a Cloudflare entrega a
// tela branca "Error 1101", que não diz nada pra quem está usando.
export function paginaErro() {
  return `
    <div class="centro">
      <h1>Deu problema aqui do meu lado</h1>
      <div class="ornamento"><i></i></div>
      <p class="aviso">Alguma coisa quebrou ao montar essa página. Tenta de novo em instantes.</p>
      <p><a class="botao" href="/dashboard">Voltar pro painel</a></p>
    </div>
  `;
}

// Mostra as últimas notícias do site oficial e deixa postar uma na hora. O
// bot já posta sozinho quando sai notícia nova — isto é só pra ver o que está
// saindo e, se quiser, adiantar alguma.
function previaNoticias(servidor, noticias) {
  if (!noticias.length) {
    return `<p class="fraco">Não consegui carregar a prévia das notícias agora.</p>`;
  }

  const formatarData = (iso) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  // Da mais nova para a mais antiga, no máximo 5.
  const itens = noticias
    .slice()
    .reverse()
    .slice(0, 5)
    .map(
      (n) => `
      <label class="noticia">
        <input type="radio" name="noticia_url" value="${escapar(n.url)}">
        <span>
          <strong>${escapar(n.titulo)}</strong>
          <span class="fraco">${escapar(n.categoria)} · ${formatarData(n.data)}</span>
        </span>
      </label>`
    )
    .join("");

  return `
    <p class="fraco">Últimas notícias publicadas:</p>
    <div class="noticias">${itens}</div>
    <button class="botao vazado discreto" type="submit" formaction="/dashboard/${servidor.id}/postar-noticia">Postar notícia selecionada</button>
  `;
}

export function formularioConfig(servidor, config, canais, salvo, status, noticias = []) {
  const opcoesCanais = (selecionado) =>
    [`<option value="">— escolher canal —</option>`]
      .concat(
        canais.map(
          (c) =>
            `<option value="${c.id}"${c.id === selecionado ? " selected" : ""}>#${escapar(c.name)}</option>`
        )
      )
      .join("");

  const bannerSalvo = salvo ? `<p class="banner">✓ Salvo!</p>` : "";
  const bannerStatus =
    status && MENSAGENS_STATUS[status]
      ? `<p class="banner${STATUS_DE_ATENCAO.has(status) ? " atencao" : ""}">${MENSAGENS_STATUS[status]}</p>`
      : "";

  return `
    <a class="voltar" href="/dashboard">← voltar</a>
    <h1>${escapar(servidor.name)}</h1>
    ${bannerSalvo}${bannerStatus}
    <form method="POST">
      <div class="cartao">
        <h2>Aviso de patch novo</h2>
        ${avisoDeFalha(config.patch_last_error, config.patch_last_error_at)}
        <label class="interruptor">
          <input type="checkbox" name="patch_enabled" ${config.patch_enabled ? "checked" : ""}>
          Avisar quando sair patch novo
        </label>
        <label class="campo"><span>Canal</span><select name="patch_channel_id">${opcoesCanais(config.patch_channel_id)}</select></label>
        <p class="fraco">Avisa só quando sai patch novo (a cada duas semanas, mais ou menos).</p>
        <button class="botao vazado discreto" type="submit" formaction="/dashboard/${servidor.id}/postar-patch">Postar patch agora</button>
      </div>
      <div class="cartao">
        <h2>Notícias oficiais</h2>
        ${avisoDeFalha(config.news_last_error, config.news_last_error_at)}
        <label class="interruptor">
          <input type="checkbox" name="news_enabled" ${config.news_enabled ? "checked" : ""}>
          Postar as notícias do site oficial
        </label>
        <label class="campo"><span>Canal</span><select name="news_channel_id">${opcoesCanais(config.news_channel_id)}</select></label>
        <p class="fraco">CBLOL e outros esports, skins, atualizações do jogo e
        comunicados, em português.</p>
        ${previaNoticias(servidor, noticias)}
      </div>
      <div class="cartao">
        <h2>Skins em promoção</h2>
        ${avisoDeFalha(config.sale_last_error, config.sale_last_error_at)}
        <label class="interruptor">
          <input type="checkbox" name="sale_enabled" ${config.sale_enabled ? "checked" : ""}>
          Avisar quando entrar promoção nova na loja
        </label>
        <label class="campo"><span>Canal</span><select name="sale_channel_id">${opcoesCanais(config.sale_channel_id)}</select></label>
        <p class="fraco">A loja troca as skins em promoção uma vez por semana. O aviso traz cada
        skin com o preço cheio, o preço com desconto e até quando vale.</p>
        <button class="botao vazado discreto" type="submit" formaction="/dashboard/${servidor.id}/postar-promocoes">Postar promoções agora</button>
      </div>
      <div class="cartao">
        <h2>Skins novas</h2>
        ${avisoDeFalha(config.skins_last_error, config.skins_last_error_at)}
        <label class="interruptor">
          <input type="checkbox" name="skins_enabled" ${config.skins_enabled ? "checked" : ""}>
          Avisar quando chegarem skins novas ao jogo
        </label>
        <label class="campo"><span>Canal</span><select name="skins_channel_id">${opcoesCanais(config.skins_channel_id)}</select></label>
        <p class="fraco">Sai junto com o patch em que as skins entram no jogo, com a arte de cada uma.</p>
      </div>
      <div class="cartao">
        <h2>Vídeos do YouTube</h2>
        ${avisoDeFalha(config.youtube_last_error, config.youtube_last_error_at)}
        <label class="interruptor">
          <input type="checkbox" name="youtube_enabled" ${config.youtube_enabled ? "checked" : ""}>
          Avisar os vídeos novos do canal oficial do LoL
        </label>
        <label class="campo"><span>Canal</span><select name="youtube_channel_id">${opcoesCanais(config.youtube_channel_id)}</select></label>
        <p class="fraco">Trailers, cinemáticas, clipes e lançamentos do
        <a href="https://www.youtube.com/@leagueoflegends/videos" target="_blank" rel="noopener">canal oficial</a>,
        com o vídeo direto no Discord.</p>
        <button class="botao vazado discreto" type="submit" formaction="/dashboard/${servidor.id}/postar-youtube">Postar último vídeo agora</button>
      </div>
      <div class="cartao">
        <h2>Build do meta</h2>
        <p>Não precisa configurar: qualquer pessoa do servidor pode usar
        <code>/build</code> (ou <code>/build-aram</code>) em qualquer canal onde o Ward consiga responder.</p>
        <p class="fraco">Também dá para ver pelo site: <a href="/build">lista de builds</a>.</p>
      </div>
      <button class="botao" type="submit">Salvar</button>
    </form>
  `;
}

// Lista pública de campeões, cada um levando à sua build. O filtro é só no
// navegador: a lista inteira (uns 170) já vem na página.
export function paginaListaBuilds(campeoes, versao) {
  const ordenados = campeoes.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const itens = ordenados
    .map(
      (c) => `<a href="/build/${encodeURIComponent(c.arquivoImagem)}" data-nome="${escapar(c.nome.toLowerCase())}">
        <img src="${DDRAGON}/cdn/${escapar(versao)}/img/champion/${escapar(c.arquivoImagem)}.png" alt="" width="56" height="56" loading="lazy">
        ${escapar(c.nome)}</a>`
    )
    .join("");

  return `
    <a class="voltar" href="/">← início</a>
    <h1>Builds do meta</h1>
    <p class="aviso">A build que mais ganha de cada campeão, calculada sobre dezenas de milhares de
    partidas do patch atual (dados do OP.GG) e atualizada sozinha conforme o meta muda.
    No Discord é só usar <code>/build</code>.</p>
    <input class="busca" id="busca" type="search" placeholder="Buscar campeão..." aria-label="Buscar campeão" autocomplete="off">
    <div class="grade-campeoes" id="grade">${itens}</div>
    <script>
      document.getElementById("busca").addEventListener("input", function (e) {
        var alvo = e.target.value.trim().toLowerCase();
        document.querySelectorAll("#grade a").forEach(function (a) {
          a.style.display = a.dataset.nome.indexOf(alvo) >= 0 ? "" : "none";
        });
      });
    </script>
  `;
}

// A build de um campeão em página, com os ícones grandes. É para onde o
// título do embed do /build aponta.
export function paginaBuild({ campeao, build, dados, versao, modo }) {
  const img = (url, alt) =>
    `<img src="${escapar(url)}" alt="${escapar(alt)}" title="${escapar(alt)}" width="50" height="50" loading="lazy">`;
  const nomeItem = (id) => dados.itens[id]?.nome ?? `Item ${id}`;
  const item = (id, rodape = "") =>
    `<div class="item">${img(`${DDRAGON}/cdn/${versao}/img/item/${Number(id)}.png`, nomeItem(id))}<span>${escapar(
      nomeItem(id)
    )}${rodape}</span></div>`;
  const runa = (id, chave = false) => {
    const r = dados.runas[id];
    return `<div class="item runa${chave ? " chave" : ""}">${img(`${DDRAGON}/cdn/img/${r?.icone ?? ""}`, r?.nome ?? "")}<span>${escapar(
      r?.nome ?? ""
    )}</span></div>`;
  };
  const estat = (op) =>
    op ? `<p class="estat"><strong>${porcentagem(op.taxa)}</strong> de vitória em ${op.jogos.toLocaleString("pt-BR")} partidas</p>` : "";

  const linkPara = (m, rota) =>
    `/build/${encodeURIComponent(campeao.arquivoImagem)}?modo=${m}${rota ? `&rota=${rota}` : ""}`;
  const abaModo = (m, nome) => `<a href="${linkPara(m)}"><span class="tag${modo === m ? " ok" : ""}">${nome}</span></a>`;
  const totalRotas = (build?.rotas ?? []).reduce((s, r) => s + r.jogos, 0);
  const abasRota = (build?.rotas ?? [])
    .filter((r) => NOMES_ROTA[r.rota] && (r.jogos >= totalRotas * 0.05 || r.rota === build.rota))
    .map(
      (r) =>
        `<a href="${linkPara(modo, r.rota)}"><span class="tag${r.rota === build.rota ? " ok" : ""}">${escapar(
          NOMES_ROTA[r.rota]
        )}</span></a>`
    )
    .join("");

  const topo = `
    <a class="voltar" href="/build">← todas as builds</a>
    <div class="build-topo">
      <img src="${DDRAGON}/cdn/${escapar(versao)}/img/champion/${escapar(campeao.arquivoImagem)}.png" alt="" width="72" height="72">
      <div>
        <h1>${escapar(campeao.nome)}</h1>
        <p class="fraco">${
          build?.jogos
            ? `${porcentagem(build.taxa)} de vitória em ${build.jogos.toLocaleString("pt-BR")} partidas${
                build.tier ? ` · Tier ${escapar(build.tier)}` : ""
              } · dados OP.GG`
            : "Build do meta"
        }</p>
      </div>
    </div>
    <div class="abas">${abaModo("normal", "Partida normal")}${abaModo("aram", "ARAM")}</div>
    ${abasRota ? `<div class="abas">${abasRota}</div>` : ""}
  `;

  if (!build?.jogos) {
    return `${topo}
      <div class="cartao"><p>Não consegui a build de ${escapar(campeao.nome)} nesse modo agora — ou não há
      partidas suficientes, ou o OP.GG não respondeu. Tenta de novo em instantes.</p></div>`;
  }

  const contagem = new Map();
  for (const id of build.inicio?.ids ?? []) contagem.set(id, (contagem.get(id) ?? 0) + 1);
  const inicio = [...contagem.entries()].map(([id, n]) => item(id, n > 1 ? ` ×${n}` : "")).join("");

  const nucleo = build.nucleo
    ? build.nucleo.ids.map((id) => item(id)).join(`<span class="seta" aria-hidden="true">➜</span>`)
    : "";
  const extras = ["4º item", "5º item", "6º item"]
    .map((titulo, i) => {
      const lista = build.extras?.[i] ?? [];
      if (!lista.length) return "";
      return `<div class="cartao"><h2>${titulo}</h2><div class="linha-itens">${lista
        .map((o) => item(o.ids[0], `<br>${porcentagem(o.taxa)}`))
        .join("")}</div></div>`;
    })
    .join("");

  const r = build.runas;
  const runas = r
    ? `<p class="fraco">${escapar(dados.runas[r.primario]?.nome ?? "")}</p>
       <div class="linha-itens">${r.runasPrimarias.map((id, i) => runa(id, i === 0)).join("")}</div>
       <p class="fraco" style="margin-top:14px">${escapar(dados.runas[r.secundario]?.nome ?? "")}</p>
       <div class="linha-itens">${r.runasSecundarias.map((id) => runa(id)).join("")}</div>
       <p class="fraco" style="margin-top:14px">Fragmentos: ${r.fragmentos
         .map((id) => escapar(FRAGMENTOS[id] ?? id))
         .join(" · ")}</p>
       ${estat(r)}`
    : "";

  const feiticos = build.feiticos
    ? build.feiticos.ids
        .map((key) => {
          const f = dados.feiticos[key];
          return `<div class="item">${img(`${DDRAGON}/cdn/${versao}/img/spell/${f?.imagem ?? ""}`, f?.nome ?? "")}<span>${escapar(
            f?.nome ?? key
          )}</span></div>`;
        })
        .join("")
    : "";

  const h = build.habilidades;
  const habilidades = h
    ? `<p class="fraco">Maximizar</p>
       <div class="teclas">${h.ordem.split(">").map((t) => `<span class="tecla">${escapar(t)}</span>`).join("›")}</div>
       ${
         h.sequencia
           ? `<p class="fraco" style="margin-top:12px">Ordem dos níveis</p>
              <div class="teclas">${h.sequencia
                .split("")
                .map((t) => `<span class="tecla">${escapar(t)}</span>`)
                .join("")}</div>`
           : ""
       }
       ${estat(h)}`
    : "";

  const cartao = (titulo, corpo) => (corpo ? `<div class="cartao"><h2>${titulo}</h2>${corpo}</div>` : "");

  return `${topo}
    ${cartao("Build principal", nucleo ? `<div class="linha-itens">${nucleo}</div>${estat(build.nucleo)}` : "")}
    <div class="duas-colunas">
      ${cartao("Itens iniciais", inicio ? `<div class="linha-itens">${inicio}</div>${estat(build.inicio)}` : "")}
      ${cartao("Botas", build.botas ? `<div class="linha-itens">${build.botas.ids.map((id) => item(id)).join("")}</div>${estat(build.botas)}` : "")}
    </div>
    <div class="duas-colunas tres">${extras}</div>
    ${cartao("Runas", runas)}
    <div class="duas-colunas">
      ${cartao("Feitiços", feiticos ? `<div class="linha-itens">${feiticos}</div>${estat(build.feiticos)}` : "")}
      ${cartao("Habilidades", habilidades)}
    </div>
    <p class="aviso">Estatísticas do OP.GG sobre as partidas do patch atual, atualizadas a cada
    poucas horas. É sugestão, não garantia de vitória.</p>
    ${rodape()}
  `;
}

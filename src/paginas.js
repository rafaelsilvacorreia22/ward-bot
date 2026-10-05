// Templates HTML simples, sem framework e sem build — só strings com um
// escape básico pra evitar XSS a partir de nomes de servidor/canal.

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
// Elenco só da prévia visual da mensagem de rotação — não é a rotação real,
// que vem da API da Riot na hora de postar.
// Oito, não dez: é o que cabe numa linha só dentro da largura do embed.
const CAMPEOES_VITRINE = [
  "Ahri", "Jinx", "Darius", "Lux",
  "Yasuo", "Thresh", "Ekko", "Leona",
];

const ICONE_LUA = `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const ICONE_SOL = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>`;

// As duas fontes oficiais do League of Legends, servidas pela CDN da própria
// Riot (que manda CORS liberado). Se um dia essas URLs mudarem, o fallback
// abaixo de cada família segura a página sem quebrar nada.
const FONTE = "https://lolstatic-a.akamaihd.net/webfonts/live/fonts";
const FONTES = `
  @font-face { font-family: "Beaufort for LOL"; src: url("${FONTE}/beaufort/BeaufortforLOL-Regular.woff") format("woff"); font-weight: 400; font-display: swap; }
  @font-face { font-family: "Beaufort for LOL"; src: url("${FONTE}/beaufort/BeaufortforLOL-Bold.woff") format("woff"); font-weight: 700; font-display: swap; }
  @font-face { font-family: "Beaufort for LOL"; src: url("${FONTE}/beaufort/BeaufortforLOL-Heavy.woff") format("woff"); font-weight: 800; font-display: swap; }
  @font-face { font-family: "Spiegel"; src: url("${FONTE}/spiegel/Spiegel-Regular.woff") format("woff"); font-weight: 400; font-display: swap; }
  @font-face { font-family: "Spiegel"; src: url("${FONTE}/spiegel/Spiegel-SemiBold.woff") format("woff"); font-weight: 600; font-display: swap; }
`;

const ESTILO = `
  /* Paleta do cliente do League of Legends: azul quase preto, dourado
     Hextech como único destaque e o bege das notas de patch no texto.
     Nada de roxo/ciano genérico e nada de canto arredondado — o jogo é todo
     feito de linhas retas e chanfros. */
  :root {
    color-scheme: dark;
    --fundo: #010a13;
    --superficie: #0a1428;
    --superficie-2: #0f1c30;
    --linha: #3c3c41;
    --texto: #f0e6d2;
    --texto-fraco: #a09b8c;
    --ouro: #c8aa6e;
    --ouro-claro: #f0e6d2;
    --ouro-escuro: #785a28;
    --ouro-fundo: #463714;
    --btn-texto: #010a13;
    --grad-titulo: linear-gradient(180deg, #f0e6d2 0%, #c8aa6e 48%, #785a28 100%);
    /* Vermelho de "você morreu" do jogo, não o dourado: senão o banner de
       atenção fica idêntico ao de sucesso e ninguém percebe a diferença. */
    --alerta: #c6443e;
    --alerta-texto: #f0e6d2;
    --veu-topo: rgba(1, 10, 19, .9);
    /* Chanfro de canto: o corte diagonal que o jogo usa em botão, moldura e
       caixa de item. É o detalhe que mais entrega "isto é LoL". */
    --chanfro: polygon(13px 0, 100% 0, 100% calc(100% - 13px), calc(100% - 13px) 100%, 0 100%, 0 13px);
    --chanfro-p: polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px);
  }
  /* Tema claro em pergaminho, o papel das notas de patch — não um branco de
     painel. O bloco aparece duas vezes de propósito: uma para a escolha
     manual e outra para a preferência do sistema. */
  :root[data-tema="claro"] {
    color-scheme: light;
    --fundo: #e4ded0;
    --superficie: #f5f1e6;
    --superficie-2: #ece6d6;
    --linha: #c3b696;
    --texto: #10243b;
    --texto-fraco: #5b5a56;
    --ouro: #785a28;
    --ouro-claro: #463714;
    --ouro-escuro: #a08444;
    --ouro-fundo: #d8caa6;
    --btn-texto: #f5f1e6;
    --grad-titulo: linear-gradient(180deg, #785a28 0%, #463714 100%);
    --alerta: #a3302a;
    --alerta-texto: #f5f1e6;
    --veu-topo: rgba(228, 222, 208, .94);
  }
  @media (prefers-color-scheme: light) {
    :root:not([data-tema="escuro"]) {
      color-scheme: light;
      --fundo: #e4ded0;
      --superficie: #f5f1e6;
      --superficie-2: #ece6d6;
      --linha: #c3b696;
      --texto: #10243b;
      --texto-fraco: #5b5a56;
      --ouro: #785a28;
      --ouro-claro: #463714;
      --ouro-escuro: #a08444;
      --ouro-fundo: #d8caa6;
      --btn-texto: #f5f1e6;
      --grad-titulo: linear-gradient(180deg, #785a28 0%, #463714 100%);
      --alerta: #a3302a;
      --alerta-texto: #f5f1e6;
      --veu-topo: rgba(228, 222, 208, .94);
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
  /* Trama fina de linhas douradas no fundo de tudo: o mesmo fundo quadriculado
     das telas de carregamento. Fica quase invisível, só tira o "chapado". */
  body::before {
    content: ""; position: fixed; inset: 0; z-index: -2; pointer-events: none;
    background-image:
      linear-gradient(rgba(200, 170, 110, .045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(200, 170, 110, .045) 1px, transparent 1px);
    background-size: 72px 72px;
  }

  h1, h2, h3, .fonte-jogo {
    font-family: "Beaufort for LOL", "Trajan Pro", Georgia, serif;
    font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
  }
  h1 { font-size: clamp(1.7rem, 4.4vw, 2.5rem); line-height: 1.12; margin: 0 0 16px; }
  h2 { font-size: 1.02rem; letter-spacing: .09em; margin: 0 0 12px; color: var(--ouro); }
  p { margin: 0 0 12px; }
  a { color: var(--ouro); text-decoration-color: var(--ouro-escuro); text-underline-offset: 3px; }
  a:hover { color: var(--ouro-claro); }
  code {
    font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
    background: var(--superficie-2); border: 1px solid var(--linha);
    padding: 1px 6px; font-size: .86em; color: var(--ouro);
  }

  /* ---------- barra de topo ---------- */
  .topo {
    position: fixed; inset: 0 0 auto; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; height: 58px; padding: 0 clamp(14px, 4vw, 34px);
    /* Sem backdrop-filter: na inicial a barra fica por cima do vídeo, e
       desfocar o fundo a cada frame custa o mesmo que o filter do vídeo.
       Um fundo mais opaco resolve igual e não custa nada. */
    background: var(--veu-topo);
    border-bottom: 1px solid color-mix(in srgb, var(--ouro) 28%, transparent);
  }
  .marca {
    display: flex; align-items: center; gap: 11px;
    color: var(--texto); text-decoration: none;
    font-family: "Beaufort for LOL", Georgia, serif;
    font-weight: 800; font-size: .95rem;
    text-transform: uppercase; letter-spacing: .26em;
  }
  .marca img { width: 27px; height: 27px; }
  .topo-dir { display: flex; align-items: center; gap: 8px; }
  .topo-link {
    font-family: "Beaufort for LOL", Georgia, serif; font-weight: 700;
    font-size: .74rem; text-transform: uppercase; letter-spacing: .16em;
    color: var(--texto-fraco); text-decoration: none; padding: 8px 10px;
  }
  .topo-link:hover { color: var(--ouro); }
  .tema {
    display: grid; place-items: center; width: 34px; height: 34px;
    border: 1px solid color-mix(in srgb, var(--ouro) 45%, transparent);
    background: transparent; color: var(--texto-fraco); cursor: pointer;
    clip-path: var(--chanfro-p); transition: color .15s, border-color .15s;
  }
  .tema:hover { color: var(--ouro); border-color: var(--ouro); }
  .tema .sol { display: none; }
  :root[data-tema="claro"] .tema .sol { display: block; }
  :root[data-tema="claro"] .tema .lua { display: none; }
  @media (prefers-color-scheme: light) {
    :root:not([data-tema="escuro"]) .tema .sol { display: block; }
    :root:not([data-tema="escuro"]) .tema .lua { display: none; }
  }

  /* ---------- botões ---------- */
  /* Retângulo chanfrado, texto em versalete espaçado: o botão "JOGUE DE GRAÇA"
     do site oficial. O isolation + z-index:-1 deixa o ::before pintar o miolo
     da variante vazada sem precisar embrulhar o texto num <span>. */
  .botao {
    position: relative; isolation: isolate;
    display: inline-flex; align-items: center; justify-content: center;
    padding: 13px 30px; margin: 5px 6px 5px 0;
    border: 0; cursor: pointer; text-decoration: none;
    clip-path: var(--chanfro);
    background: linear-gradient(180deg, var(--ouro-claro) 0%, var(--ouro) 38%, var(--ouro-escuro) 100%);
    color: var(--btn-texto);
    font-family: "Beaufort for LOL", Georgia, serif;
    font-size: .78rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: .18em;
    transition: filter .15s ease, transform .15s ease;
  }
  .botao:hover { filter: brightness(1.14); color: var(--btn-texto); }
  .botao:active { transform: translateY(1px); }
  .botao:focus-visible { outline: 2px solid var(--ouro-claro); outline-offset: 3px; }
  /* Vazado: moldura dourada de 1px com o fundo da página dentro. */
  .botao.vazado { background: var(--ouro-escuro); color: var(--ouro); }
  .botao.vazado::before {
    content: ""; position: absolute; inset: 1px; z-index: -1;
    background: var(--superficie); clip-path: var(--chanfro);
    transition: background .15s ease;
  }
  .botao.vazado:hover { filter: none; color: var(--ouro-claro); background: var(--ouro); }
  .botao.vazado:hover::before { background: color-mix(in srgb, var(--ouro) 12%, var(--superficie)); }
  .botao.discreto { padding: 10px 20px; font-size: .72rem; }

  /* ---------- hero com o vídeo ---------- */
  .heroi {
    position: relative; min-height: 100svh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 90px clamp(18px, 5vw, 40px) 110px;
    /* O hero é sempre escuro, nos dois temas: o vídeo pede texto claro. */
    color: #f0e6d2;
  }
  .heroi-midia { position: absolute; inset: 0; overflow: hidden; background: #010a13; }
  .heroi-midia video, .heroi-poster {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; display: block;
    /* Sem filter nenhum aqui de propósito. O desfoque, a saturação e o
       contraste já estão assados no arquivo pelo ffmpeg. Um filter de CSS
       sobre vídeo em tela cheia é recalculado a cada frame e derrubava a
       reprodução para ~20fps; assado, o vídeo vira uma camada que a GPU só
       compõe, e roda nos 60fps do arquivo. */
  }
  /* Véu em três camadas: o miolo escuro dá contraste ao texto, a vinheta é
     fraca de propósito — é nas laterais que os painéis aparecem — e a última
     funde a borda de baixo no fundo da próxima seção. */
  .heroi-veu {
    position: absolute; inset: 0;
    background:
      radial-gradient(54% 46% at 50% 46%, rgba(1, 10, 19, .84) 0%, rgba(1, 10, 19, .5) 60%, transparent 100%),
      radial-gradient(130% 95% at 50% 40%, transparent 45%, rgba(1, 10, 19, .5) 85%, rgba(1, 10, 19, .78) 100%),
      linear-gradient(180deg, rgba(1, 10, 19, .88) 0%, rgba(1, 10, 19, .34) 24%, rgba(1, 10, 19, .5) 64%, var(--fundo) 100%);
  }
  /* Camada de painéis: recortes de verdade do bot postando no Discord e das
     publicações do site oficial, flutuando atrás do título. Ficam entre o
     vídeo e o véu, então escurecem junto com o fundo.
     Por que aqui e não gravados dentro do vídeo: com object-fit:cover o vídeo
     é cortado nas laterais em janela estreita e em cima/embaixo em janela
     larga, e qualquer coisa fixada perto da borda some. Em % do hero eles
     nunca cortam, não pegam o desfoque do vídeo e dá para trocar um print
     sem reencodar nada. */
  .heroi-paineis { position: absolute; inset: 0; pointer-events: none; }
  .painel {
    position: absolute; margin: 0; opacity: 0;
    border: 1px solid rgba(200, 170, 110, .5);
    box-shadow: 0 18px 46px rgba(1, 10, 19, .8);
    animation: painel-passa 20s ease-in-out infinite both;
    /* Avisa o navegador para dar camada própria a cada painel: sem isso ele
       pode rerrasterizar a sombra grande a cada quadro da animação, em cima
       do vídeo. */
    will-change: opacity, transform;
  }
  .painel img { display: block; width: 100%; height: auto; }
  .painel.a { left: 3.5%;  top: 17%;    width: min(330px, 25vw); }
  .painel.b { right: 3.5%; top: 14%;    width: min(400px, 29vw); animation-delay: 3s; }
  .painel.c { left: 3.5%;  bottom: 17%; width: min(330px, 25vw); animation-delay: 9s; }
  .painel.d { right: 5%;   bottom: 11%; width: min(205px, 16vw); animation-delay: 13s; }
  /* Aparece, fica ~4,5s e some — os quatro em revezamento num ciclo de 20s. */
  @keyframes painel-passa {
    0%        { opacity: 0; transform: translateY(16px); }
    5%, 23%   { opacity: .96; transform: translateY(0); }
    29%, 100% { opacity: 0; transform: translateY(-12px); }
  }
  /* Abaixo disso o hero fica estreito e os painéis encostariam no título. */
  @media (max-width: 1100px) { .heroi-paineis { display: none; } }

  .heroi-dentro {
    position: relative; max-width: 740px;
    filter: drop-shadow(0 2px 16px rgba(1, 10, 19, .95));
  }
  .sobrancelha {
    font-family: "Beaufort for LOL", Georgia, serif; font-weight: 700;
    font-size: .72rem; text-transform: uppercase; letter-spacing: .34em;
    color: #c8aa6e; margin: 0 0 18px;
  }
  .heroi h1 {
    font-size: clamp(2.1rem, 6.6vw, 4.1rem); font-weight: 800;
    letter-spacing: .02em; line-height: 1.04; margin: 0 0 20px;
    background: linear-gradient(180deg, #f0e6d2 0%, #c8aa6e 52%, #91713a 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .heroi .subtitulo { color: #c4c2bb; max-width: 520px; margin: 0 auto 30px; font-size: 1.02rem; }
  .heroi .acoes { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }

  /* Filete com o losango no meio: o separador padrão do cliente. */
  .ornamento { display: flex; align-items: center; justify-content: center; gap: 13px; margin: 0 0 22px; }
  .ornamento::before, .ornamento::after {
    content: ""; height: 1px; width: clamp(50px, 14vw, 130px);
    background: linear-gradient(90deg, transparent, var(--ouro));
  }
  .ornamento::after { background: linear-gradient(90deg, var(--ouro), transparent); }
  .ornamento i { width: 7px; height: 7px; rotate: 45deg; background: var(--ouro); }
  .heroi .ornamento::before { background: linear-gradient(90deg, transparent, #c8aa6e); }
  .heroi .ornamento::after { background: linear-gradient(90deg, #c8aa6e, transparent); }
  .heroi .ornamento i { background: #c8aa6e; }

  .descer {
    position: absolute; bottom: 30px; left: 50%; translate: -50% 0;
    width: 15px; height: 15px; border: solid #c8aa6e; border-width: 0 1.5px 1.5px 0;
    rotate: 45deg; opacity: .75; animation: pulsar 2.1s ease-in-out infinite;
  }
  @keyframes pulsar { 0%, 100% { translate: -50% 0; opacity: .3; } 50% { translate: -50% 7px; opacity: .9; } }

  /* ---------- blocos de conteúdo ---------- */
  .faixa { padding: clamp(56px, 9vw, 96px) clamp(18px, 5vw, 40px); }
  .faixa.escura { background: var(--superficie); border-block: 1px solid color-mix(in srgb, var(--ouro) 18%, transparent); }
  .limite { max-width: 1040px; margin: 0 auto; }
  .titulo-secao { text-align: center; margin-bottom: 40px; }
  .titulo-secao h2 { font-size: clamp(1.3rem, 3.2vw, 1.9rem); letter-spacing: .06em; color: var(--texto); margin-bottom: 14px; }
  .titulo-secao .ornamento { margin-bottom: 0; }

  .grade { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(255px, 1fr)); }

  /* Painel chanfrado com moldura dourada fina — a moldura do inventário. */
  .cartao {
    position: relative; isolation: isolate;
    background: var(--ouro-escuro); clip-path: var(--chanfro);
    /* O respiro é padding do próprio cartão, não margem dos filhos: qualquer
       filho que declare "margin: 0 0 Npx" (o atalho zera a margem lateral)
       vazaria por cima da moldura. Foi o que acontecia com o losango do
       interruptor e com a linha do seletor de canal. */
    padding: 25px; transition: background .18s ease;
  }
  .cartao::before {
    content: ""; position: absolute; inset: 1px; z-index: -1;
    background: var(--superficie-2); clip-path: var(--chanfro);
  }
  .cartao:hover { background: var(--ouro); }
  .cartao > :first-child { margin-top: 0; }
  .cartao > :last-child { margin-bottom: 0; }
  .numero {
    font-family: "Beaufort for LOL", Georgia, serif; font-weight: 800;
    font-size: 1.5rem; color: var(--ouro-escuro); letter-spacing: .06em;
    margin-bottom: 4px; display: block;
  }
  .cartao p { color: var(--texto-fraco); margin-bottom: 0; }

  /* ---------- prévia da mensagem no Discord ---------- */
  /* Cores do próprio Discord de propósito: é um retrato do que chega lá,
     então imitar o painel dourado do LoL aqui mentiria sobre o resultado. */
  .previa { max-width: 620px; margin: 0 auto; border: 1px solid var(--linha); background: #313338; text-align: left; }
  .previa-barra {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 16px; border-bottom: 1px solid #26282c;
    color: #b5bac1; font-size: .85rem; font-weight: 600;
  }
  .previa-barra svg { flex: none; }
  .previa-msg { display: flex; gap: 14px; padding: 16px; }
  .previa-avatar { width: 38px; height: 38px; border-radius: 50%; flex: none; background: #1e1f22; }
  .previa-nome { color: #f2f3f5; font-weight: 600; font-size: .92rem; margin: 0 0 6px; }
  .previa-tag { background: #5865f2; color: #fff; font-size: .62rem; font-weight: 700; padding: 1px 5px; border-radius: 3px; margin-left: 5px; vertical-align: 2px; letter-spacing: .02em; }
  .previa-hora { color: #949ba4; font-size: .72rem; font-weight: 400; margin-left: 7px; }
  .previa-embed { border-left: 4px solid #c8aa6e; background: #2b2d31; padding: 13px 16px; max-width: 460px; }
  .previa-embed strong { display: block; color: #f2f3f5; font-size: .94rem; margin-bottom: 9px; }
  .previa-campeoes { display: flex; flex-wrap: wrap; gap: 5px; }
  .previa-campeoes img { width: 38px; height: 38px; border: 1px solid #c8aa6e; background: #1e1f22; }
  .previa-rodape { color: #949ba4; font-size: .75rem; margin: 10px 0 0; }

  /* ---------- lista de comandos ---------- */
  .comandos { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
  .comando { display: flex; align-items: baseline; gap: 11px; padding: 14px 18px; background: var(--superficie-2); border-left: 2px solid var(--ouro-escuro); }
  .comando code { background: none; border: 0; padding: 0; font-size: .95rem; font-weight: 600; }
  .comando span { color: var(--texto-fraco); font-size: .88rem; }

  /* ---------- páginas internas ---------- */
  main.conteudo { max-width: 700px; margin: 0 auto; padding: 96px 20px 70px; }
  main.cheio { padding: 0; }
  .centro { text-align: center; }
  .voltar {
    display: inline-block; font-family: "Beaufort for LOL", Georgia, serif;
    font-size: .74rem; text-transform: uppercase; letter-spacing: .16em;
    text-decoration: none; margin-bottom: 18px;
  }
  main.conteudo .cartao { margin: 16px 0; }
  main.conteudo .cartao:hover { background: var(--ouro-escuro); }

  /* ---------- formulário ---------- */
  /* O gap é maior que o normal porque o quadrado girado em losango ocupa a
     diagonal (~24px), não os 17px do lado. */
  .interruptor { display: flex; align-items: center; gap: 14px; font-size: .94rem; font-weight: 600; margin: 0 0 18px; cursor: pointer; }
  .campo { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 12px; }
  .campo > span {
    color: var(--texto-fraco); min-width: 140px;
    font-family: "Beaufort for LOL", Georgia, serif; font-size: .74rem;
    text-transform: uppercase; letter-spacing: .13em;
  }
  .campo select { flex: 1; min-width: 200px; }

  /* appearance:none tira o botão de seta que o sistema desenha (no Windows ele
     aparece como uma caixa cinza que destoa do resto); a seta abaixo é nossa. */
  select {
    appearance: none; -webkit-appearance: none; -moz-appearance: none;
    font: inherit; font-size: .9rem; color: var(--texto); cursor: pointer;
    padding: 10px 36px 10px 13px;
    border: 1px solid var(--linha); border-radius: 0;
    background-color: var(--fundo);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23c8aa6e' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 13px center; background-size: 13px;
    transition: border-color .15s ease;
  }
  select:hover { border-color: var(--ouro); }
  select:focus-visible { outline: 2px solid var(--ouro); outline-offset: 2px; border-color: var(--ouro); }
  option { background: var(--superficie); color: var(--texto); }

  input[type="checkbox"] {
    appearance: none; -webkit-appearance: none;
    /* A margem esquerda compensa a sobra da diagonal: girado 45°, o losango
       desenha 3,5px para fora da caixa de 17px de cada lado, e sem isso ele
       encostava na moldura do cartão. */
    width: 17px; height: 17px; flex: none; margin: 0 0 0 4px; cursor: pointer;
    border: 1px solid var(--linha); border-radius: 0; rotate: 45deg;
    background: var(--fundo); transition: background-color .15s ease, border-color .15s ease;
  }
  input[type="checkbox"]:hover { border-color: var(--ouro); }
  input[type="checkbox"]:checked { background-color: var(--ouro); border-color: var(--ouro-claro); }
  input[type="checkbox"]:focus-visible { outline: 2px solid var(--ouro); outline-offset: 3px; }

  .aviso, .fraco { color: var(--texto-fraco); font-size: .88rem; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 12px; margin: 18px 0; }
  .tile { background: var(--superficie-2); border: 1px solid var(--linha); padding: 16px; text-align: center; clip-path: var(--chanfro-p); }
  .tile strong { display: block; font-family: "Beaufort for LOL", Georgia, serif; font-size: 1.7rem; line-height: 1.2; color: var(--ouro); }
  .tile span {
    color: var(--texto-fraco); font-size: .7rem;
    text-transform: uppercase; letter-spacing: .13em;
  }
  .tag {
    display: inline-block; padding: 2px 10px; font-size: .68rem;
    text-transform: uppercase; letter-spacing: .12em;
    border: 1px solid var(--linha); color: var(--texto-fraco);
  }
  .tag.ok { border-color: var(--ouro); color: var(--ouro); }
  .tag.atencao { border-color: var(--alerta); color: var(--alerta); }
  .noticias { display: flex; flex-direction: column; gap: 7px; margin: 12px 0 16px; }
  .noticia {
    display: flex; align-items: flex-start; gap: 11px; margin: 0; cursor: pointer;
    padding: 11px 14px; border: 1px solid var(--linha);
    background: var(--fundo); font-weight: 400;
  }
  .noticia:hover { border-color: var(--ouro); }
  .noticia > span { display: flex; flex-direction: column; gap: 2px; }
  .noticia strong { font-size: .92rem; font-weight: 600; }
  .noticia input[type="radio"] { flex: none; margin-top: 4px; accent-color: var(--ouro); width: 15px; height: 15px; }
  .banner {
    display: inline-block; padding: 12px 20px;
    font-family: "Beaufort for LOL", Georgia, serif; font-weight: 700;
    text-transform: uppercase; letter-spacing: .12em; font-size: .8rem;
    background: var(--ouro); color: var(--btn-texto); clip-path: var(--chanfro-p);
  }
  .banner.atencao { background: var(--alerta); color: var(--alerta-texto); }

  .rodape {
    text-align: center; color: var(--texto-fraco); font-size: .82rem;
    padding: 36px clamp(18px, 5vw, 40px) 44px;
    border-top: 1px solid color-mix(in srgb, var(--ouro) 18%, transparent);
  }
  .rodape .legal { max-width: 620px; margin: 16px auto 0; font-size: .74rem; opacity: .75; line-height: 1.55; }
  ul { padding-left: 20px; }
  li { margin-bottom: 7px; }

  /* Transição entre páginas. O navegador faz o cross-fade sozinho a partir
     desta regra; o cabeçalho ganha nome próprio para ficar parado enquanto o
     conteúdo troca. */
  @view-transition { navigation: auto; }
  .topo { view-transition-name: topo; }
  @keyframes entrar-conteudo { from { opacity: 0; transform: translateY(10px); } }
  @keyframes sair-conteudo { to { opacity: 0; transform: translateY(-6px); } }
  ::view-transition-old(root) { animation: sair-conteudo .2s ease both; }
  ::view-transition-new(root) { animation: entrar-conteudo .28s ease both; }
  @supports not (view-transition-name: none) {
    main { animation: entrar-conteudo .28s ease both; }
  }
  @media (prefers-reduced-motion: reduce) {
    .botao, .cartao, select, input { transition: none; }
    main, .descer, ::view-transition-old(root), ::view-transition-new(root) { animation: none; }
    /* Sem revezamento: ficam dois painéis parados, sem piscar nada. */
    .painel { animation: none; }
    .painel.a, .painel.b { opacity: .9; }
  }

  @media (max-width: 620px) {
    /* As quebras de linha do título são desenho para tela larga; no celular
       elas sobrariam numa quarta linha torta, então o texto quebra sozinho. */
    br.so-largo { display: none; }
    .heroi h1 { text-wrap: balance; }
    .cartao { padding: 19px; }
    .previa-msg { padding: 13px; }
    .marca { font-size: .85rem; letter-spacing: .18em; }
  }
`;

function layout(titulo, corpo, opcoes = {}) {
  const classeMain = opcoes.cheio ? "cheio" : "conteudo";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.webp" type="image/webp">
<link rel="preconnect" href="https://lolstatic-a.akamaihd.net" crossorigin>
<title>${escapar(titulo)}</title>
<style>${FONTES}${ESTILO}</style>
<script>
  // Antes de pintar a tela, senão o tema claro pisca escuro ao carregar.
  try { var t = localStorage.getItem("tema"); if (t) document.documentElement.dataset.tema = t; } catch (e) {}
</script>
</head>
<body>
<header class="topo">
  <a class="marca" href="/"><img src="/favicon.webp" alt=""> Ward</a>
  <div class="topo-dir">
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

  // O vídeo de fundo só ganha fonte aqui, nunca no HTML: assim o celular, a
  // conexão em modo economia e quem pediu menos animação no sistema ficam só
  // com o poster (um JPEG de 70 kB) em vez de baixar alguns megabytes.
  (function () {
    var v = document.getElementById("video-fundo");
    if (!v) return;
    var rede = navigator.connection || {};
    if (
      window.matchMedia("(max-width: 820px)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      rede.saveData === true ||
      /(^|-)2g$/.test(rede.effectiveType || "")
    ) return;
    var s = document.createElement("source");
    s.src = "/hero.mp4"; s.type = "video/mp4";
    v.appendChild(s);
    v.load();

    // O autoplay é recusado quando a aba abre em segundo plano, e aí fica só
    // o poster parado. Tenta de novo quando o vídeo fica pronto e quando a
    // aba volta a aparecer.
    function tocar() {
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    tocar();
    v.addEventListener("canplay", tocar);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && v.paused) tocar();
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

const RODAPE_LEGAL = `Ward isn't endorsed by Riot Games and doesn't reflect the
views or opinions of Riot Games or anyone officially involved in producing or
managing Riot Games properties. Riot Games and all associated properties are
trademarks or registered trademarks of Riot Games, Inc.`;

function rodape() {
  return `
    <footer class="rodape">
      <a href="/privacidade">Política de privacidade</a> · <a href="/termos">Termos de uso</a>
      <p class="legal">${RODAPE_LEGAL}</p>
    </footer>
  `;
}

export function landing(clientId) {
  const campeoes = CAMPEOES_VITRINE.map(
    (nome) =>
      `<img src="https://ddragon.leagueoflegends.com/cdn/${VERSAO_ARTE}/img/champion/${nome}.png" alt="" width="38" height="38" loading="lazy">`
  ).join("");

  return `
    <section class="heroi">
      <div class="heroi-midia">
        <video id="video-fundo" class="heroi-video" poster="/hero.jpg"
               autoplay muted loop playsinline preload="none"
               disablepictureinpicture aria-hidden="true" tabindex="-1"></video>
        <div class="heroi-paineis" aria-hidden="true">
          <figure class="painel a"><img src="/p-patch.webp" alt="" width="591" height="128"></figure>
          <figure class="painel b"><img src="/p-site.webp" alt="" width="900" height="278"></figure>
          <figure class="painel c"><img src="/p-rotacao.webp" alt="" width="664" height="72"></figure>
          <figure class="painel d"><img src="/p-noticia.webp" alt="" width="505" height="391"></figure>
        </div>
        <div class="heroi-veu"></div>
      </div>
      <div class="heroi-dentro">
        <p class="sobrancelha">Bot de Discord · League of Legends</p>
        <h1>Seu servidor<br class="so-largo">nunca mais perde<br class="so-largo">o patch novo</h1>
        <div class="ornamento"><i></i></div>
        <p class="subtitulo">O Ward vigia as publicações da Riot e avisa no canal que
        você escolher: patch novo, notícias oficiais e a rotação grátis da semana.</p>
        <div class="acoes">
          <a class="botao" href="${convite(clientId)}">Adicionar ao Discord</a>
          <a class="botao vazado" href="#funcoes">Ver o que ele faz</a>
        </div>
      </div>
      <a class="descer" href="#funcoes" aria-label="Ver o que o bot faz"></a>
    </section>

    <section class="faixa" id="funcoes">
      <div class="limite">
        <div class="titulo-secao">
          <h2>Três avisos, zero esforço</h2>
          <div class="ornamento"><i></i></div>
        </div>
        <div class="grade">
          <article class="cartao">
            <span class="numero">01</span>
            <h3>Patch novo</h3>
            <p>Assim que a Riot publica um patch, o Ward posta a versão e o resumo
            oficial das novidades traduzido para português, com link para as notas
            completas.</p>
          </article>
          <article class="cartao">
            <span class="numero">02</span>
            <h3>Notícias oficiais</h3>
            <p>CBLOL e outros esports, skins, atualizações do jogo e comunicados —
            direto do site oficial em português, sem passar por tradução de máquina.</p>
          </article>
          <article class="cartao">
            <span class="numero">03</span>
            <h3>Rotação semanal</h3>
            <p>A lista de campeões grátis da semana numa mensagem enxuta, com o
            ícone de cada campeão. Na hora que muda ou num horário fixo do dia.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="faixa escura">
      <div class="limite">
        <div class="titulo-secao">
          <h2>É isso que chega no canal</h2>
          <div class="ornamento"><i></i></div>
        </div>
        <div class="previa">
          <div class="previa-barra">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>
            avisos-lol
          </div>
          <div class="previa-msg">
            <img class="previa-avatar" src="/favicon.webp" alt="" width="38" height="38">
            <div>
              <p class="previa-nome">Ward <span class="previa-tag">BOT</span><span class="previa-hora">hoje às 09:00</span></p>
              <div class="previa-embed">
                <strong>Rotação grátis desta semana</strong>
                <div class="previa-campeoes">${campeoes}</div>
                <p class="previa-rodape">Disponíveis para todo mundo até a próxima terça.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="faixa">
      <div class="limite">
        <div class="titulo-secao">
          <h2>Comandos</h2>
          <div class="ornamento"><i></i></div>
        </div>
        <div class="comandos">
          <div class="comando"><code>/patch</code><span>o patch atual</span></div>
          <div class="comando"><code>/rotacao</code><span>os campeões grátis</span></div>
          <div class="comando"><code>/dashboard</code><span>o link de configuração</span></div>
        </div>
      </div>
    </section>

    <section class="faixa escura">
      <div class="limite centro">
        <h2>Configuração sem código</h2>
        <p class="aviso" style="max-width:520px;margin:0 auto 26px">Adicione o bot,
        entre no painel com sua conta do Discord e escolha o canal de cada aviso.
        Dá para postar na hora ou marcar um horário fixo diário.</p>
        <div class="acoes centro">
          <a class="botao" href="${convite(clientId)}">Adicionar ao Discord</a>
          <a class="botao vazado" href="/dashboard">Abrir o painel</a>
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
  rotacao: "✓ Rotação postada no canal!",
  sem_canal: "Escolhe um canal antes de postar.",
  erro: "Não consegui postar agora — tenta de novo em instantes.",
  noticia: "✓ Notícia postada no canal!",
  sem_noticia: "Escolhe uma notícia da lista antes de postar.",
  chave_riot: "A Riot recusou a chave do bot, então a rotação está indisponível. Quem cuida do Ward precisa dar uma olhada.",
  sem_permissao: "Não consegui escrever nesse canal — confere se o Ward tem permissão de ver o canal e enviar mensagens nele.",
};

const STATUS_DE_ATENCAO = new Set([
  "sem_canal",
  "sem_noticia",
  "erro",
  "chave_riot",
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
    <p class="aviso">Atualizada em 30 de setembro de 2026.</p>

    <div class="cartao">
      <h2>O que o Ward guarda</h2>
      <p>Só o necessário pra saber onde postar:</p>
      <ul>
        <li>o identificador do servidor do Discord onde o bot foi adicionado;</li>
        <li>o identificador do canal escolhido para cada aviso;</li>
        <li>se cada aviso está ligado ou desligado, e o horário diário escolhido;</li>
        <li>a data do último aviso enviado, pra não repetir no mesmo dia;</li>
        <li>a última versão de patch, a última rotação e quais notícias já
        foram anunciadas, para não repetir;</li>
        <li>quantas vezes cada comando foi usado em cada servidor — só o
        número total, sem registrar quem executou.</li>
      </ul>
    </div>

    <div class="cartao">
      <h2>O que o Ward não guarda</h2>
      <ul>
        <li>não lê nem armazena mensagens de ninguém;</li>
        <li>não guarda e-mail, telefone, endereço nem dados de pagamento;</li>
        <li>não guarda conta da Riot, nome de invocador nem histórico de partidas;</li>
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
      <h2>Serviços usados</h2>
      <ul>
        <li><strong>Discord</strong>: para entrar no painel e enviar as mensagens;</li>
        <li><strong>Riot Games (Data Dragon e API)</strong>: versão do jogo e rotação de campeões grátis;</li>
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
    <p class="aviso">Atualizados em 30 de setembro de 2026.</p>

    <div class="cartao">
      <h2>O que é</h2>
      <p>O Ward é um bot gratuito e sem fins lucrativos para servidores do
      Discord. Ele avisa quando sai um patch novo de League of Legends e
      mostra a rotação semanal de campeões grátis.</p>
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
export function paginaUso(servidores, configs, uso) {
  const configPorGuild = new Map(configs.map((c) => [c.guild_id, c]));

  const usoPorGuild = new Map();
  for (const u of uso) {
    if (!usoPorGuild.has(u.guild_id)) usoPorGuild.set(u.guild_id, []);
    usoPorGuild.get(u.guild_id).push(u);
  }

  const membros = servidores.reduce((soma, g) => soma + (g.approximate_member_count ?? 0), 0);
  const ativos = servidores.filter((g) => {
    const c = configPorGuild.get(g.id);
    return c && (c.patch_enabled || c.rotation_enabled);
  }).length;
  const totalComandos = uso.reduce((soma, u) => soma + u.total, 0);

  const tile = (valor, rotulo) => `<div class="tile"><strong>${valor}</strong><span>${rotulo}</span></div>`;

  const aviso = (ligado, canal, hora) => {
    if (!ligado) return `<span class="tag">desligado</span>`;
    if (!canal) return `<span class="tag atencao">ligado, sem canal</span>`;
    const quando = hora === null || hora === undefined ? "quando muda" : `todo dia às ${String(hora).padStart(2, "0")}:00`;
    return `<span class="tag ok">ligado</span> <span class="fraco">${quando}</span>`;
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

      return `
      <div class="cartao">
        <h2>${escapar(g.name)}</h2>
        <p class="fraco">${g.approximate_member_count ?? "?"} membros · id ${g.id}</p>
        <p>Patch: ${aviso(c?.patch_enabled, c?.patch_channel_id, null)}</p>
        <p>Notícias: ${aviso(c?.news_enabled, c?.news_channel_id, null)}</p>
        <p>Rotação: ${aviso(c?.rotation_enabled, c?.rotation_channel_id, c?.rotation_daily_hour)}</p>
        <p>${listaComandos}</p>
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
    <div class="tiles">
      ${tile(servidores.length, "servidores")}
      ${tile(ativos, "com aviso ligado")}
      ${tile(membros.toLocaleString("pt-BR"), "membros alcançados")}
      ${tile(totalComandos, "comandos usados")}
    </div>
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

  const opcoesHorario = (selecionado) =>
    [`<option value="">Desligado (só avisa quando muda)</option>`]
      .concat(
        Array.from({ length: 24 }, (_, h) => {
          const rotulo = `${String(h).padStart(2, "0")}:00`;
          return `<option value="${h}"${h === selecionado ? " selected" : ""}>Todo dia às ${rotulo}</option>`;
        })
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
        <h2>Rotação semanal</h2>
        <label class="interruptor">
          <input type="checkbox" name="rotation_enabled" ${config.rotation_enabled ? "checked" : ""}>
          Avisar a rotação semanal de campeões grátis
        </label>
        <label class="campo"><span>Canal</span><select name="rotation_channel_id">${opcoesCanais(config.rotation_channel_id)}</select></label>
        <label class="campo"><span>Horário fixo diário</span><select name="rotation_daily_hour">${opcoesHorario(config.rotation_daily_hour)}</select></label>
        <button class="botao vazado discreto" type="submit" formaction="/dashboard/${servidor.id}/postar-rotacao">Postar rotação agora</button>
      </div>
      <button class="botao" type="submit">Salvar</button>
    </form>
  `;
}

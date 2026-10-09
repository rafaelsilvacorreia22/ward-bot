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
const CAMPEOES_ALEGRES = ["Lulu", "Teemo", "Yuumi", "Poppy", "Milio", "Zoe"];

const ICONE_LUA = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const ICONE_SOL = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>`;

const ESTILO = `
  /* Cinza neutro, sem puxar para o azul. O verde-água é o único destaque,
     porque é a cor da própria ward. */
  :root {
    color-scheme: dark;
    --fundo: #17191c;
    --fundo-suave: #1e2023;
    --superficie: #212428;
    --borda: #33373d;
    --texto: #e7e8ea;
    --texto-fraco: #9a9fa6;
    --destaque: #0ac8b9;
    --destaque-fundo: #089c91;
    --destaque-texto: #06231f;
    --ouro: #c8aa6e;
    --ouro-fundo: #9b8250;
    --neutro: #2e3237;
    --neutro-fundo: #23262a;
    --alerta: #e0a52e;
  }
  /* O bloco claro aparece duas vezes de propósito: uma para a escolha manual
     e outra para a preferência do sistema. CSS não deixa juntar as duas
     condições num seletor só. */
  :root[data-tema="claro"] {
    color-scheme: light;
    --fundo: #f4f4f5;
    --fundo-suave: #ebebed;
    --superficie: #ffffff;
    --borda: #dcdcdf;
    --texto: #1b1d20;
    --texto-fraco: #6b7076;
    --destaque: #0aa89c;
    --destaque-fundo: #077f76;
    --destaque-texto: #ffffff;
    --ouro: #a98a4c;
    --ouro-fundo: #866a34;
    --neutro: #e4e4e7;
    --neutro-fundo: #c9c9ce;
    --alerta: #9c6a16;
  }
  @media (prefers-color-scheme: light) {
    :root:not([data-tema="escuro"]) {
      color-scheme: light;
      --fundo: #f4f4f5;
      --fundo-suave: #ebebed;
      --superficie: #ffffff;
      --borda: #dcdcdf;
      --texto: #1b1d20;
      --texto-fraco: #6b7076;
      --destaque: #0aa89c;
      --destaque-fundo: #077f76;
      --destaque-texto: #ffffff;
      --ouro: #a98a4c;
      --ouro-fundo: #866a34;
      --neutro: #e4e4e7;
      --neutro-fundo: #c9c9ce;
      --alerta: #9c6a16;
    }
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 15px;
    background: radial-gradient(1100px 520px at 50% -180px, var(--fundo-suave), var(--fundo)) no-repeat, var(--fundo);
    min-height: 100vh;
    color: var(--texto);
    line-height: 1.55;
  }
  .conteudo { max-width: 660px; margin: 0 auto; padding: 0 20px 60px; }
  a { color: var(--destaque); }
  h1 { font-size: clamp(1.5rem, 4vw, 2rem); line-height: 1.25; margin: 0 0 12px; letter-spacing: -.01em; }
  h2 { font-size: .98rem; margin: 0 0 10px; }
  p { margin: 0 0 12px; }
  code { background: var(--neutro-fundo); padding: 2px 6px; border-radius: 5px; font-size: .88em; }

  .topo {
    display: flex; align-items: center; justify-content: space-between;
    max-width: 760px; margin: 0 auto; padding: 18px 20px;
  }
  .marca { display: flex; align-items: center; gap: 10px; font-weight: 800; color: var(--texto); text-decoration: none; letter-spacing: .02em; }
  .marca img { width: 34px; height: 34px; border-radius: 9px; }
  .tema {
    display: grid; place-items: center; width: 42px; height: 42px;
    border-radius: 50%; border: 1px solid var(--borda);
    background: var(--superficie); color: var(--texto); cursor: pointer;
  }
  .tema:hover { border-color: var(--destaque); color: var(--destaque); }
  .tema .sol { display: none; }
  :root[data-tema="claro"] .tema .sol { display: block; }
  :root[data-tema="claro"] .tema .lua { display: none; }
  @media (prefers-color-scheme: light) {
    :root:not([data-tema="escuro"]) .tema .sol { display: block; }
    :root:not([data-tema="escuro"]) .tema .lua { display: none; }
  }

  /* Botão "gordinho" com sombra sólida embaixo: dá a sensação de afundar ao
     clicar, que é o que deixa a página com cara de brinquedo e não de painel. */
  .botao {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 11px 20px; margin: 5px 4px;
    border: 0; border-radius: 999px; cursor: pointer;
    background: var(--destaque); color: var(--destaque-texto);
    font: inherit; font-size: .82rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: .05em; text-decoration: none;
    box-shadow: 0 4px 0 var(--destaque-fundo);
    transition: transform .12s ease, box-shadow .12s ease;
  }
  .botao:hover { transform: translateY(-2px); box-shadow: 0 7px 0 var(--destaque-fundo); }
  .botao:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--destaque-fundo); }
  .botao.ouro { background: var(--ouro); color: var(--destaque-texto); box-shadow: 0 5px 0 var(--ouro-fundo); }
  .botao.ouro:hover { box-shadow: 0 7px 0 var(--ouro-fundo); }
  .botao.ouro:active { box-shadow: 0 1px 0 var(--ouro-fundo); }
  .botao.secundario { background: var(--neutro); color: var(--texto); box-shadow: 0 5px 0 var(--neutro-fundo); }
  .botao.secundario:hover { box-shadow: 0 7px 0 var(--neutro-fundo); }
  .botao.secundario:active { box-shadow: 0 1px 0 var(--neutro-fundo); }

  .cartao {
    background: var(--superficie); border: 1px solid var(--borda);
    border-radius: 14px; padding: 18px; margin: 14px 0;
  }
  .centro { text-align: center; }
  .cartao.centro h2 { margin-bottom: 14px; }

  /* Transição entre páginas. O navegador faz o cross-fade sozinho a partir
     desta regra; o cabeçalho ganha nome próprio para ficar parado enquanto o
     conteúdo troca. */
  @view-transition { navigation: auto; }
  .topo { view-transition-name: topo; }
  @keyframes entrar-conteudo { from { opacity: 0; transform: translateY(10px); } }
  @keyframes sair-conteudo { to { opacity: 0; transform: translateY(-6px); } }
  ::view-transition-old(root) { animation: sair-conteudo .2s ease both; }
  ::view-transition-new(root) { animation: entrar-conteudo .28s ease both; }
  /* Onde não há suporte a view transitions (Firefox), pelo menos a entrada da
     página é animada — sem duplicar o efeito onde já existe. */
  @supports not (view-transition-name: none) {
    .conteudo { animation: entrar-conteudo .28s ease both; }
  }
  .heroi { text-align: center; padding: 34px 0 10px; }
  /* A folga embaixo é onde os campeões aparecem no hover do "Me adicione!" —
     sem ela, eles cobrem o texto do subtítulo. */
  .subtitulo { color: var(--texto-fraco); font-size: .98rem; max-width: 480px; margin: 0 auto 84px; }
  .acoes { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; }

  /* Com as funções escondidas a página inicial fica curta, então o conteúdo
     é centralizado na altura da tela pra não sobrar um vazio embaixo. */
  .tela-inicial { min-height: calc(100vh - 150px); display: flex; flex-direction: column; justify-content: center; }

  /* O "Saiba mais" é um link para #funcoes: a seção só aparece quando vira
     alvo da URL, sem precisar de JavaScript. */
  #funcoes { display: none; }
  #funcoes:target { display: block; }

  /* Campeões que sobem do botão quando o mouse passa por cima. */
  .adicionar { position: relative; display: inline-block; }
  .campeoes { position: absolute; left: 50%; bottom: 100%; translate: -50% 0; display: flex; pointer-events: none; }
  /* Some em tela estreita: lá não existe hover e o leque vazaria para fora. */
  @media (max-width: 620px) { .campeoes { display: none; } }
  .campeoes img {
    width: 46px; height: 46px; margin: 0 -7px;
    border-radius: 50%; border: 2px solid var(--destaque);
    background: var(--superficie);
    opacity: 0; transform: translateY(26px) scale(.3);
    transition: transform .4s cubic-bezier(.34, 1.56, .64, 1), opacity .25s ease;
  }
  .adicionar:hover .campeoes img, .adicionar:focus-within .campeoes img { opacity: 1; }
  .adicionar:hover .campeoes img:nth-child(1), .adicionar:focus-within .campeoes img:nth-child(1) { transform: translate(6px, -6px) rotate(-16deg) scale(1); transition-delay: .00s; }
  .adicionar:hover .campeoes img:nth-child(2), .adicionar:focus-within .campeoes img:nth-child(2) { transform: translate(2px, -20px) rotate(-8deg) scale(1); transition-delay: .04s; }
  .adicionar:hover .campeoes img:nth-child(3), .adicionar:focus-within .campeoes img:nth-child(3) { transform: translate(0, -28px) rotate(-2deg) scale(1); transition-delay: .08s; }
  .adicionar:hover .campeoes img:nth-child(4), .adicionar:focus-within .campeoes img:nth-child(4) { transform: translate(0, -28px) rotate(2deg) scale(1); transition-delay: .12s; }
  .adicionar:hover .campeoes img:nth-child(5), .adicionar:focus-within .campeoes img:nth-child(5) { transform: translate(-2px, -20px) rotate(8deg) scale(1); transition-delay: .16s; }
  .adicionar:hover .campeoes img:nth-child(6), .adicionar:focus-within .campeoes img:nth-child(6) { transform: translate(-6px, -6px) rotate(16deg) scale(1); transition-delay: .20s; }
  @media (prefers-reduced-motion: reduce) {
    .botao, .campeoes img { transition: none; }
    .conteudo, ::view-transition-old(root), ::view-transition-new(root) { animation: none; }
  }

  /* Linha de campo: rótulo de largura fixa + controle ocupando o resto, pra
     os campos ficarem alinhados entre si dentro do cartão. */
  .interruptor { display: flex; align-items: center; gap: 9px; font-size: .92rem; font-weight: 600; margin: 0 0 14px; cursor: pointer; }
  .campo { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 10px; }
  .campo > span { color: var(--texto-fraco); font-size: .85rem; min-width: 132px; }
  .campo select { flex: 1; min-width: 200px; }

  /* appearance:none tira o botão de seta que o sistema desenha (no Windows ele
     aparece como uma caixa cinza que destoa do resto); a seta abaixo é nossa. */
  select {
    appearance: none; -webkit-appearance: none; -moz-appearance: none;
    font: inherit; font-size: .88rem; color: var(--texto); cursor: pointer;
    padding: 9px 36px 9px 12px;
    border: 1px solid var(--borda); border-radius: 10px;
    background-color: var(--fundo-suave);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237f93a6' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 14px center; background-size: 13px;
    transition: border-color .15s ease, background-color .15s ease;
  }
  select:hover { border-color: var(--destaque); background-color: var(--superficie); }
  select:focus-visible { outline: 2px solid var(--destaque); outline-offset: 2px; border-color: var(--destaque); }
  option { background: var(--superficie); color: var(--texto); }

  input[type="checkbox"] {
    appearance: none; -webkit-appearance: none;
    width: 19px; height: 19px; flex: none; margin: 0; cursor: pointer;
    border: 2px solid var(--borda); border-radius: 6px;
    background: var(--fundo-suave);
    transition: background-color .15s ease, border-color .15s ease;
  }
  input[type="checkbox"]:hover { border-color: var(--destaque); }
  input[type="checkbox"]:checked {
    background-color: var(--destaque); border-color: var(--destaque);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6L9 17l-5-5'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: center; background-size: 15px;
  }
  input[type="checkbox"]:focus-visible { outline: 2px solid var(--destaque); outline-offset: 2px; }

  .aviso, .fraco { color: var(--texto-fraco); font-size: .88rem; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin: 16px 0; }
  .tile { background: var(--superficie); border: 1px solid var(--borda); border-radius: 12px; padding: 14px; text-align: center; }
  .tile strong { display: block; font-size: 1.5rem; line-height: 1.2; }
  .tile span { color: var(--texto-fraco); font-size: .8rem; }
  .tag { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: .78rem; background: var(--neutro); color: var(--texto-fraco); }
  .tag.ok { background: var(--destaque); color: var(--destaque-texto); }
  .tag.atencao { background: var(--alerta); color: #1a1205; }
  .noticias { display: flex; flex-direction: column; gap: 6px; margin: 10px 0 14px; }
  .noticia {
    display: flex; align-items: flex-start; gap: 10px; margin: 0; cursor: pointer;
    padding: 10px 12px; border: 1px solid var(--borda); border-radius: 10px;
    background: var(--fundo-suave); font-weight: 400;
  }
  .noticia:hover { border-color: var(--destaque); }
  .noticia > span { display: flex; flex-direction: column; gap: 2px; }
  .noticia strong { font-size: .9rem; font-weight: 600; }
  .noticia input[type="radio"] { flex: none; margin-top: 3px; accent-color: var(--destaque); width: 16px; height: 16px; }
  .banner {
    display: inline-block; padding: 12px 18px; border-radius: 12px;
    font-weight: 700; background: var(--destaque); color: var(--destaque-texto);
  }
  .banner.atencao { background: var(--alerta); color: #1a1205; }
  .rodape { text-align: center; color: var(--texto-fraco); font-size: .9rem; padding-top: 20px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 6px; }
`;

function layout(titulo, corpo) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.webp" type="image/webp">
<title>${escapar(titulo)}</title>
<style>${ESTILO}</style>
<script>
  // Antes de pintar a tela, senão o tema claro pisca escuro ao carregar.
  try { var t = localStorage.getItem("tema"); if (t) document.documentElement.dataset.tema = t; } catch (e) {}
</script>
</head>
<body>
<header class="topo">
  <a class="marca" href="/"><img src="/favicon.webp" alt=""> Ward</a>
  <button class="tema" type="button" id="alternar-tema" aria-label="Alternar tema claro e escuro">
    <span class="lua">${ICONE_LUA}</span><span class="sol">${ICONE_SOL}</span>
  </button>
</header>
<main class="conteudo">
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
</script>
</body>
</html>`;
}

// As funções abaixo devolvem só o conteúdo da página; quem coloca o esqueleto
// (cabeçalho, estilo, alternador de tema) é o paginaHtml, uma única vez.
export function paginaHtml(titulo, corpo) {
  return new Response(layout(titulo, corpo), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export function landing(clientId) {
  const campeoes = CAMPEOES_ALEGRES.map(
    (nome) =>
      `<img src="https://ddragon.leagueoflegends.com/cdn/${VERSAO_ARTE}/img/champion/${nome}.png" alt="" loading="lazy">`
  ).join("");

  return `
    <div class="tela-inicial">
    <div class="heroi">
      <h1>Todo servidor de League of Legends precisa de um ping dessa ward.</h1>
      <p class="subtitulo">Avisa quando sai patch novo de League of Legends e
      mostra a rotação grátis semanal de campeões (no canal que você escolher).</p>
      <div class="acoes">
        <span class="adicionar">
          <span class="campeoes" aria-hidden="true">${campeoes}</span>
          <a class="botao" href="${convite(clientId)}">Me adicione!</a>
        </span>
        <a class="botao ouro" href="#funcoes">Saiba mais</a>
        <a class="botao secundario" href="/dashboard">Painel de controle</a>
      </div>
    </div>

    <div id="funcoes">
      <div class="cartao">
        <h2>Aviso de patch novo</h2>
        <p>Assim que a Riot publica um patch, o Ward posta a versão e o resumo
        oficial das novidades traduzido para português, com link para as notas
        completas.</p>
      </div>
      <div class="cartao">
        <h2>Rotação semanal</h2>
        <p>A lista de campeões grátis da semana, numa mensagem enxuta com o
        ícone de cada campeão.</p>
      </div>
      <div class="cartao">
        <h2>Comandos</h2>
        <p><code>/patch</code> mostra o patch atual, <code>/rotacao</code> mostra
        os campeões grátis e <code>/dashboard</code> devolve o link de
        configuração do seu servidor.</p>
      </div>
      <div class="cartao">
        <h2>Configuração sem código</h2>
        <p>Depois de adicionar o bot, entre no painel com sua conta do Discord,
        escolha o canal de cada aviso e pronto. Dá para postar na hora ou
        marcar um horário fixo diário.</p>
      </div>
      <p class="rodape"><a href="#">fechar</a></p>
    </div>

    <p class="rodape">
      <a href="/privacidade">Política de privacidade</a> · <a href="/termos">Termos de uso</a>
    </p>
    </div>
  `;
}

export function precisaLogar() {
  return `
    <div class="heroi">
      <h1>Precisa entrar primeiro</h1>
      <p class="subtitulo">Entre com sua conta do Discord para ver os servidores que você administra.</p>
      <div class="acoes"><a class="botao" href="/login">Entrar com Discord</a></div>
    </div>
  `;
}

export function listaServidores(servidores, clientId, ehDono) {
  const itens = servidores.length
    ? servidores
        .map(
          (s) =>
            `<div class="cartao centro"><h2>${escapar(s.name)}</h2><a class="botao" href="/dashboard/${s.id}">Configurar</a></div>`
        )
        .join("")
    : `<div class="cartao centro"><p>O Ward ainda não está em nenhum servidor que você administra.</p>
       <a class="botao" href="${convite(clientId)}">Me adicione!</a></div>`;

  // O link do painel de uso só aparece para a conta dona do bot.
  const linkUso = ehDono
    ? `<p class="centro"><a class="botao secundario" href="/admin/uso">Painel de uso</a></p>`
    : "";

  return `
    <h1 class="centro">Seus servidores</h1>
    ${itens}
    <p class="centro"><a class="botao secundario" href="${convite(clientId)}">Adicionar em outro servidor</a></p>
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
const AVISO_RIOT = `Ward isn't endorsed by Riot Games and doesn't reflect the
views or opinions of Riot Games or anyone officially involved in producing or
managing Riot Games properties. Riot Games and all associated properties are
trademarks or registered trademarks of Riot Games, Inc.`;

export function paginaPrivacidade() {
  return `
    <p><a href="/">← início</a></p>
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
    <p><a href="/">← início</a></p>
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
    <p><a href="/">← início</a></p>
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
    <div class="heroi">
      <h1>Deu problema aqui do meu lado</h1>
      <p class="subtitulo">Alguma coisa quebrou ao montar essa página. Tenta de novo em instantes.</p>
      <div class="acoes"><a class="botao" href="/dashboard">Voltar pro painel</a></div>
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
    <button class="botao secundario" type="submit" formaction="/dashboard/${servidor.id}/postar-noticia">Postar notícia selecionada</button>
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
    <p><a href="/dashboard">← voltar</a></p>
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
        <button class="botao secundario" type="submit" formaction="/dashboard/${servidor.id}/postar-patch">Postar patch agora</button>
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
        <button class="botao secundario" type="submit" formaction="/dashboard/${servidor.id}/postar-rotacao">Postar rotação agora</button>
      </div>
      <button class="botao" type="submit">Salvar</button>
    </form>
  `;
}

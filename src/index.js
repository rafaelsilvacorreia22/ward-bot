// Entrada do Worker: rotas HTTP (landing, dashboard, OAuth, interações do
// Discord, páginas de build) e os crons — o de 15 minutos confere patch novo
// e notícias; o de 2 minutos sobe os ícones do /build como emojis.

import {
  TIPO_INTERACAO,
  RESPOSTA,
  EFEMERA,
  assinaturaValida,
  json,
  listarServidoresDoBot,
  listarCanaisTexto,
  enviarMensagem,
  registrarComandosGlobais,
  pegarServidor,
  enviarDM,
  sairDoServidor,
  listarEmojisDoApp,
  criarEmojiDoApp,
  api,
} from "./discord.js";
import { COMANDOS, DEFINICOES } from "./comandos.js";
import { iniciarLogin, tratarCallback, pegarSessao, sairResposta } from "./oauth.js";
import {
  landing,
  precisaLogar,
  listaServidores,
  formularioConfig,
  paginaHtml,
  paginaErro,
  paginaPrivacidade,
  paginaTermos,
  paginaUso,
  paginaListaBuilds,
  paginaBuild,
} from "./paginas.js";
import {
  pegarConfig,
  salvarConfig,
  listarPatchAtivo,
  listarNoticiasAtiva,
  urlsDeNoticiasPostadas,
  marcarNoticiaPostada,
  marcarNoticiasSemeadas,
  registrarErroEnvio,
  limparErroEnvio,
  listarTodasConfigs,
  registrarUsoComando,
  listarUsoComandos,
  pegarEstado,
  salvarEstado,
  contarCacheBuild,
  listarComAvisoLigado,
  AVISOS_DO_PAINEL,
  faltaConfigurar,
  listarAvisosAoDono,
} from "./db.js";
import {
  versaoAtual,
  resumoPatchEmIngles,
  LINK_NOTAS_PATCH,
  todosOsCampeoes,
  acharCampeao,
  urlIconeCampeao,
} from "./riot.js";
import {
  MODOS,
  ROTAS,
  buscarBuild,
  dadosDoJogo,
  urlIconeItem,
  urlIconeRuna,
  urlIconeFeitico,
} from "./builds.js";
import {
  buscarPromocoes,
  assinaturaPromocoes,
  embedPromocoes,
  varrerSkinsNovas,
  mensagensSkinsNovas,
  buscarVideos,
  mensagemVideo,
} from "./avisos.js";
import { traduzirParaPtBr } from "./traducao.js";
import { buscarNoticias, embedDaNoticia } from "./noticias.js";

// Os dois crons do wrangler.jsonc. O texto tem que bater exatamente com o de
// lá — é por ele que o scheduled sabe qual dos dois disparou.
const CRON_EMOJIS = "*/2 * * * *";

const SO_NO_SERVIDOR = {
  type: RESPOSTA.MENSAGEM,
  data: { content: "Esse comando só funciona dentro do servidor.", flags: EFEMERA },
};

function ackAdiado(efemera) {
  return { type: RESPOSTA.ADIAR_MENSAGEM, data: efemera ? { flags: EFEMERA } : {} };
}

async function executarComSeguranca(handler, rotulo) {
  try {
    await handler();
  } catch (err) {
    console.log(`Erro em ${rotulo}:`, err.stack ?? err.message);
  }
}

async function tratarInteracao(interacao, env, ctx, origin) {
  if (interacao.type === TIPO_INTERACAO.PING) {
    return json({ type: RESPOSTA.PONG });
  }

  // Sugestões do autocomplete: não contam como uso (disparam a cada tecla).
  if (interacao.type === TIPO_INTERACAO.AUTOCOMPLETE) {
    const comando = COMANDOS[interacao.data.name];
    if (!comando?.autocompletar) return json({ type: RESPOSTA.SUGESTOES, data: { choices: [] } });
    try {
      return json(await comando.autocompletar(env, interacao));
    } catch (err) {
      console.log("Falha no autocomplete:", err.message);
      return json({ type: RESPOSTA.SUGESTOES, data: { choices: [] } });
    }
  }

  if (interacao.type === TIPO_INTERACAO.COMANDO) {
    if (!interacao.guild_id) return json(SO_NO_SERVIDOR);

    const comando = COMANDOS[interacao.data.name];
    if (!comando) return json(SO_NO_SERVIDOR);

    // Contagem de uso (sem identificar quem), fora do caminho da resposta pra
    // não gastar nada do prazo de 3 segundos que o Discord dá.
    ctx.waitUntil(
      registrarUsoComando(env, interacao.guild_id, interacao.data.name).catch((err) =>
        console.log("Não contabilizei o uso do comando:", err.message)
      )
    );

    if (!comando.adiar) {
      return json(await comando.executar(env, interacao, origin));
    }

    ctx.waitUntil(
      executarComSeguranca(() => comando.executar(env, interacao, origin), `/${interacao.data.name}`)
    );
    return json(ackAdiado(comando.efemera));
  }

  return json({ type: RESPOSTA.PONG });
}

// Quem criou a aplicação no Discord é o dono do bot. Descobre uma vez e
// guarda no banco, pra não precisar de ID fixo no código nem de consulta a
// cada carregamento de página.
async function idDoDono(env) {
  const salvo = await pegarEstado(env, "dono_id");
  if (salvo) return salvo;

  try {
    const app = await api(env, "/oauth2/applications/@me");
    // Quando a aplicação pertence a um time, "owner" é o time e não uma
    // pessoa — nesse caso quem vale é o dono do time.
    const id = app?.team?.owner_user_id ?? app?.owner?.id ?? null;
    if (id) await salvarEstado(env, "dono_id", id);
    return id;
  } catch (err) {
    console.log("Não descobri o dono da aplicação:", err.message);
    return null;
  }
}

// Servidores onde o Ward está E o usuário logado administra — cruza as duas
// listas com uma única chamada paginada (ver discord.js) em vez de checar
// servidor a servidor.
async function servidoresDoUsuario(env, sessao) {
  const doBot = await listarServidoresDoBot(env);
  return doBot.filter((g) => sessao.guilds.includes(g.id));
}

// Roda a ação em vários servidores sem estourar o limite de sub-requests do
// Worker nem apanhar rate limit da Discord: um punhado por vez, e erro de um
// servidor não derruba os outros.
// `funcao` ("patch", "promocoes", "skins", "youtube") diz em qual coluna
// gravar a falha. É o único caminho por onde esses avisos postam, então
// registrar aqui cobre todos.
async function paraCadaServidor(configs, env, acao, funcao, tamanhoLote = 8) {
  for (let i = 0; i < configs.length; i += tamanhoLote) {
    const lote = configs.slice(i, i + tamanhoLote);
    await Promise.all(
      lote.map(async (config) => {
        try {
          await acao(config);
          if (funcao) await limparErroEnvio(env, config.guild_id, funcao);
        } catch (err) {
          console.log(`Falha no servidor ${config.guild_id}:`, err.message);
          if (funcao) {
            await registrarErroEnvio(env, config.guild_id, funcao, err.message).catch(() => {});
          }
        }
      })
    );
  }
}

// Traz o resumo oficial da Riot (traduzido) em vez de só um link — a Riot não
// publica o texto das notas em nenhuma API, mas o <meta description> da
// própria página do patch já resume as novidades em uma frase. Usado tanto
// pelo alerta automático quanto pelo botão "postar agora".
async function construirEmbedPatch(env) {
  const versao = await versaoAtual();
  let url = LINK_NOTAS_PATCH;
  let descricao = "Confira todas as mudanças no link acima.";
  try {
    const resumo = await resumoPatchEmIngles(versao);
    url = resumo.url;
    descricao = await traduzirParaPtBr(env, resumo.resumo);
  } catch (err) {
    console.log("Não consegui buscar o resumo oficial do patch:", err.message);
  }
  return { versao, corpo: { embeds: [{ title: `Saiu o patch ${versao}!`, url, description: descricao, color: 0x0ac8b9 }] } };
}

// `apenasGuild` existe só para teste manual: limita a postagem a um servidor e
// NÃO grava o estado global. Sem essa segunda parte, um teste marcaria o patch
// como "já anunciado" e os outros servidores nunca receberiam o aviso de
// verdade.
async function checarPatch(env, apenasGuild) {
  const versaoAtualValor = await versaoAtual();
  const anterior = await pegarEstado(env, "last_patch_version");
  if (versaoAtualValor === anterior) return { mudou: false };

  const { versao, corpo } = await construirEmbedPatch(env);
  const todos = await listarPatchAtivo(env);
  const alvos = apenasGuild ? todos.filter((c) => c.guild_id === apenasGuild) : todos;
  await paraCadaServidor(
    alvos,
    env,
    (config) => (config.patch_channel_id ? enviarMensagem(env, config.patch_channel_id, corpo) : null),
    "patch"
  );
  if (!apenasGuild) await salvarEstado(env, "last_patch_version", versao);
  return { mudou: true, versao, servidores: alvos.length, teste: Boolean(apenasGuild) };
}

// Traduz a falha num aviso que a pessoa entenda, em vez de "deu erro": a
// causa de longe mais comum é o bot sem permissão no canal escolhido.
function classificarFalha(err) {
  const mensagem = err.message ?? "";
  if (/50001|50013|-> 403/.test(mensagem)) return "sem_permissao";
  return "erro";
}

// Quantas notícias no máximo saem de uma vez. O site publica umas 19 por mês,
// então isto quase nunca entra em ação — serve pra, se algo der errado e o
// bot ficar dias sem rodar, ele não despejar tudo de uma vez no canal.
const MAXIMO_NOTICIAS_POR_RODADA = 3;

// O controle do que já foi anunciado é por servidor: assim postar uma notícia
// à mão num servidor não tira ela dos outros, e quem liga a função depois não
// recebe um mês de notícias atrasadas de uma vez.
async function checarNoticias(env, apenasGuild) {
  let noticias;
  try {
    noticias = await buscarNoticias(env);
  } catch (err) {
    console.log("Não consegui buscar as notícias:", err.message);
    return { erro: err.message };
  }

  // Guarda as mais recentes para a vitrine da página inicial. Fica aqui
  // porque é o único lugar que já busca as notícias — a inicial lê do banco e
  // não dispara requisição nenhuma para o site da Riot.
  await salvarEstado(
    env,
    "vitrine_noticias",
    JSON.stringify(
      noticias
        .slice(-3)
        .reverse()
        .map((n) => ({ titulo: n.titulo, categoria: n.categoria, data: n.data, imagem: n.imagem, url: n.url }))
    )
  ).catch(() => {});

  const todos = await listarNoticiasAtiva(env);
  const alvos = (apenasGuild ? todos.filter((c) => c.guild_id === apenasGuild) : todos).filter(
    (c) => c.news_channel_id
  );

  const resumo = { servidores: alvos.length, postadas: 0, estreantes: 0 };

  for (const config of alvos) {
    // Servidor estreando: marca tudo como visto sem postar nada.
    //
    // A marca é uma coluna própria, não "news_posted está vazio". Aquele
    // proxy quebrava: o botão "Postar notícia" do painel grava uma linha, e a
    // partir dali o servidor virava "veterano" e tinha que *enviar* todo o
    // atrasado item por item — foi o que deixou o "Hora do Chá" com 17 na
    // fila.
    if (!config.news_seeded_at) {
      for (const noticia of noticias) await marcarNoticiaPostada(env, config.guild_id, noticia.url);
      await marcarNoticiasSemeadas(env, config.guild_id);
      resumo.estreantes++;
      continue;
    }

    const jaPostadas = await urlsDeNoticiasPostadas(env, config.guild_id);
    const novas = noticias
      .filter((n) => !jaPostadas.has(n.url))
      .slice(0, MAXIMO_NOTICIAS_POR_RODADA);

    let ultimaFalha = null;
    for (const noticia of novas) {
      try {
        await enviarMensagem(env, config.news_channel_id, { embeds: [embedDaNoticia(noticia)] });
        await marcarNoticiaPostada(env, config.guild_id, noticia.url);
        resumo.postadas++;
      } catch (err) {
        ultimaFalha = err.message;
        console.log(`Falha ao postar notícia em ${config.guild_id}:`, err.message);
        // 400 é o Discord recusando o conteúdo em si — tentar de novo dá no
        // mesmo. Como a fila sempre pega as 3 mais antigas pendentes e só sai
        // dali quem é postado, uma notícia assim travava o servidor para
        // sempre: foi o que parou o "Hora do Chá" em 04/10/2026. Marca para a
        // fila andar; outros erros (sem permissão, Discord fora do ar) seguem
        // sendo tentados de novo.
        if (/-> 400\b/.test(err.message)) {
          await marcarNoticiaPostada(env, config.guild_id, noticia.url);
          resumo.descartadas = (resumo.descartadas ?? 0) + 1;
        }
      }
    }

    // O erro só é limpo quando alguma notícia sai de verdade: rodada sem nada
    // novo não prova que o canal voltou a funcionar.
    if (ultimaFalha) {
      await registrarErroEnvio(env, config.guild_id, "noticias", ultimaFalha).catch(() => {});
    } else if (novas.length && config.news_last_error) {
      await limparErroEnvio(env, config.guild_id, "noticias").catch(() => {});
    }
  }

  return resumo;
}

// A mensagem do botão "Avisar o dono" do painel de uso: o que está ligado,
// o que falta, e o link direto para o painel daquele servidor.
function mensagemFaltaConfigurar(servidor, config, origin) {
  const linhas = AVISOS_DO_PAINEL.map(([nome, ligado, canal]) => {
    if (config[ligado] && config[canal]) return `✅ **${nome}** — ligado em <#${config[canal]}>`;
    if (config[ligado]) return `⚠️ **${nome}** — ligado, mas sem canal escolhido`;
    return `❌ **${nome}** — desligado`;
  });
  const faltam = faltaConfigurar(config).length;
  return {
    content: "Oi! Aqui é o Ward 👋",
    embeds: [
      {
        title: faltam
          ? `Falta pouco para usar o Ward 100% no ${servidor.name}`
          : `O Ward está 100% configurado no ${servidor.name}`,
        url: `${origin}/dashboard/${servidor.id}`,
        color: 0xc8a24a,
        description:
          (faltam
            ? `Você (ou alguém da sua equipe) adicionou o Ward no **${servidor.name}**, mas ainda ` +
              `${faltam === 1 ? "falta configurar 1 aviso" : `faltam configurar ${faltam} avisos`}:\n\n`
            : `Tudo ligado por aí:\n\n`) +
          linhas.join("\n") +
          `\n\nCada aviso posta no canal que você escolher, só quando tem novidade. ` +
          `Leva 1 minuto: **[abrir o painel do servidor](${origin}/dashboard/${servidor.id})**.\n\n` +
          `O \`/build\` e o \`/build-aram\` já funcionam sem configurar nada.`,
        thumbnail: { url: `${origin}/favicon.webp` },
        footer: { text: "Você recebeu isto por ser dono do servidor onde o Ward foi adicionado." },
      },
    ],
  };
}

// Marca o patch atual como "já anunciado", sem postar nada. Serve para
// depois de um teste ou de qualquer mexida manual no banco: sem isso, o
// próximo cron trataria tudo como novidade e reanunciaria em todos os
// servidores.
async function sincronizarEstado(env) {
  const versao = await versaoAtual();
  await salvarEstado(env, "last_patch_version", versao);
  return { patch: versao };
}

// ---------- promoções, skins novas e YouTube ----------
//
// Os três seguem a regra do patch: o "já anunciado" é global, e na primeira
// vez que o bot vê a fonte ele só memoriza, sem postar — senão o deploy
// anunciaria a promoção que já está no ar há dias ou os vídeos antigos do
// canal em todo servidor. `apenasGuild` (teste) posta só ali e não grava.

async function checarPromocoes(env, apenasGuild) {
  const lista = await buscarPromocoes(env);
  if (!lista.length) return { vazia: true };
  const assinatura = assinaturaPromocoes(lista);
  // Vitrine da inicial: as quatro com maior desconto.
  await salvarEstado(
    env,
    "vitrine_promocoes",
    JSON.stringify(lista.slice(0, 4).map((s) => ({ nome: s.nome, img: s.arquivoCampeao, skinId: s.skinId, desconto: s.desconto })))
  ).catch(() => {});

  const anterior = await pegarEstado(env, "promocoes_assinatura");
  if (!apenasGuild && (!anterior || anterior === assinatura)) {
    if (!anterior) await salvarEstado(env, "promocoes_assinatura", assinatura);
    return { mudou: false, primeiraVez: !anterior };
  }

  const todos = await listarComAvisoLigado(env, "promocoes");
  const alvos = apenasGuild ? todos.filter((c) => c.guild_id === apenasGuild) : todos;
  const corpo = { embeds: [embedPromocoes(lista)] };
  await paraCadaServidor(alvos, env, (c) => enviarMensagem(env, c.canal_do_aviso, corpo), "promocoes");
  if (!apenasGuild) await salvarEstado(env, "promocoes_assinatura", assinatura);
  return { mudou: true, skins: lista.length, servidores: alvos.length };
}

// A descoberta das skins novas é feita aos poucos pelo cron de 2 minutos
// (varrerSkinsNovas); aqui só sai o que ficou na fila ao fim da varredura.
async function postarSkinsNovas(env) {
  let fila = [];
  try {
    fila = JSON.parse((await pegarEstado(env, "skins_para_postar")) || "[]");
  } catch {}
  if (!fila.length) return { nada: true };

  await salvarEstado(env, "vitrine_skins", JSON.stringify(fila.slice(0, 4))).catch(() => {});
  const alvos = await listarComAvisoLigado(env, "skins");
  const mensagens = mensagensSkinsNovas(fila);
  await paraCadaServidor(
    alvos,
    env,
    async (c) => {
      for (const m of mensagens) await enviarMensagem(env, c.canal_do_aviso, m);
    },
    "skins"
  );
  // Esvazia antes de qualquer outra coisa poder falhar: repetir o anúncio em
  // todo servidor é pior do que perder um.
  await salvarEstado(env, "skins_para_postar", "[]");
  return { skins: fila.length, servidores: alvos.length };
}

const MAXIMO_VIDEOS_POR_RODADA = 3;

async function checarYoutube(env, apenasGuild) {
  const videos = await buscarVideos(env);
  await salvarEstado(env, "vitrine_youtube", JSON.stringify(videos[0])).catch(() => {});

  let vistos = null;
  try {
    vistos = JSON.parse((await pegarEstado(env, "youtube_vistos")) ?? "null");
  } catch {}
  if (!Array.isArray(vistos)) {
    await salvarEstado(env, "youtube_vistos", JSON.stringify(videos.map((v) => v.id)));
    return { primeiraVez: true };
  }

  // Do mais antigo para o mais novo, para o canal ficar cronológico.
  const novos = apenasGuild
    ? videos.slice(0, 1)
    : videos.filter((v) => !vistos.includes(v.id)).slice(0, MAXIMO_VIDEOS_POR_RODADA).reverse();
  if (!novos.length) return { novos: 0 };

  const todos = await listarComAvisoLigado(env, "youtube");
  const alvos = apenasGuild ? todos.filter((c) => c.guild_id === apenasGuild) : todos;
  await paraCadaServidor(
    alvos,
    env,
    async (c) => {
      for (const v of novos) await enviarMensagem(env, c.canal_do_aviso, mensagemVideo(v));
    },
    "youtube"
  );
  if (!apenasGuild) {
    const atualizados = [...new Set([...videos.map((v) => v.id), ...vistos])].slice(0, 50);
    await salvarEstado(env, "youtube_vistos", JSON.stringify(atualizados));
  }
  return { novos: novos.length, servidores: alvos.length };
}

// Dados que a página inicial usa como vitrine (patch atual, a build do dia e
// últimas notícias). Vem tudo do que o cron já guardou no banco: a inicial
// nunca chama a Riot nem o site do LoL. É decoração — se faltar, a página sai
// sem ela, nunca quebra.
async function montarVitrine(env) {
  const ler = (texto, reserva) => {
    try {
      return JSON.parse(texto ?? "null") ?? reserva;
    } catch {
      return reserva;
    }
  };

  try {
    const [patch, noticias, build, promocoes, skins, video] = await Promise.all([
      pegarEstado(env, "last_patch_version"),
      pegarEstado(env, "vitrine_noticias"),
      pegarEstado(env, "vitrine_build"),
      pegarEstado(env, "vitrine_promocoes"),
      pegarEstado(env, "vitrine_skins"),
      pegarEstado(env, "vitrine_youtube"),
    ]);
    const comoLista = (texto) => {
      const valor = ler(texto, []);
      return Array.isArray(valor) ? valor : [];
    };
    return {
      patch,
      noticias: comoLista(noticias),
      build: ler(build, null),
      promocoes: comoLista(promocoes),
      skins: comoLista(skins),
      video: ler(video, null),
    };
  } catch (err) {
    console.log("Não consegui montar a vitrine da inicial:", err.message);
    return null;
  }
}

// Campeões populares o bastante para quase sempre terem amostra. Um por dia
// vira a "build do dia" da página inicial.
const VITRINE_CAMPEOES = ["Ahri", "Jinx", "LeeSin", "Fizz", "Darius", "Thresh", "Yasuo", "Kaisa", "Lux", "Garen"];
const VITRINE_VALIDADE_MS = 3 * 60 * 60 * 1000;

// Guarda pronta a build que a inicial mostra, para a página não chamar o
// OP.GG a cada visita. Refeita a cada 3 horas.
async function atualizarVitrineBuild(env) {
  const em = await pegarEstado(env, "vitrine_build_em");
  if (em && Date.now() - new Date(em).getTime() < VITRINE_VALIDADE_MS) return { pulado: true };

  const dia = Math.floor(Date.now() / 86400000);
  for (let i = 0; i < VITRINE_CAMPEOES.length; i++) {
    const campeao = await acharCampeao(env, VITRINE_CAMPEOES[(dia + i) % VITRINE_CAMPEOES.length]);
    if (!campeao) continue;
    const build = await buscarBuild(env, campeao, "normal").catch(() => null);
    if (!build?.nucleo) continue;
    await salvarEstado(
      env,
      "vitrine_build",
      JSON.stringify({
        campeao: { nome: campeao.nome, img: campeao.arquivoImagem },
        rota: build.rota,
        taxa: build.taxa,
        jogos: build.jogos,
        itens: [...build.nucleo.ids, ...(build.botas?.ids ?? [])],
      })
    );
    await salvarEstado(env, "vitrine_build_em", new Date().toISOString());
    return { campeao: campeao.nome };
  }
  return { semAmostra: true };
}

// Sobe como emoji do aplicativo (não de um servidor) o ícone de cada item,
// runa, feitiço e campeão, pra poder usar em qualquer mensagem sem gastar
// slot de emoji de ninguém. Roda um lote por vez dentro do cron da coleta (o
// plano free do Worker tem limite de 50 sub-requests por execução) e pula
// quem já tem emoji, então patch novo com item novo se resolve sozinho.
async function sincronizarEmojis(env, limite = 8) {
  const versao = await versaoAtual();
  if ((await pegarEstado(env, "emojis_completos")) === versao) return { completo: true };

  const [dados, campeoes, { appId, emojis }] = await Promise.all([
    dadosDoJogo(env, versao),
    todosOsCampeoes(env, versao),
    listarEmojisDoApp(env),
  ]);
  const jaTem = new Set(emojis.map((e) => e.name));

  // Itens primeiro: são o coração do /build. Só os de id curto — os de seis
  // dígitos são variantes de modos temporários (Arena etc.).
  const tipoOrdem = { lendario: 0, botas: 1, componente: 2 };
  const itens = Object.entries(dados.itens)
    .filter(([id]) => Number(id) < 10000)
    .sort(([, a], [, b]) => tipoOrdem[a.tipo] - tipoOrdem[b.tipo])
    .map(([id]) => ({ nome: `i${id}`, url: urlIconeItem(versao, id) }));
  const todos = [
    ...itens,
    ...Object.entries(dados.runas).map(([id, r]) => ({ nome: `r${id}`, url: urlIconeRuna(r.icone) })),
    ...Object.entries(dados.feiticos).map(([key, f]) => ({ nome: `s${key}`, url: urlIconeFeitico(versao, f.imagem) })),
    ...campeoes.map((c) => ({ nome: c.arquivoImagem, url: urlIconeCampeao(versao, c.arquivoImagem) })),
  ];

  const faltando = todos.filter((t) => !jaTem.has(t.nome));
  const lote = faltando.slice(0, limite);
  let falhas = 0;
  for (const alvo of lote) {
    try {
      const res = await fetch(alvo.url);
      if (!res.ok) throw new Error(`download -> ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      let binario = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      await criarEmojiDoApp(env, appId, alvo.nome, `data:image/png;base64,${btoa(binario)}`);
    } catch (err) {
      falhas++;
      console.log(`Falha ao subir emoji ${alvo.nome}:`, err.message);
    }
  }

  // Só marca como completo quando não falta nada — um ícone que falhou
  // (imagem fora do ar) é tentado de novo na próxima rodada.
  if (faltando.length === lote.length && !falhas) await salvarEstado(env, "emojis_completos", versao);
  return { feitos: lote.length - falhas, falhas, faltam: faltando.length - lote.length, total: todos.length };
}

// Registra os slash commands sozinho quando a lista muda (comando novo,
// opção nova). Sem isto, todo deploy que mexe em comando dependia de alguém
// lembrar de abrir /registrar-comandos com a chave.
async function registrarComandosSeMudaram(env) {
  const assinatura = JSON.stringify(DEFINICOES);
  if ((await pegarEstado(env, "comandos_registrados")) === assinatura) return { mudou: false };
  await registrarComandosGlobais(env, DEFINICOES);
  await salvarEstado(env, "comandos_registrados", assinatura);
  return { mudou: true };
}

// Roteia as requisições HTTP. Quem chama (o fetch lá embaixo) é que trata as
// exceções — nada aqui pode escapar sem virar uma página legível.
async function rotear(request, env, ctx) {
  const url = new URL(request.url);
  const origin = url.origin;

    if (url.pathname === "/registrar-comandos") {
      const chave = (env.SETUP_KEY ?? "").trim();
      if (!chave || url.searchParams.get("chave") !== chave) {
        return new Response("Chave inválida.", { status: 401 });
      }
      try {
        const app = await registrarComandosGlobais(env, DEFINICOES);
        return json({ ok: true, aplicacao: app.name });
      } catch (err) {
        return json({ ok: false, erro: err.message }, 500);
      }
    }

    // Adianta um lote de emojis (o cron da coleta já faz isso sozinho — ver
    // sincronizarEmojis). Chame de novo até "faltam": 0.
    if (url.pathname === "/admin/emojis") {
      const chave = (env.SETUP_KEY ?? "").trim();
      if (!chave || url.searchParams.get("chave") !== chave) {
        return new Response("Chave inválida.", { status: 401 });
      }
      try {
        const resultado = await sincronizarEmojis(env, 20);
        return json({ ok: true, ...resultado });
      } catch (err) {
        return json({ ok: false, erro: err.message }, 500);
      }
    }


    // Painel de acompanhamento: onde o bot está, o que cada servidor ligou e
    // quantas vezes os comandos foram usados. Só leitura, protegido pela mesma
    // chave das outras rotas de administração.
    if (url.pathname === "/admin/uso") {
      // Dois caminhos: a chave na URL (para testes e scripts) ou estar logado
      // com a conta dona do bot — assim dá para chegar aqui só clicando, sem
      // passar a chave de mão em mão.
      const chave = (env.SETUP_KEY ?? "").trim();
      const temChave = chave && url.searchParams.get("chave") === chave;
      if (!temChave) {
        const sessao = await pegarSessao(env, request);
        const dono = await idDoDono(env);
        if (!sessao || !dono || sessao.usuario_id !== dono) {
          return new Response("Essa página é só para quem cuida do bot.", { status: 401 });
        }
      }
      const [servidores, configs, uso, opggErro, opggErroEm, buildsEmCache, emojisCompletos, avisosAoDono] =
        await Promise.all([
          listarServidoresDoBot(env),
          listarTodasConfigs(env),
          listarUsoComandos(env),
          pegarEstado(env, "opgg_erro"),
          pegarEstado(env, "opgg_erro_em"),
          contarCacheBuild(env).catch(() => 0),
          pegarEstado(env, "emojis_completos"),
          listarAvisosAoDono(env).catch(() => new Map()),
        ]);
      // A saúde da fonte das builds não é de nenhum servidor em particular,
      // então entra aqui como estado global do bot. O "Avisar o dono" só
      // aparece para quem entrou logado (não pela chave na URL).
      return paginaHtml(
        "Uso do Ward",
        paginaUso(servidores, configs, uso, {
          opggErro,
          opggErroEm,
          buildsEmCache,
          emojisCompletos,
          avisosAoDono,
          podeAvisarDono: !temChave,
          resultadoAviso: { tipo: url.searchParams.get("aviso"), servidor: url.searchParams.get("servidor") },
        }),
        { indexar: false }
      );
    }

    // "Tirar o Ward deste servidor" do painel de uso, para servidor suspeito
    // ou abandonado. Mesmas travas do "Avisar o dono": só a conta dona do
    // bot, só POST.
    const sairMatch = url.pathname.match(/^\/admin\/sair\/(\d+)$/);
    if (sairMatch && request.method === "POST") {
      const sessao = await pegarSessao(env, request);
      const dono = await idDoDono(env);
      if (!sessao || !dono || sessao.usuario_id !== dono) {
        return new Response("Só quem cuida do bot pode fazer isso.", { status: 401 });
      }
      let resultado = "saiu";
      try {
        await sairDoServidor(env, sairMatch[1]);
      } catch (err) {
        console.log(`Falha ao sair de ${sairMatch[1]}:`, err.message);
        resultado = "erro_saida";
      }
      return new Response(null, { status: 302, headers: { Location: `/admin/uso?aviso=${resultado}` } });
    }

    // "Avisar o dono" do painel de uso: manda para o dono do servidor uma
    // mensagem com o que está ligado e o que falta configurar, com o link
    // do painel daquele servidor. Só com a conta dona do bot logada — a
    // chave de URL não vale aqui, porque isto fala com gente de fora. POST,
    // e não GET, para nenhum pré-carregamento de link mandar mensagem sozinho.
    const avisoMatch = url.pathname.match(/^\/admin\/avisar-dono\/(\d+)$/);
    if (avisoMatch && request.method === "POST") {
      const guildId = avisoMatch[1];
      const sessao = await pegarSessao(env, request);
      const dono = await idDoDono(env);
      if (!sessao || !dono || sessao.usuario_id !== dono) {
        return new Response("Só quem cuida do bot pode fazer isso.", { status: 401 });
      }

      let resultado;
      try {
        const [servidor, config] = await Promise.all([pegarServidor(env, guildId), pegarConfig(env, guildId)]);
        const corpo = mensagemFaltaConfigurar(servidor, config, origin);
        try {
          await enviarDM(env, servidor.owner_id, corpo);
          resultado = "dm";
        } catch (err) {
          // 50007: o dono não aceita DM de membros do servidor. Aí vai no
          // canal de boas-vindas, se o servidor tiver um.
          if (!/50007/.test(err.message) || !servidor.system_channel_id) throw err;
          await enviarMensagem(env, servidor.system_channel_id, {
            ...corpo,
            content: `<@${servidor.owner_id}> ${corpo.content}`,
            allowed_mentions: { users: [servidor.owner_id] },
          }, { assinar: false });
          resultado = "canal";
        }
        await salvarEstado(env, `aviso_dono_${guildId}`, new Date().toISOString()).catch(() => {});
        ctx.waitUntil(registrarUsoComando(env, guildId, "painel:aviso-ao-dono").catch(() => {}));
      } catch (err) {
        console.log(`Falha ao avisar o dono de ${guildId}:`, err.message);
        resultado = /50007/.test(err.message) ? "dm_fechada" : "erro";
      }
      return new Response(null, {
        status: 302,
        headers: { Location: `/admin/uso?aviso=${resultado}&servidor=${guildId}#s${guildId}` },
      });
    }

    // Alinha o estado com a realidade sem postar nada (ver sincronizarEstado).
    if (url.pathname === "/admin/sincronizar") {
      const chave = (env.SETUP_KEY ?? "").trim();
      if (!chave || url.searchParams.get("chave") !== chave) {
        return new Response("Chave inválida.", { status: 401 });
      }
      try {
        return json({ ok: true, ...(await sincronizarEstado(env)) });
      } catch (err) {
        return json({ ok: false, erro: err.message }, 500);
      }
    }

    // Roda a mesma checagem do cron na hora, sem esperar os 15 minutos.
    // O parâmetro `servidor` é OBRIGATÓRIO de propósito: esta rota é para
    // teste, e sem ele um teste postaria no canal de todos os servidores que
    // usam o bot. O cron de verdade roda sem filtro (ver scheduled).
    if (url.pathname === "/admin/checar") {
      const chave = (env.SETUP_KEY ?? "").trim();
      if (!chave || url.searchParams.get("chave") !== chave) {
        return new Response("Chave inválida.", { status: 401 });
      }
      const apenasGuild = url.searchParams.get("servidor");
      if (!apenasGuild) {
        return json(
          {
            ok: false,
            erro: "Informe ?servidor=<id do servidor> para testar. Sem isso a postagem iria para todos os servidores.",
          },
          400
        );
      }
      const patch = await checarPatch(env, apenasGuild).catch((err) => ({ erro: err.message }));
      const noticias = await checarNoticias(env, apenasGuild).catch((err) => ({ erro: err.message }));
      const promocoes = await checarPromocoes(env, apenasGuild).catch((err) => ({ erro: err.message }));
      const youtube = await checarYoutube(env, apenasGuild).catch((err) => ({ erro: err.message }));
      return json({ servidor: apenasGuild, patch, noticias, promocoes, youtube });
    }

    // Para o Google: o que pode visitar e onde está a lista de páginas.
    if (url.pathname === "/robots.txt") {
      return new Response(
        `User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /admin\nDisallow: /login\nDisallow: /auth\nDisallow: /sair\n\nSitemap: ${origin}/sitemap.xml\n`,
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    // Todas as páginas públicas, incluindo a build de cada campeão nos dois
    // modos — é o que deixa "build fizz" e "build jinx aram" aparecerem no
    // Google apontando para cá.
    if (url.pathname === "/sitemap.xml") {
      const campeoes = await todosOsCampeoes(env, await versaoAtual());
      const hoje = new Date().toISOString().slice(0, 10);
      const entrada = (caminho, prioridade) =>
        `<url><loc>${origin}${caminho}</loc><lastmod>${hoje}</lastmod><priority>${prioridade}</priority></url>`;
      const urls = [
        entrada("/", "1.0"),
        entrada("/build", "0.9"),
        ...campeoes.flatMap((c) => {
          const base = `/build/${encodeURIComponent(c.arquivoImagem)}`;
          return [entrada(base, "0.8"), entrada(`${base}?modo=aram`, "0.6")];
        }),
        entrada("/privacidade", "0.2"),
        entrada("/termos", "0.2"),
      ];
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
          .join("")
          .replace(/&/g, "&amp;")}</urlset>`,
        { headers: { "Content-Type": "application/xml; charset=utf-8" } }
      );
    }

    // Lista de campeões com link para a build de cada um.
    if (url.pathname === "/build" && request.method === "GET") {
      const versao = await versaoAtual();
      const campeoes = await todosOsCampeoes(env, versao);
      return paginaHtml("Builds do meta de todos os campeões — Ward", paginaListaBuilds(campeoes, versao), {
        caminho: "/build",
        descricao:
          "A build que mais ganha de cada campeão do League of Legends no patch atual: itens, runas, feitiços " +
          "e ordem de habilidades, em partida normal e ARAM. Também no Discord com /build.",
      });
    }

    // A mesma build do /build, em página: ícones grandes e o link que o
    // embed do Discord aponta.
    const buildMatch = url.pathname.match(/^\/build\/([^/]+)$/);
    if (buildMatch && request.method === "GET") {
      const campeao = await acharCampeao(env, decodeURIComponent(buildMatch[1]));
      if (!campeao) return new Response("Campeão não encontrado.", { status: 404 });
      // Links antigos (?modo=ranked, ?modo=flex) caem na partida normal.
      const modo = url.searchParams.get("modo") === "aram" ? "aram" : "normal";
      const rota = ROTAS[url.searchParams.get("rota")] ? url.searchParams.get("rota") : undefined;
      const versao = await versaoAtual();
      const [build, dados] = await Promise.all([
        buscarBuild(env, campeao, modo, rota).catch(() => null),
        dadosDoJogo(env, versao),
      ]);
      // Título e descrição no formato que as pessoas pesquisam ("build fizz
      // meio", "build jinx aram"), com o patch para o Google ver que é atual.
      const nomeRota = build?.rota ? ` ${ROTAS[build.rota] ?? ""}` : "";
      const nomeModo = modo === "aram" ? " ARAM" : nomeRota;
      const patchPub = `${Number(versao.split(".")[0]) + 10}.${versao.split(".")[1]}`;
      const itensNucleo = (build?.nucleo?.ids ?? []).map((id) => dados.itens[id]?.nome).filter(Boolean).join(", ");
      return paginaHtml(
        `Build ${campeao.nome}${nomeModo} — patch ${patchPub} | Ward`,
        paginaBuild({ campeao, build, dados, versao, modo }),
        {
          caminho: `/build/${encodeURIComponent(campeao.arquivoImagem)}${modo === "aram" ? "?modo=aram" : ""}`,
          imagem: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${campeao.arquivoImagem}_0.jpg`,
          descricao: build?.jogos
            ? `Build de ${campeao.nome}${nomeModo} que mais ganha no patch ${patchPub}: ${itensNucleo}. ` +
              `${(build.taxa * 100).toFixed(1).replace(".", ",")}% de vitória em ${build.jogos.toLocaleString("pt-BR")} partidas, ` +
              `com runas, feitiços e ordem de habilidades.`
            : `Build de ${campeao.nome}${nomeModo} no meta atual do League of Legends: itens, runas, feitiços e habilidades.`,
        }
      );
    }

    if (url.pathname === "/" && request.method === "GET") {
      // cheio: a inicial é a única página sem a coluna estreita — o hero e as
      // faixas de seção ocupam a largura toda da tela.
      return paginaHtml(
        "Ward",
        landing(env.DISCORD_CLIENT_ID, await montarVitrine(env)),
        { cheio: true, caminho: "/" }
      );
    }

    // Páginas públicas exigidas pela Riot pra aprovar a Production API Key.
    if (url.pathname === "/privacidade" && request.method === "GET") {
      return paginaHtml("Política de privacidade — Ward", paginaPrivacidade());
    }

    if (url.pathname === "/termos" && request.method === "GET") {
      return paginaHtml("Termos de uso — Ward", paginaTermos());
    }

    if (url.pathname === "/login" && request.method === "GET") {
      return iniciarLogin(env, origin);
    }

    if (url.pathname === "/sair" && request.method === "GET") {
      return sairResposta();
    }

    if (url.pathname === "/auth/callback" && request.method === "GET") {
      return tratarCallback(env, request, origin);
    }

    if (url.pathname === "/dashboard" && request.method === "GET") {
      const sessao = await pegarSessao(env, request);
      if (!sessao) return paginaHtml("Entrar", precisaLogar(), { indexar: false });
      const [servidores, dono] = await Promise.all([
        servidoresDoUsuario(env, sessao),
        idDoDono(env),
      ]);
      const ehDono = Boolean(dono) && sessao.usuario_id === dono;
      return paginaHtml("Seus servidores", listaServidores(servidores, env.DISCORD_CLIENT_ID, ehDono), { indexar: false });
    }

    // Botão "postar agora": usa o canal que está selecionado no formulário
    // na hora (mesmo que ainda não tenha sido salvo), posta uma vez e volta
    // pra página de config com um aviso — não mexe no estado do cron.
    const postarMatch = url.pathname.match(/^\/dashboard\/(\d+)\/postar-(patch|promocoes|youtube)$/);
    if (postarMatch && request.method === "POST") {
      const [, guildId, tipo] = postarMatch;
      const sessao = await pegarSessao(env, request);
      if (!sessao) return paginaHtml("Entrar", precisaLogar(), { indexar: false });

      const servidores = await servidoresDoUsuario(env, sessao);
      if (!servidores.some((s) => s.id === guildId)) {
        return new Response("Você não administra esse servidor (ou o Ward não está nele).", { status: 403 });
      }

      const dados = await request.formData();
      const campoCanal = { patch: "patch_channel_id", promocoes: "sale_channel_id", youtube: "youtube_channel_id" };
      const canalId = dados.get(campoCanal[tipo]);

      let status = tipo;
      if (!canalId) {
        status = "sem_canal";
      } else {
        try {
          if (tipo === "patch") {
            const { corpo } = await construirEmbedPatch(env);
            await enviarMensagem(env, canalId, corpo);
          } else if (tipo === "promocoes") {
            await enviarMensagem(env, canalId, { embeds: [embedPromocoes(await buscarPromocoes(env))] });
          } else {
            const [ultimo] = await buscarVideos(env);
            await enviarMensagem(env, canalId, mensagemVideo(ultimo));
          }
        } catch (err) {
          console.log(`Falha ao postar ${tipo} manualmente:`, err.message);
          status = classificarFalha(err);
        }
      }

      // Conta também o que é feito pelo painel, não só os comandos do Discord.
      if (status === tipo) {
        ctx.waitUntil(
          registrarUsoComando(env, guildId, `painel:postar-${tipo}`).catch((err) =>
            console.log("Não contabilizei a ação do painel:", err.message)
          )
        );
      }

      return new Response(null, {
        status: 302,
        headers: { Location: `/dashboard/${guildId}?status=${status}` },
      });
    }

    // Posta uma notícia escolhida na lista do painel. Só aceita URL que esteja
    // de fato na lista atual do site oficial — sem isso, dava pra fazer o bot
    // publicar qualquer link forjando o formulário.
    const noticiaMatch = url.pathname.match(/^\/dashboard\/(\d+)\/postar-noticia$/);
    if (noticiaMatch && request.method === "POST") {
      const guildId = noticiaMatch[1];
      const sessao = await pegarSessao(env, request);
      if (!sessao) return paginaHtml("Entrar", precisaLogar(), { indexar: false });

      const servidores = await servidoresDoUsuario(env, sessao);
      if (!servidores.some((s) => s.id === guildId)) {
        return new Response("Você não administra esse servidor (ou o Ward não está nele).", { status: 403 });
      }

      const dados = await request.formData();
      const escolhida = dados.get("noticia_url");
      const canalId = dados.get("news_channel_id");

      let status = "noticia";
      if (!canalId) {
        status = "sem_canal";
      } else if (!escolhida) {
        status = "sem_noticia";
      } else {
        try {
          const noticias = await buscarNoticias(env);
          const noticia = noticias.find((n) => n.url === escolhida);
          if (!noticia) throw new Error("notícia fora da lista atual");

          await enviarMensagem(env, canalId, { embeds: [embedDaNoticia(noticia)] });
          // Marca pra este servidor, pra verificação automática não repetir.
          await marcarNoticiaPostada(env, guildId, noticia.url);
          ctx.waitUntil(
            registrarUsoComando(env, guildId, "painel:postar-noticia").catch(() => {})
          );
        } catch (err) {
          console.log("Falha ao postar notícia escolhida:", err.message);
          status = classificarFalha(err);
        }
      }

      return new Response(null, {
        status: 302,
        headers: { Location: `/dashboard/${guildId}?status=${status}` },
      });
    }

    const configMatch = url.pathname.match(/^\/dashboard\/(\d+)$/);
    if (configMatch && (request.method === "GET" || request.method === "POST")) {
      const guildId = configMatch[1];
      const sessao = await pegarSessao(env, request);
      if (!sessao) return paginaHtml("Entrar", precisaLogar(), { indexar: false });

      const servidores = await servidoresDoUsuario(env, sessao);
      const servidor = servidores.find((s) => s.id === guildId);
      if (!servidor) {
        return new Response("Você não administra esse servidor (ou o Ward não está nele).", { status: 403 });
      }

      let salvo = false;
      if (request.method === "POST") {
        const dados = await request.formData();
        await salvarConfig(env, guildId, {
          patch_enabled: dados.get("patch_enabled") === "on",
          patch_channel_id: dados.get("patch_channel_id") || null,
          news_enabled: dados.get("news_enabled") === "on",
          news_channel_id: dados.get("news_channel_id") || null,
          sale_enabled: dados.get("sale_enabled") === "on",
          sale_channel_id: dados.get("sale_channel_id") || null,
          skins_enabled: dados.get("skins_enabled") === "on",
          skins_channel_id: dados.get("skins_channel_id") || null,
          youtube_enabled: dados.get("youtube_enabled") === "on",
          youtube_channel_id: dados.get("youtube_channel_id") || null,
        });
        salvo = true;
        ctx.waitUntil(
          registrarUsoComando(env, guildId, "painel:salvar").catch((err) =>
            console.log("Não contabilizei o salvamento:", err.message)
          )
        );
      }

      const [config, canais, noticias] = await Promise.all([
        pegarConfig(env, guildId),
        listarCanaisTexto(env, guildId),
        // A prévia é um extra: se o site da Riot não responder, a página de
        // configuração continua funcionando normalmente, só sem a lista.
        buscarNoticias(env).catch((err) => {
          console.log("Não carreguei a prévia de notícias:", err.message);
          return [];
        }),
      ]);
      const status = url.searchParams.get("status");
      return paginaHtml(
        `Configurar — ${servidor.name}`,
        formularioConfig(servidor, config, canais, salvo, status, noticias),
        { indexar: false }
      );
    }

    if (request.method !== "POST") {
      return new Response("Não encontrado.", { status: 404 });
    }

    // O corpo precisa ser lido cru: a assinatura é sobre os bytes exatos, e
    // reserializar o JSON mudaria o texto e invalidaria a verificação.
    const corpoBruto = await request.text();
    if (!(await assinaturaValida(request, corpoBruto, (env.DISCORD_PUBLIC_KEY ?? "").trim()))) {
      return new Response("Assinatura inválida.", { status: 401 });
    }

    let interacao;
    try {
      interacao = JSON.parse(corpoBruto);
    } catch {
      return new Response("JSON inválido.", { status: 400 });
    }

    return tratarInteracao(interacao, env, ctx, origin);
}

export default {
  // Exceção não tratada aqui viraria a tela branca "Error 1101" da Cloudflare,
  // que não explica nada pra quem está usando (e não deixa rastro fácil de
  // achar). Então tudo passa por este try/catch: registra o erro no log e
  // devolve uma página com texto de verdade.
  async fetch(request, env, ctx) {
    try {
      return await rotear(request, env, ctx);
    } catch (err) {
      console.log("Erro não tratado:", err.stack ?? err.message);
      return paginaHtml("Deu problema", paginaErro());
    }
  },

  async scheduled(evento, env, ctx) {
    // Os emojis sobem num disparo próprio, de 2 em 2 minutos: cada execução
    // do Worker tem seu próprio limite de sub-requests, então separar impede
    // que o upload coma o orçamento do aviso de patch. Quando não falta
    // nenhum, cada disparo é só uma leitura no banco.
    if (evento.cron === CRON_EMOJIS) {
      ctx.waitUntil(
        (async () => {
          const emojis = await sincronizarEmojis(env).catch((err) => ({ erro: err.message }));
          if (!emojis.completo) console.log("emojis:", JSON.stringify(emojis));
          // Só trabalha quando sai patch novo (ver varrerSkinsNovas).
          const skins = await varrerSkinsNovas(env).catch((err) => ({ erro: err.message }));
          if (!skins.completo) console.log("skins:", JSON.stringify(skins));
        })()
      );
      return;
    }

    ctx.waitUntil(
      (async () => {
        // O cron roda de 15 em 15 min porque o horário fixo diário precisa
        // dessa precisão. As notícias não: o site publica ~0,6 artigo por dia
        // e cada busca custa ~390 KB, então checar nos 96 disparos diários era
        // baixar dezenas de MB para quase nunca achar algo. Meia hora de
        // atraso no pior caso não muda nada para quem lê.
        const minuto = new Date(evento.scheduledTime ?? Date.now()).getUTCMinutes();
        const vezDasNoticias = minuto < 15 || (minuto >= 30 && minuto < 45);

        const patch = await checarPatch(env).catch((err) => ({ erro: err.message }));
        const noticias = vezDasNoticias
          ? await checarNoticias(env).catch((err) => ({ erro: err.message }))
          : { pulado: true };
        // A promoção da loja gira uma vez por semana: checar de hora em hora
        // basta. Os vídeos saem a qualquer hora, então vão a cada rodada.
        const promocoes =
          minuto < 15
            ? await checarPromocoes(env).catch((err) => ({ erro: err.message }))
            : { pulado: true };
        const skins = await postarSkinsNovas(env).catch((err) => ({ erro: err.message }));
        const youtube = await checarYoutube(env).catch((err) => ({ erro: err.message }));
        const comandos = await registrarComandosSeMudaram(env).catch((err) => ({ erro: err.message }));
        const vitrine = await atualizarVitrineBuild(env).catch((err) => ({ erro: err.message }));
        console.log("cron:", JSON.stringify({ patch, noticias, promocoes, skins, youtube, comandos, vitrine }));
      })()
    );
  },
};

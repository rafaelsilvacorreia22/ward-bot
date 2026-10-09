// Entrada do Worker: rotas HTTP (landing, dashboard, OAuth, interações do
// Discord) e o cron que confere patch novo / rotação semanal.

import {
  TIPO_INTERACAO,
  RESPOSTA,
  EFEMERA,
  assinaturaValida,
  json,
  listarServidoresDoBot,
  listarCanaisTexto,
  enviarMensagem,
  apagarMensagem,
  registrarComandosGlobais,
  listarEmojisDoApp,
  criarEmojiDoApp,
  mensagemComIcones,
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
} from "./paginas.js";
import {
  pegarConfig,
  salvarConfig,
  listarPatchAtivo,
  listarRotacaoAtiva,
  listarNoticiasAtiva,
  urlsDeNoticiasPostadas,
  marcarNoticiaPostada,
  marcarNoticiasSemeadas,
  registrarErroEnvio,
  limparErroEnvio,
  listarRotacaoDiarioPendente,
  marcarRotacaoDiario,
  pegarUltimaMensagemRotacao,
  salvarUltimaMensagemRotacao,
  listarTodasConfigs,
  registrarUsoComando,
  listarUsoComandos,
  pegarEstado,
  salvarEstado,
} from "./db.js";
import {
  versaoAtual,
  resumoPatchEmIngles,
  LINK_NOTAS_PATCH,
  rotacaoAtual,
  todosOsCampeoes,
  urlIconeCampeao,
} from "./riot.js";
import { traduzirParaPtBr } from "./traducao.js";
import { buscarNoticias, embedDaNoticia } from "./noticias.js";

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
// `funcao` ("patch" | "rotacao") diz em qual coluna gravar a falha. Este é o
// único caminho por onde patch e rotação postam, então registrar aqui cobre
// os dois de uma vez.
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

// A rotação é sempre a mesma lista até mudar de semana, então em vez de
// empilhar uma mensagem nova por cima da antiga, apaga a anterior e posta a
// atual — o canal fica só com a rotação válida.
async function postarRotacaoSubstituindo(env, guildId, canalId, corpo) {
  const anterior = await pegarUltimaMensagemRotacao(env, guildId);
  if (anterior?.mensagem_id) {
    try {
      await apagarMensagem(env, anterior.canal_id ?? canalId, anterior.mensagem_id);
    } catch (err) {
      // Já não existe (apagada à mão, canal excluído): segue e posta a nova.
      console.log(`Não apaguei a rotação anterior de ${guildId}:`, err.message);
    }
  }

  const nova = await enviarMensagem(env, canalId, corpo);
  await salvarUltimaMensagemRotacao(env, guildId, canalId, nova?.id ?? null);
  return nova;
}

// Traz o resumo oficial da Riot (traduzido) em vez de só um link — a Riot não
// publica o texto das notas em nenhuma API, mas o <meta description> da
// própria página do patch já resume as novidades em uma frase. Usado tanto
// pelo alerta automático quanto pelo botão "postar agora" e pelo horário fixo.
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

// Idem, mas pra rotação — lança erro se a chave da Riot estiver ausente ou
// vencida (quem chama decide como avisar).
async function construirMensagemRotacao(env) {
  const campeoes = await rotacaoAtual(env);
  const texto = await mensagemComIcones(env, campeoes, "**Rotação grátis da semana:**");
  return { campeoes, corpo: { content: texto } };
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

// Mesma regra do checarPatch quanto ao `apenasGuild`: em teste não grava a
// assinatura global, senão os outros servidores perderiam o anúncio real.
async function checarRotacao(env, apenasGuild) {
  let campeoes, corpo;
  try {
    ({ campeoes, corpo } = await construirMensagemRotacao(env));
  } catch (err) {
    console.log("Rotação indisponível no cron:", err.message);
    return { mudou: false, erro: err.message };
  }

  // Assinatura da lista (não "semana ISO"): a rotação não segue semana cheia.
  const assinatura = campeoes.map((c) => c.nome).sort().join("|");
  const anterior = await pegarEstado(env, "last_rotation_signature");
  if (assinatura === anterior && !apenasGuild) return { mudou: false };

  const todos = await listarRotacaoAtiva(env);
  const alvos = apenasGuild ? todos.filter((c) => c.guild_id === apenasGuild) : todos;
  await paraCadaServidor(
    alvos,
    env,
    (config) =>
      config.rotation_channel_id
        ? postarRotacaoSubstituindo(env, config.guild_id, config.rotation_channel_id, corpo)
        : null,
    "rotacao"
  );
  if (!apenasGuild) await salvarEstado(env, "last_rotation_signature", assinatura);
  return { mudou: true, servidores: alvos.length, teste: Boolean(apenasGuild) };
}

// Traduz a falha num aviso que a pessoa entenda, em vez de "deu erro": as
// duas causas de longe mais comuns são a chave da Riot vencida e o bot sem
// permissão no canal escolhido.
function classificarFalha(err) {
  const mensagem = err.message ?? "";
  if (/apikey|RIOT_API_KEY|rotação\) -> 401|rotação\) -> 403/i.test(mensagem)) return "chave_riot";
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
    noticias = await buscarNoticias();
  } catch (err) {
    console.log("Não consegui buscar as notícias:", err.message);
    return { erro: err.message };
  }

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

// Marca o patch e a rotação atuais como "já anunciados", sem postar nada.
// Serve para depois de um teste ou de qualquer mexida manual no banco: sem
// isso, o próximo cron trataria tudo como novidade e reanunciaria em todos os
// servidores.
async function sincronizarEstado(env) {
  const versao = await versaoAtual();
  await salvarEstado(env, "last_patch_version", versao);

  let rotacao = "não sincronizada (a Riot não respondeu)";
  try {
    const campeoes = await rotacaoAtual(env);
    await salvarEstado(env, "last_rotation_signature", campeoes.map((c) => c.nome).sort().join("|"));
    rotacao = `${campeoes.length} campeões`;
  } catch (err) {
    console.log("Não sincronizei a rotação:", err.message);
  }

  return { patch: versao, rotacao };
}

function horaAtualBrasil() {
  return Number(
    new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(
      new Date()
    )
  );
}

function dataAtualBrasil() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

// Servidores com horário fixo diário configurado: posta a informação atual
// (não só quando muda) uma vez por dia, no horário escolhido por cada um.
async function checarPostagensDiarias(env, apenasGuild) {
  const hora = horaAtualBrasil();
  const hoje = dataAtualBrasil();
  const soDoTeste = (lista) => (apenasGuild ? lista.filter((c) => c.guild_id === apenasGuild) : lista);

  const alvosRotacao = soDoTeste(await listarRotacaoDiarioPendente(env, hora, hoje));
  if (alvosRotacao.length) {
    try {
      const { corpo } = await construirMensagemRotacao(env);
      for (const guild of alvosRotacao) {
        try {
          await postarRotacaoSubstituindo(env, guild.guild_id, guild.rotation_channel_id, corpo);
          await marcarRotacaoDiario(env, guild.guild_id, hoje);
        } catch (err) {
          console.log(`Falha na postagem diária de rotação (${guild.guild_id}):`, err.message);
        }
      }
    } catch (err) {
      console.log("Rotação indisponível na postagem diária:", err.message);
    }
  }

  return { rotacao: alvosRotacao.length };
}

// Sobe o ícone de cada campeão como emoji do aplicativo (não de um servidor),
// pra poder usar em qualquer mensagem sem gastar slot de emoji de ninguém.
// Processa só um lote por chamada (o plano free do Worker tem limite de 50
// sub-requests por execução) — chamar de novo continua de onde parou, porque
// pula quem já tem emoji.
async function subirEmojisFaltantes(env, limite = 20) {
  const versao = await versaoAtual();
  const campeoes = await todosOsCampeoes(versao);
  const { appId, emojis } = await listarEmojisDoApp(env);
  const jaTem = new Set(emojis.map((e) => e.name));

  const faltando = campeoes.filter((c) => !jaTem.has(c.arquivoImagem));
  const lote = faltando.slice(0, limite);

  for (const campeao of lote) {
    try {
      const res = await fetch(urlIconeCampeao(versao, campeao.arquivoImagem));
      if (!res.ok) throw new Error(`download -> ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const base64 = btoa(String.fromCharCode(...bytes));
      await criarEmojiDoApp(env, appId, campeao.arquivoImagem, `data:image/png;base64,${base64}`);
    } catch (err) {
      console.log(`Falha ao subir emoji de ${campeao.arquivoImagem}:`, err.message);
    }
  }

  return { feitos: lote.length, faltam: faltando.length - lote.length, total: campeoes.length };
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

    // Sobe os ícones de campeão que ainda faltam como emoji do app (um lote
    // por chamada — ver subirEmojisFaltantes). Chame de novo até "faltam": 0.
    if (url.pathname === "/admin/emojis") {
      const chave = (env.SETUP_KEY ?? "").trim();
      if (!chave || url.searchParams.get("chave") !== chave) {
        return new Response("Chave inválida.", { status: 401 });
      }
      try {
        const resultado = await subirEmojisFaltantes(env);
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
      const [servidores, configs, uso] = await Promise.all([
        listarServidoresDoBot(env),
        listarTodasConfigs(env),
        listarUsoComandos(env),
      ]);
      return paginaHtml("Uso do Ward", paginaUso(servidores, configs, uso));
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
      const rotacao = await checarRotacao(env, apenasGuild).catch((err) => ({ erro: err.message }));
      const diarias = await checarPostagensDiarias(env, apenasGuild).catch((err) => ({ erro: err.message }));
      return json({ servidor: apenasGuild, patch, noticias, rotacao, diarias });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return paginaHtml("Ward", landing(env.DISCORD_CLIENT_ID));
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
      if (!sessao) return paginaHtml("Entrar", precisaLogar());
      const [servidores, dono] = await Promise.all([
        servidoresDoUsuario(env, sessao),
        idDoDono(env),
      ]);
      const ehDono = Boolean(dono) && sessao.usuario_id === dono;
      return paginaHtml("Seus servidores", listaServidores(servidores, env.DISCORD_CLIENT_ID, ehDono));
    }

    // Botões "postar agora": usam o canal que está selecionado no formulário
    // na hora (mesmo que ainda não tenha sido salvo), postam uma vez e voltam
    // pra página de config com um aviso — não mexem no horário/estado do cron.
    const postarMatch = url.pathname.match(/^\/dashboard\/(\d+)\/postar-(patch|rotacao)$/);
    if (postarMatch && request.method === "POST") {
      const [, guildId, tipo] = postarMatch;
      const sessao = await pegarSessao(env, request);
      if (!sessao) return paginaHtml("Entrar", precisaLogar());

      const servidores = await servidoresDoUsuario(env, sessao);
      if (!servidores.some((s) => s.id === guildId)) {
        return new Response("Você não administra esse servidor (ou o Ward não está nele).", { status: 403 });
      }

      const dados = await request.formData();
      const canalId =
        tipo === "patch" ? dados.get("patch_channel_id") : dados.get("rotation_channel_id");

      let status = tipo;
      if (!canalId) {
        status = "sem_canal";
      } else {
        try {
          if (tipo === "patch") {
            const { corpo } = await construirEmbedPatch(env);
            await enviarMensagem(env, canalId, corpo);
          } else {
            const { corpo } = await construirMensagemRotacao(env);
            await postarRotacaoSubstituindo(env, guildId, canalId, corpo);
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
      if (!sessao) return paginaHtml("Entrar", precisaLogar());

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
          const noticias = await buscarNoticias();
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
      if (!sessao) return paginaHtml("Entrar", precisaLogar());

      const servidores = await servidoresDoUsuario(env, sessao);
      const servidor = servidores.find((s) => s.id === guildId);
      if (!servidor) {
        return new Response("Você não administra esse servidor (ou o Ward não está nele).", { status: 403 });
      }

      let salvo = false;
      if (request.method === "POST") {
        const dados = await request.formData();
        const horaRotacao = dados.get("rotation_daily_hour");
        await salvarConfig(env, guildId, {
          patch_enabled: dados.get("patch_enabled") === "on",
          patch_channel_id: dados.get("patch_channel_id") || null,
          news_enabled: dados.get("news_enabled") === "on",
          news_channel_id: dados.get("news_channel_id") || null,
          rotation_enabled: dados.get("rotation_enabled") === "on",
          rotation_channel_id: dados.get("rotation_channel_id") || null,
          rotation_daily_hour: horaRotacao ? Number(horaRotacao) : null,
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
        buscarNoticias().catch((err) => {
          console.log("Não carreguei a prévia de notícias:", err.message);
          return [];
        }),
      ]);
      const status = url.searchParams.get("status");
      return paginaHtml(
        `Configurar — ${servidor.name}`,
        formularioConfig(servidor, config, canais, salvo, status, noticias)
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
    ctx.waitUntil(
      (async () => {
        const patch = await checarPatch(env).catch((err) => ({ erro: err.message }));
        const noticias = await checarNoticias(env).catch((err) => ({ erro: err.message }));
        const rotacao = await checarRotacao(env).catch((err) => ({ erro: err.message }));
        const diarias = await checarPostagensDiarias(env).catch((err) => ({ erro: err.message }));
        console.log("cron:", JSON.stringify({ patch, noticias, rotacao, diarias }));
      })()
    );
  },
};

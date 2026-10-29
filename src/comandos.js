// Slash commands globais — funcionam em qualquer servidor onde o Ward
// estiver, sem precisar registrar servidor a servidor.

import { RESPOSTA, EFEMERA, editarResposta, mapaDeEmojis, emoji } from "./discord.js";
import {
  versaoAtual,
  resumoPatchEmIngles,
  LINK_NOTAS_PATCH,
  todosOsCampeoes,
  acharCampeao,
  normalizarNome,
  urlIconeCampeao,
} from "./riot.js";
import { traduzirParaPtBr } from "./traducao.js";
import { MODOS, ROTAS, montarBuild, dadosDoJogo, patchPublico } from "./builds.js";

export const DEFINICOES = [
  { name: "patch", description: "Mostra a versão mais recente do League of Legends" },
  {
    name: "build",
    description: "A build que mais ganha no meta atual para um campeão",
    options: [
      { type: 3, name: "campeao", description: "Campeão", required: true, autocomplete: true },
      {
        type: 3,
        name: "modo",
        description: "Modo de jogo (padrão: ranqueada)",
        required: false,
        choices: Object.entries(MODOS).map(([valor, m]) => ({ name: m.nome, value: valor })),
      },
      {
        type: 3,
        name: "rota",
        description: "Rota na ranqueada (padrão: a mais jogada com o campeão)",
        required: false,
        choices: Object.entries(ROTAS).map(([valor, nome]) => ({ name: nome, value: valor })),
      },
    ],
  },
  { name: "dashboard", description: "Link pra configurar o Ward neste servidor" },
];

const opcao = (interacao, nome) => interacao.data.options?.find((o) => o.name === nome)?.value;

export const porcentagem = (taxa) => `${(taxa * 100).toFixed(1).replace(".", ",")}%`;
const milhar = (n) => n.toLocaleString("pt-BR");

// Item repetido vira "2× Poção" em vez de aparecer duas vezes.
function contarIguais(ids) {
  const contagem = new Map();
  for (const id of ids) contagem.set(id, (contagem.get(id) ?? 0) + 1);
  return [...contagem.entries()];
}

// O embed do /build. Fica separado do comando pra poder ser reaproveitado
// (e testado) sem uma interação de verdade.
export function embedDaBuild({ campeao, build, dados, emojis, versao, origin }) {
  const nomeItem = (id) => dados.itens[id]?.nome ?? `Item ${id}`;
  const item = (id) => `${emoji(emojis, `i${id}`)} ${nomeItem(id)}`.trim();
  const runa = (id) => `${emoji(emojis, `r${id}`)} ${dados.runas[id]?.nome ?? id}`.trim();
  const feitico = (key) => `${emoji(emojis, `s${key}`)} ${dados.feiticos[key]?.nome ?? key}`.trim();
  const estatistica = (op) => `-# ${porcentagem(op.taxa)} de vitória · ${milhar(op.jogos)} partidas`;

  const campos = [];
  if (build.inicio) {
    const itens = contarIguais(build.inicio.chave.split(",").map(Number))
      .map(([id, n]) => `${n > 1 ? `${n}× ` : ""}${item(id)}`)
      .join("\n");
    campos.push({ name: "Itens iniciais", value: itens, inline: true });
  }
  if (build.botas) {
    campos.push({ name: "Botas", value: `${item(build.botas.chave)}\n${estatistica(build.botas)}`, inline: true });
  }
  if (build.nucleo) {
    campos.push({
      name: "Build principal",
      value: `${build.nucleo.itens.map(item).join("  ➜  ")}\n${estatistica(build.nucleo)}`,
    });
  }
  if (build.extras.length) {
    campos.push({
      name: "Do 4º item em diante",
      value: build.extras
        .map((e) => `${item(e.id)} · ${porcentagem(e.taxa)} em ${milhar(e.jogos)}`)
        .join("\n"),
    });
  }
  if (build.runas) {
    const r = build.runas;
    campos.push({
      name: "Runas",
      value:
        `**${dados.runas[r.primario]?.nome ?? ""}:** ${r.runasPrimarias.map(runa).join(" · ")}\n` +
        `**${dados.runas[r.secundario]?.nome ?? ""}:** ${r.runasSecundarias.map(runa).join(" · ")}\n` +
        `**Fragmentos:** ${r.fragmentos.join(" · ")}\n${estatistica(r)}`,
    });
  }
  if (build.feiticos) {
    campos.push({ name: "Feitiços", value: build.feiticos.chave.split(",").map(feitico).join("\n"), inline: true });
  }
  if (build.habilidades) {
    const h = build.habilidades;
    campos.push({
      name: "Habilidades",
      value: `Maximizar **${h.ordem.replace(/>/g, " > ")}**${h.primeiras ? `\nComeça ${h.primeiras.split("").join(" → ")}` : ""}`,
      inline: true,
    });
  }

  const modo = MODOS[build.fila];
  const rota = build.rota ? ` · ${ROTAS[build.rota] ?? build.rota}` : "";
  const outras = build.rotas
    .filter((r) => r.rota && r.rota !== build.rota && r.jogos >= 20)
    .map((r) => ROTAS[r.rota] ?? r.rota);
  const patches = build.patches.map(patchPublico).join(" e ");
  const link = `${origin}/build/${encodeURIComponent(campeao.arquivoImagem)}?modo=${build.fila}${
    build.rota ? `&rota=${build.rota}` : ""
  }`;

  return {
    title: `${campeao.nome}${rota} · ${modo.nome}`,
    url: link,
    color: 0xc8a24a,
    thumbnail: { url: urlIconeCampeao(versao, campeao.arquivoImagem) },
    description:
      `**${porcentagem(build.taxa)}** de vitória em **${milhar(build.jogos)}** partidas de Grão-Mestre+ no BR.` +
      (outras.length ? `\nTambém jogado em: ${outras.join(", ")} — use a opção \`rota\`.` : ""),
    fields: campos,
    footer: { text: `Patch ${patches} · atualiza sozinho conforme o meta` },
  };
}

export const COMANDOS = {
  // Busca o resumo oficial do patch e traduz — duas chamadas de rede além da
  // versão, por isso adiado (não cabe no prazo de 3s do ACK).
  patch: {
    adiar: true,
    efemera: false,
    async executar(env, interacao) {
      const versao = await versaoAtual();
      try {
        const { url, resumo } = await resumoPatchEmIngles(versao);
        const resumoPt = await traduzirParaPtBr(env, resumo);
        await editarResposta(interacao, {
          embeds: [{ title: `Patch ${versao}`, url, description: resumoPt, color: 0x0ac8b9 }],
        });
      } catch (err) {
        console.log("Falha em /patch ao buscar o resumo:", err.message);
        await editarResposta(interacao, {
          embeds: [
            {
              title: `Patch ${versao}`,
              url: LINK_NOTAS_PATCH,
              description: "Não consegui buscar o resumo agora — clica no título pra ver as notas completas.",
              color: 0x0ac8b9,
            },
          ],
        });
      }
    },
  },

  // Lê do banco o que a coleta já juntou (ver builds.js) — não chama a Riot
  // na hora. Adiado mesmo assim porque agrega alguns milhares de linhas e
  // ainda lista os emojis.
  build: {
    adiar: true,
    efemera: false,
    async executar(env, interacao, origin) {
      const texto = opcao(interacao, "campeao");
      const fila = Number(opcao(interacao, "modo") ?? 420);
      const rota = opcao(interacao, "rota");

      const campeao = await acharCampeao(env, texto);
      if (!campeao) {
        await editarResposta(interacao, { content: `Não achei nenhum campeão chamado "${texto}".` });
        return;
      }

      const versao = await versaoAtual();
      const [build, dados, emojis] = await Promise.all([
        montarBuild(env, campeao.id, fila, rota),
        dadosDoJogo(env, versao),
        // Sem emoji a build sai só com os nomes — não vale derrubar a resposta.
        mapaDeEmojis(env).catch((err) => {
          console.log("Não carreguei os emojis:", err.message);
          return null;
        }),
      ]);

      if (!build || !build.jogos) {
        await editarResposta(interacao, {
          content:
            `Ainda estou juntando partidas de **${campeao.nome}** em ${MODOS[fila].nome}. ` +
            "A coleta roda sozinha o tempo todo — tenta de novo daqui a pouco.",
        });
        return;
      }

      await editarResposta(interacao, {
        embeds: [embedDaBuild({ campeao, build, dados, emojis, versao, origin })],
      });
    },

    // Sugestões enquanto a pessoa digita. Tem que responder em menos de 3s,
    // então só usa o roster já em cache (memória ou banco).
    async autocompletar(env, interacao) {
      const digitado = normalizarNome(interacao.data.options?.find((o) => o.focused)?.value);
      const campeoes = await todosOsCampeoes(env, await versaoAtual());
      const sugestoes = campeoes
        .filter((c) => !digitado || normalizarNome(c.nome).includes(digitado))
        .sort((a, b) => {
          // Quem começa com o que foi digitado vem primeiro.
          const ca = normalizarNome(a.nome).startsWith(digitado) ? 0 : 1;
          const cb = normalizarNome(b.nome).startsWith(digitado) ? 0 : 1;
          return ca - cb || a.nome.localeCompare(b.nome, "pt-BR");
        })
        .slice(0, 25)
        .map((c) => ({ name: c.nome, value: c.arquivoImagem }));
      return { type: RESPOSTA.SUGESTOES, data: { choices: sugestoes } };
    },
  },

  dashboard: {
    adiar: false,
    async executar(env, interacao, origin) {
      return {
        type: RESPOSTA.MENSAGEM,
        data: {
          content: `Configura o Ward neste servidor por aqui: ${origin}/dashboard/${interacao.guild_id}`,
          flags: EFEMERA,
        },
      };
    },
  },
};

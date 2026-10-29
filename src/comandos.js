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
import { MODOS, ROTAS, FRAGMENTOS, buscarBuild, dadosDoJogo } from "./builds.js";

const CAMPEAO = { type: 3, name: "campeao", description: "Campeão", required: true, autocomplete: true };
const ROTA = {
  type: 3,
  name: "rota",
  description: "Rota (padrão: a mais jogada com o campeão)",
  required: false,
  choices: Object.entries(ROTAS).map(([valor, nome]) => ({ name: nome, value: valor })),
};

export const DEFINICOES = [
  { name: "patch", description: "Mostra a versão mais recente do League of Legends" },
  {
    name: "build",
    description: "A build que mais ganha no meta atual para um campeão",
    // Um subcomando por modo: o Discord não esconde opção dinamicamente, e o
    // ARAM não tem rota — então ele é um subcomando sem a opção "rota".
    options: [
      { type: 1, name: "ranqueada", description: "Build na Ranqueada Solo/Duo", options: [CAMPEAO, ROTA] },
      { type: 1, name: "flex", description: "Build na Ranqueada Flex", options: [CAMPEAO, ROTA] },
      { type: 1, name: "aram", description: "Build no ARAM", options: [CAMPEAO] },
    ],
  },
  { name: "dashboard", description: "Link pra configurar o Ward neste servidor" },
];

// Modo de cada subcomando do /build.
const MODO_DO_SUBCOMANDO = { ranqueada: "ranked", flex: "flex", aram: "aram" };

// As opções chegam aninhadas dentro do subcomando: options[0] = { name:
// "aram", options: [{ name: "campeao", value: "Fizz" }] }.
const subcomando = (interacao) => interacao.data.options?.[0];
const opcao = (interacao, nome) => subcomando(interacao)?.options?.find((o) => o.name === nome)?.value;

export const porcentagem = (taxa) => `${(taxa * 100).toFixed(1).replace(".", ",")}%`;
const milhar = (n) => n.toLocaleString("pt-BR");

// Número público do patch (o Data Dragon fica 10 atrás: 16.21 = 26.21).
export function patchPublico(versao) {
  const [major, minor] = String(versao).split(".");
  return `${Number(major) + 10}.${minor}`;
}

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
    const itens = contarIguais(build.inicio.ids)
      .map(([id, n]) => `${n > 1 ? `${n}× ` : ""}${item(id)}`)
      .join("\n");
    campos.push({ name: "Itens iniciais", value: itens, inline: true });
  }
  if (build.botas) {
    campos.push({ name: "Botas", value: `${build.botas.ids.map(item).join("\n")}\n${estatistica(build.botas)}`, inline: true });
  }
  if (build.nucleo) {
    campos.push({
      name: "Build principal",
      value: `${build.nucleo.ids.map(item).join("  ➜  ")}\n${estatistica(build.nucleo)}`,
    });
  }
  ["4º item", "5º item", "6º item"].forEach((titulo, i) => {
    const lista = build.extras[i] ?? [];
    if (!lista.length) return;
    campos.push({
      name: `${titulo} (opções)`,
      value: lista.map((o) => `${o.ids.map(item).join(" + ")} · ${porcentagem(o.taxa)}`).join("\n"),
      inline: true,
    });
  });
  if (build.runas) {
    const r = build.runas;
    campos.push({
      name: "Runas",
      value:
        `**${dados.runas[r.primario]?.nome ?? ""}:** ${r.runasPrimarias.map(runa).join(" · ")}\n` +
        `**${dados.runas[r.secundario]?.nome ?? ""}:** ${r.runasSecundarias.map(runa).join(" · ")}\n` +
        `**Fragmentos:** ${r.fragmentos.map((id) => FRAGMENTOS[id] ?? id).join(" · ")}\n${estatistica(r)}`,
    });
  }
  if (build.feiticos) {
    campos.push({ name: "Feitiços", value: build.feiticos.ids.map(feitico).join("\n"), inline: true });
  }
  if (build.habilidades) {
    const h = build.habilidades;
    campos.push({
      name: "Habilidades",
      value:
        `Maximizar **${h.ordem.replace(/>/g, " > ")}**` +
        (h.sequencia ? `\n\`${h.sequencia.split("").join(" ")}\`` : "") +
        `\n${estatistica(h)}`,
      inline: true,
    });
  }

  const modo = MODOS[build.modo];
  const rota = build.rota ? ` · ${ROTAS[build.rota] ?? build.rota}` : "";
  // Outras rotas só aparecem se forem jogadas de verdade (5% das partidas).
  const total = build.rotas.reduce((s, r) => s + r.jogos, 0);
  const outras = build.rotas
    .filter((r) => ROTAS[r.rota] && r.rota !== build.rota && r.jogos >= total * 0.05)
    .map((r) => ROTAS[r.rota]);
  const link = `${origin}/build/${encodeURIComponent(campeao.arquivoImagem)}?modo=${build.modo}${
    build.rota ? `&rota=${build.rota}` : ""
  }`;

  return {
    title: `${campeao.nome}${rota} · ${modo.nome}`,
    url: link,
    color: 0xc8a24a,
    thumbnail: { url: urlIconeCampeao(versao, campeao.arquivoImagem) },
    description:
      `**${porcentagem(build.taxa)}** de vitória em **${milhar(build.jogos)}** partidas` +
      (build.tier ? ` · Tier ${build.tier}` : "") +
      (outras.length ? `\nTambém jogado em: ${outras.join(", ")} — use a opção \`rota\`.` : ""),
    fields: campos,
    footer: { text: `Dados: OP.GG · patch ${patchPublico(versao)} · atualiza sozinho conforme o meta` },
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

  // Busca no OP.GG (ou no cache de 6h — ver buscarBuild). Adiado porque a
  // API deles leva uns 4 segundos quando a build não está em cache.
  build: {
    adiar: true,
    efemera: false,
    async executar(env, interacao, origin) {
      const texto = opcao(interacao, "campeao");
      const modo = MODO_DO_SUBCOMANDO[subcomando(interacao)?.name] ?? "ranked";
      const rota = modo === "aram" ? undefined : opcao(interacao, "rota");

      const campeao = await acharCampeao(env, texto);
      if (!campeao) {
        await editarResposta(interacao, { content: `Não achei nenhum campeão chamado "${texto}".` });
        return;
      }

      const versao = await versaoAtual();
      let build;
      try {
        build = await buscarBuild(env, campeao, modo, rota);
      } catch (err) {
        await editarResposta(interacao, {
          content: "Não consegui buscar a build agora (o OP.GG não respondeu). Tenta de novo em instantes.",
        });
        return;
      }
      const [dados, emojis] = await Promise.all([
        dadosDoJogo(env, versao),
        // Sem emoji a build sai só com os nomes — não vale derrubar a resposta.
        mapaDeEmojis(env).catch((err) => {
          console.log("Não carreguei os emojis:", err.message);
          return null;
        }),
      ]);

      if (!build || !build.jogos) {
        const onde = rota ? ` na rota ${ROTAS[rota]}` : "";
        await editarResposta(interacao, {
          content: `Não há partidas suficientes de **${campeao.nome}**${onde} em ${MODOS[modo].nome} neste patch.`,
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
      const digitado = normalizarNome(subcomando(interacao)?.options?.find((o) => o.focused)?.value);
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

// Slash commands globais — funcionam em qualquer servidor onde o Ward
// estiver, sem precisar registrar servidor a servidor.

import { RESPOSTA, EFEMERA, editarResposta, mensagemComIcones } from "./discord.js";
import { versaoAtual, resumoPatchEmIngles, LINK_NOTAS_PATCH, rotacaoAtual } from "./riot.js";
import { traduzirParaPtBr } from "./traducao.js";

export const DEFINICOES = [
  { name: "patch", description: "Mostra a versão mais recente do League of Legends" },
  { name: "rotacao", description: "Mostra a rotação semanal de campeões grátis" },
  { name: "dashboard", description: "Link pra configurar o Ward neste servidor" },
];

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

  // Depende da chave da Riot, que pode estar vencida — por isso a resposta
  // é adiada (dá tempo da chamada falhar sem estourar o prazo de 3s do ACK).
  rotacao: {
    adiar: true,
    efemera: false,
    async executar(env, interacao) {
      try {
        const campeoes = await rotacaoAtual(env);
        const texto = await mensagemComIcones(env, campeoes, "**Rotação grátis da semana:**");
        await editarResposta(interacao, { content: texto });
      } catch (err) {
        console.log("Falha em /rotacao:", err.message);
        await editarResposta(interacao, {
          content: "Rotação indisponível no momento (a chave da Riot deve estar vencida). Tenta mais tarde.",
        });
      }
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

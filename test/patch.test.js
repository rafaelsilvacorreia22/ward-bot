// Aviso de patch: leitura da página oficial das notas (salva em
// test/exemplos, patch 26.22) e montagem do post.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerNotas, mensagemDoPatch, camadasDaArte, urlNotasPt } from "../src/patchnotes.js";
import { versaoPublica } from "../src/riot.js";
import { FLAG_V2 } from "../src/visual.js";

const html = readFileSync(new URL("./exemplos/notas-patch-26-22.html", import.meta.url), "utf8");
const notas = lerNotas(html);

test("número do patch: Data Dragon 16.x vira 26.x", () => {
  assert.equal(versaoPublica("16.22.1"), "26.22.1");
  assert.equal(versaoPublica("16.3.1"), "26.3.1");
  assert.equal(urlNotasPt("16.22.1"), "https://www.leagueoflegends.com/pt-br/news/game-updates/league-of-legends-patch-26-22-notes/");
});

test("introdução é o texto da equipe, sem o versinho nem o 'errou as notas'", () => {
  assert.match(notas.intro, /^Esperamos que todo mundo/);
  assert.doesNotMatch(notas.intro, /Errou as Notas|designer de jogos/);
});

test("lê os campeões, com a tecla alterada e a primeira mudança", () => {
  assert.equal(notas.campeoes.length, 14);
  const corki = notas.campeoes.find((c) => c.nome === "Corki");
  assert.deepEqual(corki.partes, ["R"]);
  assert.match(corki.linha, /^Dano: 90\/170\/250/);
  assert.deepEqual(notas.campeoes.find((c) => c.nome === "Mel").partes, ["atributos", "Passiva", "Q", "W", "E", "R"]);
});

test("lê os itens com a primeira mudança, sem espaço antes dos dois-pontos", () => {
  assert.deepEqual(
    notas.itens.map((i) => [i.nome, i.linha]),
    [
      ["Arco de Doran", "Dano de Ataque: 8 ⇒ 7"],
      ["Armadura Sangrenta do Suserano", "Dano de Ataque: 30 ⇒ 40"],
    ]
  );
});

test("skins novas sem cromas e com a arte", () => {
  assert.equal(notas.skins.length, 4);
  assert.ok(notas.skins.every((s) => !/\)\s*$/.test(s.nome)));
  assert.ok(notas.skins.every((s) => s.imagem.startsWith("https://cmsassets.rgpub.io/")));
  assert.match(notas.destaques, /^https:\/\/cmsassets\.rgpub\.io\//);
});

test("post do patch cabe nos limites do Discord", () => {
  const corpo = mensagemDoPatch("16.22.1", { url: urlNotasPt("16.22.1"), ...notas });
  assert.equal(corpo.flags, FLAG_V2);
  const pecas = corpo.components[0].components;
  assert.ok(pecas.length <= 40, "no máximo 40 peças");
  const textoTotal = pecas.filter((p) => p.type === 10).reduce((t, p) => t + p.content.length, 0);
  assert.ok(textoTotal <= 4000, `texto ${textoTotal} > 4000`);
  assert.match(pecas[0].items[0].media.url, /\/arte\/patch\/26\.22\.jpg\?fundo=/);
  assert.match(pecas[1].content, /^# Patch 26\.22\n> Esperamos/);
});

test("arte do patch: camada de fundo e um algarismo por caractere", () => {
  const camadas = camadasDaArte("https://x", "26.22");
  assert.equal(camadas.length, 6);
  assert.equal(camadas[0].url, "https://x/arte/patch-base.png");
  assert.deepEqual(
    camadas.slice(1).map((c) => [c.url.split("/").pop(), c.left]),
    [
      ["d2.png", 423],
      ["d6.png", 499],
      ["dponto.png", 575],
      ["d2.png", 614],
      ["d2.png", 690],
    ]
  );
});

test("página sem o conteúdo esperado não quebra", () => {
  const vazia = lerNotas("<html><head></head><body>nada</body></html>");
  assert.deepEqual(vazia.campeoes, []);
  assert.equal(vazia.destaques, null);
});

// Aviso de patch: leitura da página oficial das notas (salva em
// test/exemplos, patch 26.22) e montagem do post.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerNotas, mensagensDoPatch, camadasDaArte, urlNotasPt } from "../src/patchnotes.js";
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

const textoDe = (msg) =>
  msg.components[0].components
    .filter((p) => p.type === 10)
    .map((p) => p.content)
    .join("\n");

test("post do patch: cada mensagem cabe nos limites do Discord", () => {
  const msgs = mensagensDoPatch("16.22.1", { url: urlNotasPt("16.22.1"), ...notas });
  assert.ok(msgs.length >= 1);
  for (const m of msgs) {
    assert.equal(m.flags, FLAG_V2);
    assert.ok(m.components[0].components.length <= 40, "no máximo 40 peças");
    assert.ok(textoDe(m).length <= 4000, `texto ${textoDe(m).length} > 4000`);
  }
  const primeira = msgs[0].components[0].components;
  assert.match(primeira[0].items[0].media.url, /\/arte\/patch\/26\.22\.jpg\?fundo=/);
  assert.match(primeira[1].content, /^# Patch 26\.22\n> Esperamos/);
  assert.match(JSON.stringify(msgs[msgs.length - 1]), /Ler as notas completas/);
});

test("mudanças aparecem inteiras, sem reticências", () => {
  const tudo = mensagensDoPatch("16.22.1", { url: urlNotasPt("16.22.1"), ...notas }).map(textoDe).join("\n");
  for (const c of notas.campeoes) assert.ok(tudo.includes(c.linha), `${c.nome}: mudança cortada`);
  assert.ok(!/-# [^\n]*…/.test(tudo), "nenhuma linha de mudança terminando em …");
});

test("muitas mudanças longas continuam na mensagem seguinte, sem perder ninguém", () => {
  const longa = "Dano: " + "10/20/30/40/50 (+ 60% do PdH) ".repeat(8) + "⇒ 1/2/3";
  const campeoes = Array.from({ length: 24 }, (_, i) => ({ nome: `Campeão ${i + 1}`, partes: ["Q"], tecla: "Q", linha: longa }));
  const msgs = mensagensDoPatch("16.22.1", { ...notas, campeoes, url: urlNotasPt("16.22.1") });
  assert.ok(msgs.length >= 2, "precisa dividir");
  const tudo = msgs.map(textoDe).join("\n");
  for (let i = 1; i <= 24; i++) assert.ok(tudo.includes(`**Campeão ${i}**`), `sumiu o campeão ${i}`);
  assert.match(tudo, /## Campeões \(continuação\)/);
  for (const m of msgs) assert.ok(textoDe(m).length <= 4000);
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

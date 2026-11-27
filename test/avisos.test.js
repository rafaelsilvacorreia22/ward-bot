// Montagem dos avisos (promoções, skins novas, vídeo) e as peças do layout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mensagemPromocoes, mensagensSkinsNovas, mensagemVideo, assinaturaPromocoes, urlSplashSkin } from "../src/avisos.js";
import { mensagemEmBloco, texto, divisoria, galeria, resumir, FLAG_V2 } from "../src/visual.js";

const promo = [
  { nome: "Ahri Dinastia", skinId: 103001, arquivoCampeao: "Ahri", preco: 390, precoCheio: 975, desconto: 60, termina: "2026-11-29T09:00:00+09:00" },
  { nome: "Lux Feiticeira", skinId: 99001, arquivoCampeao: "Lux", preco: 487, precoCheio: 975, desconto: 50, termina: "2026-11-29T09:00:00+09:00" },
];

test("arte da skin no Data Dragon", () => {
  assert.equal(urlSplashSkin("Ahri", 103015), "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_15.jpg");
});

test("assinatura das promoções não depende da ordem", () => {
  assert.equal(assinaturaPromocoes(promo), assinaturaPromocoes([...promo].reverse()));
  assert.match(assinaturaPromocoes(promo), /^99001,103001@/);
});

test("post de promoções: preço riscado, data de fim e botão para a página", () => {
  const corpo = mensagemPromocoes(promo);
  const json = JSON.stringify(corpo);
  assert.equal(corpo.flags, FLAG_V2);
  assert.match(json, /~~975~~ \*\*390 RP\*\*/);
  assert.match(json, /<t:\d+:D>/);
  assert.match(json, /https:\/\/wardbot\.com\.br\/promocoes/);
});

test("skins novas: croma fica de fora, uma mensagem só", () => {
  const msgs = mensagensSkinsNovas([
    { skinId: 103001, nome: "Ahri Dinastia", arquivoCampeao: "Ahri" },
    { skinId: 103002, nome: "Ahri Dinastia (Rubi)", arquivoCampeao: "Ahri" },
  ]);
  assert.equal(msgs.length, 1);
  const json = JSON.stringify(msgs[0]);
  assert.match(json, /Skin nova no jogo!/);
  assert.doesNotMatch(json, /Rubi/);
  assert.deepEqual(mensagensSkinsNovas([{ skinId: 1, nome: "X (Rubi)", arquivoCampeao: "X" }]), []);
});

test("vídeo: capa, título e botão para o YouTube", () => {
  const json = JSON.stringify(mensagemVideo({ id: "abc123def45", titulo: "Trailer" }));
  assert.match(json, /i\.ytimg\.com\/vi\/abc123def45\/maxresdefault\.jpg/);
  assert.match(json, /## Trailer/);
  assert.match(json, /watch\?v=abc123def45/);
});

test("bloco: descarta peças vazias e divisórias sobrando", () => {
  const corpo = mensagemEmBloco(0x123, [divisoria(), null, texto("a"), divisoria(), divisoria(), galeria([]), texto("b"), divisoria()]);
  assert.deepEqual(
    corpo.components[0].components.map((p) => p.type),
    [10, 14, 10]
  );
  assert.equal(corpo.components[0].accent_color, 0x123);
});

test("resumir corta no fim da frase", () => {
  assert.equal(resumir("Primeira frase aqui. Segunda frase bem maior que o limite.", 30), "Primeira frase aqui.");
  assert.equal(resumir("curto", 30), "curto");
});

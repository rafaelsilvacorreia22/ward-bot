// Regras do contador de acessos e da marcação de cargo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { comCargo, ehRobo, caminhoParaContar, origemDaVisita } from "../src/regras.js";
import { FLAG_V2 } from "../src/visual.js";

const pedido = (ua, org = "") => ({ headers: new Headers(ua ? { "User-Agent": ua } : {}), cf: { asOrganization: org } });
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";

test("cargo: no layout novo vai num texto antes do bloco, e só ele pode ser marcado", () => {
  const corpo = comCargo({ flags: FLAG_V2, components: [{ type: 17 }] }, "123456789012345678");
  assert.deepEqual(corpo.components[0], { type: 10, content: "<@&123456789012345678>" });
  assert.equal(corpo.components.length, 2);
  assert.deepEqual(corpo.allowed_mentions, { parse: [], roles: ["123456789012345678"] });
});

test("cargo: em mensagem de texto vai no começo", () => {
  assert.equal(comCargo({ content: "oi" }, "123456789012345678").content, "<@&123456789012345678> oi");
});

test("cargo: vazio ou inválido não mexe na mensagem", () => {
  const corpo = { content: "oi" };
  assert.equal(comCargo(corpo, null), corpo);
  assert.equal(comCargo(corpo, "@everyone"), corpo);
  assert.equal(comCargo(corpo, "12"), corpo);
});

test("robôs ficam de fora da contagem", () => {
  assert.equal(ehRobo(pedido(CHROME)), false);
  assert.equal(ehRobo(pedido("Googlebot/2.1")), true);
  assert.equal(ehRobo(pedido("Mozilla/5.0 (compatible; Discordbot/2.0)")), true);
  assert.equal(ehRobo(pedido(null)), true);
  assert.equal(ehRobo(pedido(CHROME, "Amazon.com, Inc.")), true);
  assert.equal(ehRobo(pedido(CHROME, "Claro S.A.")), false);
});

test("só páginas que existem entram na conta", () => {
  assert.equal(caminhoParaContar("/"), "/");
  assert.equal(caminhoParaContar("/promocoes"), "/promocoes");
  assert.equal(caminhoParaContar("/build/Fizz"), "/build/Fizz");
  assert.equal(caminhoParaContar("/dashboard/1049008778588201111"), "/dashboard/servidor");
  assert.equal(caminhoParaContar("/admin/uso"), null);
  assert.equal(caminhoParaContar("/qualquer-coisa"), null);
  assert.equal(caminhoParaContar(42), null);
});

test("origem: etiqueta ?ref= primeiro, depois o site anterior", () => {
  assert.equal(origemDaVisita("?ref=TikTok", "https://www.google.com/"), "tiktok");
  assert.equal(origemDaVisita("?utm_source=reddit", ""), "reddit");
  assert.equal(origemDaVisita("", "https://www.google.com.br/search"), "google");
  assert.equal(origemDaVisita("", "https://discord.com/channels/1/2"), "discord");
  assert.equal(origemDaVisita("", "https://wardbot.com.br/build"), "direto");
  assert.equal(origemDaVisita("", ""), "direto");
  assert.equal(origemDaVisita("", "nao-e-url"), "direto");
});

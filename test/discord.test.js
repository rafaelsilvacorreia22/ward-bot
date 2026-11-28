// Chamadas ao Discord: espera e tenta de novo quando ele pede calma (429).
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, listarServidoresDoBot } from "../src/discord.js";

const env = { DISCORD_TOKEN: "x" };
const resposta = (status, corpo) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

test("429 curto: espera e tenta de novo, sem erro", async (t) => {
  let chamadas = 0;
  t.mock.method(globalThis, "fetch", async () => (++chamadas === 1 ? resposta(429, { retry_after: 0.05 }) : resposta(200, { ok: 1 })));
  assert.deepEqual(await api(env, "/teste"), { ok: 1 });
  assert.equal(chamadas, 2);
});

test("429 longo: não fica esperando, devolve o erro", async (t) => {
  t.mock.method(globalThis, "fetch", async () => resposta(429, { retry_after: 30 }));
  await assert.rejects(api(env, "/teste"), /429/);
});

test("lista de servidores do bot fica 30 s em memória", async (t) => {
  let chamadas = 0;
  t.mock.method(globalThis, "fetch", async () => {
    chamadas++;
    return resposta(200, [{ id: "1", name: "A" }]);
  });
  await listarServidoresDoBot(env);
  await listarServidoresDoBot(env);
  await listarServidoresDoBot(env);
  assert.equal(chamadas, 1);
});

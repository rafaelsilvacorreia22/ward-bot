// Painel de uso (/admin/uso): tem que abrir mesmo sem dado nenhum, e mostrar
// o dono e os sinais de servidor suspeito quando houver.
import { test } from "node:test";
import assert from "node:assert/strict";
import { paginaUso } from "../src/paginas.js";

test("abre sem estatísticas, sem servidores e sem detalhes", () => {
  const html = paginaUso([], [], [], {});
  assert.match(html, /Painel do Ward/);
  assert.match(html, /Não consegui carregar as estatísticas/);
});

test("servidor suspeito vem primeiro, com o perfil do dono e sem convite", () => {
  const recente = new Date(Date.now() - 2 * 86400000).toISOString();
  const servidores = [
    { id: "100000000000000001", name: "Grande", approximate_member_count: 500 },
    { id: "100000000000000002", name: "Suspeito <b>", approximate_member_count: 2 },
  ];
  const info = new Map([
    ["100000000000000002", { criado: recente, online: 0, membros: 2, dono: { id: "200000000000000000", usuario: "novo", nome: "Novo", criado: recente } }],
  ]);
  const html = paginaUso(servidores, [], [], { infoServidores: info });
  assert.ok(html.indexOf("Suspeito") < html.indexOf("Grande"), "suspeito primeiro");
  assert.match(html, /Suspeito &lt;b&gt;/, "nome do servidor escapado");
  assert.match(html, /discord\.com\/users\/200000000000000000/);
  assert.match(html, /servidor criado há menos de 7 dias/);
  assert.match(html, /sem convite público/);
});

test("servidor com endereço público ganha o botão de entrar", () => {
  const html = paginaUso([{ id: "100000000000000003", name: "Aberto", approximate_member_count: 50 }], [], [], {
    infoServidores: new Map([["100000000000000003", { convite: "aberto", membros: 50, online: 10, dono: { id: "3" } }]]),
  });
  assert.match(html, /discord\.gg\/aberto/);
});

test("formulário do servidor salva sozinho, sem depender do botão Salvar", async () => {
  const { formularioConfig } = await import("../src/paginas.js");
  const html = formularioConfig({ id: "100000000000000009", name: "X" }, { guild_id: "1" }, [], false, null, [], []);
  assert.match(html, /"X-Autosave": "1"/);
  assert.match(html, /addEventListener\("change"/);
  assert.match(html, /id="toast-salvo"/);
  // continua funcionando sem JavaScript
  assert.match(html, /<button class="botao" type="submit">Salvar<\/button>/);
});

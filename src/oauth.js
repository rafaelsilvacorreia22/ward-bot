// Login "Entrar com Discord" pro dashboard: troca de code por token, sessão
// assinada (HMAC, sem access token da Discord dentro — as páginas de config
// só usam o token do bot, nunca o do usuário) e o cookie de state que
// protege o callback contra CSRF.

const COOKIE_SESSAO = "ward_sessao";
const COOKIE_STATE = "ward_state";

async function chaveHmac(segredo) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function paraBase64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function deBase64Url(texto) {
  const b64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}

async function assinar(env, payload) {
  const chave = await chaveHmac(env.SESSION_SECRET);
  const texto = paraBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(texto));
  return `${texto}.${paraBase64Url(assinatura)}`;
}

// Cookie estragado (base64 inválido, formato antigo, truncado) não pode
// derrubar a página: qualquer problema aqui vale como "não está logado".
async function verificar(env, valor) {
  if (!valor) return null;
  try {
    const [texto, assinatura] = valor.split(".");
    if (!texto || !assinatura) return null;
    const chave = await chaveHmac(env.SESSION_SECRET);
    const ok = await crypto.subtle.verify("HMAC", chave, deBase64Url(assinatura), new TextEncoder().encode(texto));
    if (!ok) return null;
    return JSON.parse(new TextDecoder().decode(deBase64Url(texto)));
  } catch {
    return null;
  }
}

function pegarCookie(request, nome) {
  const cabecalho = request.headers.get("Cookie") ?? "";
  const par = cabecalho
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${nome}=`));
  return par ? decodeURIComponent(par.slice(nome.length + 1)) : null;
}

export function iniciarLogin(env, origin) {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: `${origin}/auth/callback`,
    response_type: "code",
    scope: "identify guilds",
    state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://discord.com/oauth2/authorize?${params}`,
      "Set-Cookie": `${COOKIE_STATE}=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`,
    },
  });
}

export async function tratarCallback(env, request, origin) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateEsperado = pegarCookie(request, COOKIE_STATE);

  if (!code || !state || !stateEsperado || state !== stateEsperado) {
    return new Response("Login inválido ou expirado, tenta de novo.", { status: 400 });
  }

  const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin}/auth/callback`,
    }),
  });
  if (!tokenRes.ok) {
    return new Response("Não consegui confirmar o login com o Discord.", { status: 400 });
  }
  const { access_token } = await tokenRes.json();

  const [usuarioRes, guildsRes] = await Promise.all([
    fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    }),
    fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bearer ${access_token}` },
    }),
  ]);

  // Sem esta checagem, um 429 (limite de requisições) do Discord devolveria um
  // objeto de erro em vez de lista, e o .filter abaixo estouraria numa exceção
  // não tratada — que o visitante veria como a tela branca "Error 1101".
  if (!usuarioRes.ok || !guildsRes.ok) {
    console.log("Discord recusou os dados do login:", usuarioRes.status, guildsRes.status);
    return new Response("O Discord não respondeu agora. Tenta entrar de novo em instantes.", {
      status: 503,
    });
  }

  const usuario = await usuarioRes.json();
  const guildsDoUsuario = await guildsRes.json();
  if (!Array.isArray(guildsDoUsuario)) {
    console.log("Lista de servidores em formato inesperado:", JSON.stringify(guildsDoUsuario).slice(0, 200));
    return new Response("Não consegui ler seus servidores agora. Tenta entrar de novo.", { status: 503 });
  }

  // "permissions" vem como string (cabe mais de 32 bits) — precisa BigInt.
  const gerenciados = guildsDoUsuario
    .filter((g) => g.owner || (BigInt(g.permissions ?? 0) & 0x20n) !== 0n)
    .map((g) => g.id);

  const sessao = await assinar(env, {
    usuario_id: usuario.id,
    usuario_nome: usuario.username,
    guilds: gerenciados,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/dashboard",
      "Set-Cookie": `${COOKIE_SESSAO}=${sessao}; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/`,
    },
  });
}

export async function pegarSessao(env, request) {
  const sessao = await verificar(env, pegarCookie(request, COOKIE_SESSAO));
  if (!sessao || sessao.exp < Date.now()) return null;
  return sessao;
}

export function sairResposta() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": `${COOKIE_SESSAO}=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`,
    },
  });
}

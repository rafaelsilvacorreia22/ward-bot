// Tradução inglês -> português (Brasil). Tentativa 1: Workers AI da própria
// Cloudflare (roda na mesma infraestrutura do Worker, sem depender de API
// externa). Tentativas 2 e 3: MyMemory e Google Translate — o mesmo esquema
// usado nos bots de ARC Raiders/WARDOGS/HELLDIVERS, só que aqui servem de
// reserva, porque o IP dos Workers é compartilhado por milhares de outros
// bots e costuma bater em 429 (limite excedido) nessas APIs gratuitas. Se
// tudo falhar, devolve o texto original em inglês em vez de quebrar quem
// chamou.

async function traduzirComWorkersAi(env, texto) {
  if (!env.AI) return null;
  const resposta = await env.AI.run("@cf/meta/m2m100-1.2b", {
    text: texto,
    source_lang: "english",
    target_lang: "portuguese",
  });
  return resposta?.translated_text || null;
}

async function traduzirComMyMemory(texto) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=en|pt-BR`;
  const res = await fetch(url);
  if (!res.ok) {
    console.log("MyMemory HTTP", res.status);
    return null;
  }
  const dados = await res.json();
  const traduzido = dados?.responseData?.translatedText;
  if (!traduzido || /MYMEMORY WARNING/i.test(traduzido)) {
    console.log("MyMemory sem tradução válida:", JSON.stringify(dados).slice(0, 300));
    return null;
  }
  return traduzido;
}

async function traduzirComGoogle(texto) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(texto)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!res.ok) {
    console.log("Google Translate HTTP", res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const dados = await res.json();
  return dados[0].map((trecho) => trecho[0]).join("") || null;
}

export async function traduzirParaPtBr(env, texto) {
  if (!texto) return texto;
  // Corta ANTES de traduzir, não depois: a API gratuita do MyMemory recusa
  // textos longos, e sempre mostramos só um trecho no Discord mesmo.
  const entrada = texto.length > 480 ? texto.slice(0, 480) : texto;

  try {
    const traduzido = await traduzirComWorkersAi(env, entrada);
    if (traduzido) return traduzido;
  } catch (err) {
    console.log("Falha ao traduzir com Workers AI:", err.message);
  }

  try {
    const traduzido = await traduzirComMyMemory(entrada);
    if (traduzido) return traduzido;
  } catch (err) {
    console.log("Falha ao traduzir com MyMemory:", err.message);
  }

  try {
    const traduzido = await traduzirComGoogle(entrada);
    if (traduzido) return traduzido;
  } catch (err) {
    console.log("Falha ao traduzir com Google Translate:", err.message);
  }

  console.log("Não foi possível traduzir, usando texto original em inglês.");
  return entrada;
}

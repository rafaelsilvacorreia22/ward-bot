// Para falhas que não devem parar nada (contar uma visita, guardar um cache,
// limpar dado antigo), mas que também não podem sumir sem deixar rastro:
// registra no log do Worker (wrangler tail / painel da Cloudflare) e segue.
// Uso: algo().catch(ignorar("onde"))
export const ignorar = (onde) => (err) => console.log(`[${onde}] falha ignorada:`, err?.message ?? err);

import { setGlobalDispatcher, getGlobalDispatcher } from "undici";
import { socksDispatcher } from "fetch-socks";

// Outbound requests to Aroma-Zone's Algolia index and image CDN are
// unreachable for some Russian ISPs without a SOCKS5 proxy/VPN — verified
// empirically, this server's own direct connection times out the same way
// a browser's does. Set CATALOG_SYNC_PROXY (e.g. "socks5h://127.0.0.1:1080")
// to route just the catalog sync's outbound fetches through it; unset means
// connect directly, the expected production case once deployed somewhere
// with working connectivity.
function parseSocksProxy(proxyUrl: string) {
  const url = new URL(proxyUrl);
  const type = url.protocol.startsWith("socks4") ? 4 : 5;
  return { host: url.hostname, port: Number(url.port), type: type as 4 | 5 };
}

// Runs `fn` with the global fetch dispatcher temporarily swapped to route
// through CATALOG_SYNC_PROXY (if set), restoring whatever was active before
// — so unrelated fetches elsewhere in the process (e.g. the FX rate fetch,
// a Russian domain that doesn't need this) are unaffected.
export async function withSyncProxy<T>(fn: () => Promise<T>): Promise<T> {
  const proxyUrl = process.env.CATALOG_SYNC_PROXY;
  if (!proxyUrl) return fn();

  const previous = getGlobalDispatcher();
  setGlobalDispatcher(socksDispatcher(parseSocksProxy(proxyUrl)));
  try {
    return await fn();
  } finally {
    setGlobalDispatcher(previous);
  }
}

// Type-only companion for algolia-client.js, consumed by api/'s TypeScript
// build (see syncCatalog.ts). Kept intentionally loose (raw Algolia hit
// shape) — syncCatalog.ts narrows it further with its own AlgoliaHit interface.
export interface AlgoliaFetchPageInfo {
  page: number;
  nbPages: number;
  nbHits: number;
  collected: number;
}

export interface FetchAllProductsOptions {
  limit?: number;
  onPage?: (info: AlgoliaFetchPageInfo) => void;
}

export function fetchAllProducts(options?: FetchAllProductsOptions): Promise<Record<string, unknown>[]>;

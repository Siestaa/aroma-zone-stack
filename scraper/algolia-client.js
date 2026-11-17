// Fetches the full aroma-zone.com product catalog from their public Algolia
// search index — the same endpoint the site's own search-as-you-type box
// calls in the browser. The API key below is a search-only key Aroma-Zone
// ships in their own frontend bundle (Algolia scopes "search" keys so
// they're safe to expose client-side; it cannot write/delete anything), so
// this is a plain public API call, not a workaround for anything.
const ALGOLIA_URL =
  "https://0a45rpra7l-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(5.55.1)%3B%20Search%20(5.55.1)%3B%20Browser&x-algolia-api-key=fc85bccbcbd07f4e56306d709aeacf3d&x-algolia-application-id=0A45RPRA7L";
const INDEX_NAME = "FR_products_v1_PROD";
const HITS_PER_PAGE = 10;
const FILTERS = '(_tags:"market:FR-EUR" OR _tags:"market:ALL-EUR") AND NOT _tags:workshop';
// Algolia exposes only the first 1000 hits of any one search in this index.
const PRICE_FILTERS = [
  "sortPrice.FR-EUR.min < 400",
  "sortPrice.FR-EUR.min >= 400 AND sortPrice.FR-EUR.min < 800",
  "sortPrice.FR-EUR.min >= 800",
];
const ATTRIBUTES = [
  "objectID", "key", "slug", "name", "description", "rating",
  "facets.categoryLabels", "tags.isBestSeller", "tags.isBio",
  "meta.variantStockByMarket.market:FR-EUR", "meta.variantStockByMarket.market:ALL-EUR",
  "meta.variantIndexByMarket.market:FR-EUR", "meta.variantIndexByMarket.market:ALL-EUR",
  "variants.sku", "variants.capacity", "variants.medias", "variants.meta.isInStock",
  "variants.prices.EUR.priceValues.country", "variants.prices.EUR.priceValues.regular",
  "variants.prices.EUR.priceValues.customerGroupId",
];

async function fetchPage(filters, page, hitsPerPage) {
  const res = await fetch(ALGOLIA_URL, {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      accept: "application/json",
      origin: "https://www.aroma-zone.com",
      referer: "https://www.aroma-zone.com/",
    },
    body: JSON.stringify({
      requests: [
        {
          indexName: INDEX_NAME,
          query: "",
          page,
          hitsPerPage,
          filters,
          attributesToRetrieve: ATTRIBUTES,
          attributesToHighlight: [],
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Algolia request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const result = data.results?.[0];
  if (!Array.isArray(result?.hits)) throw new Error("Algolia response missing catalog hits");
  return result;
}

function normalizeProduct(hit) {
  const marketIndices = hit.meta?.variantIndexByMarket;
  const market = marketIndices?.["market:FR-EUR"] ? "market:FR-EUR" : "market:ALL-EUR";
  // The first index is the default variant; entries marked with * are hidden.
  const visibleVariants = marketIndices?.[market]?.slice(1);
  const marketStock = hit.meta?.variantStockByMarket?.[market];
  const variants = (hit.variants ?? []).flatMap((variant, index) => {
    if (visibleVariants && !visibleVariants.includes(String(index))) return [];
    const retailPrices = (variant.prices?.EUR?.priceValues ?? []).filter(
      (price) => !price.customerGroupId && Number.isInteger(price.regular) && price.regular > 0,
    );
    const price = retailPrices.find((entry) => entry.country === "FR")
      ?? retailPrices.find((entry) => entry.country === "ALL");
    if (!price || !variant.sku) return [];

    return [{
      sku: variant.sku,
      capacity: variant.capacity?.value,
      capacityUnit: variant.capacity?.unit,
      images: (variant.medias ?? []).filter((media) => media.type === "image").map((media) => media.url),
      isInStock: marketStock?.[index] ?? variant.meta?.isInStock ?? false,
      prices: { EUR: { priceValues: [{ country: "FR", value: price.regular }] } },
    }];
  });

  return {
    objectID: hit.objectID,
    key: hit.key,
    slug: hit.slug,
    name: hit.name,
    description: hit.description,
    categoryKeys: (hit.facets?.categoryLabels ?? []).map((label) => label.trim()),
    attributes: {
      "best-seller": hit.tags?.isBestSeller ?? false,
      culture: hit.tags?.isBio === undefined ? undefined : hit.tags.isBio ? ["BIO"] : [],
    },
    reviewStatistics: { avg: hit.rating?.value, count: hit.rating?.count },
    isAnyVariantInStock: variants.some((variant) => variant.isInStock),
    variants,
  };
}

/** Fetches French catalog products in the shape consumed by the API and CSV exporter. */
export async function fetchAllProducts({ limit = Infinity, onPage } = {}) {
  if (limit <= 0) return [];

  const hitsPerPage = Math.min(HITS_PER_PAGE, limit);
  const first = await fetchPage(FILTERS, 0, hitsPerPage);
  const count = Math.min(first.nbHits, limit);
  let searches = [{ filters: FILTERS, first }];

  if (count > first.nbPages * hitsPerPage) {
    searches = [];
    for (const priceFilter of PRICE_FILTERS) {
      const filters = `${FILTERS} AND ${priceFilter}`;
      searches.push({ filters, first: await fetchPage(filters, 0, hitsPerPage) });
    }
    const coveredHits = searches.reduce((total, search) => total + search.first.nbHits, 0);
    if (coveredHits !== first.nbHits || searches.some(({ first }) => first.nbHits > first.nbPages * hitsPerPage)) {
      throw new Error(`Algolia price ranges cannot retrieve the complete catalog (${coveredHits}/${first.nbHits})`);
    }
  }

  const hits = new Map();
  let fetchedPages = 0;
  const nbPages = searches.reduce((total, search) => total + search.first.nbPages, 0);
  for (const { filters, first: initial } of searches) {
    for (let page = 0; page < initial.nbPages && hits.size < count; page++) {
      const result = page === 0 ? initial : await fetchPage(filters, page, hitsPerPage);
      for (const hit of result.hits) {
        if (hits.size >= count) break;
        hits.set(hit.objectID, hit);
      }
      fetchedPages++;
      onPage?.({ page: fetchedPages, nbPages, nbHits: first.nbHits, collected: hits.size });
    }
  }

  if (hits.size !== count) throw new Error(`Algolia returned ${hits.size} of ${count} expected products`);
  return Array.from(hits.values(), normalizeProduct);
}

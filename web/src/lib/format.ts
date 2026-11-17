export function formatEurCents(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function formatApproxRub(value: number): string {
  return `≈ ${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

export function formatCapacity(capacity: number | null, capacityUnit: string | null): string {
  if (capacity === null) return "";
  return capacityUnit ? `${capacity} ${capacityUnit}` : String(capacity);
}

// Russian labels for the raw `formatType` slugs backfilled from AZ's own
// per-product pages (see api/CLAUDE.md and schema.ts) — a mix of packaging
// format ("flacon-verre"/"eco-recharge"/...), color, shape, and scent, since
// that's genuinely what distinguishes same-capacity variants across the
// affected products. Unknown values fall back to the raw slug rather than
// hiding the difference.
const FORMAT_TYPE_LABEL: Record<string, string> = {
  "flacon-verre": "стеклянный флакон",
  "eco-recharge": "эко-рефилл",
  "pot-verre": "стеклянная баночка",
  flacon: "флакон",
  standard: "обычная упаковка",
  ambre: "янтарный",
  "bleu-roi": "васильковый",
  transparent: "прозрачный",
  "vert-bouteille": "бутылочно-зелёный",
  depoli: "матовый",
  turquoise: "бирюзовый",
  rose: "розовый",
  orange: "оранжевый",
  bleu: "синий",
  neutre: "нейтральный",
  vert: "зелёный",
  sapin: "ёлочка",
  trefle: "клевер",
  coeur: "сердце",
  soleil: "солнце",
  etoile: "звезда",
  "rouge-grenade": "гранат",
  "orange-passion": "апельсин-маракуйя",
};

export function formatTypeLabel(formatType: string | null): string | null {
  if (!formatType) return null;
  return FORMAT_TYPE_LABEL[formatType] ?? formatType;
}

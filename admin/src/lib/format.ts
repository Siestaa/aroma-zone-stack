export function formatEurCents(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

export function formatRub(rub: number): string {
  return `${rub.toLocaleString("ru-RU")} ₽`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

export function formatCountdown(targetIso: string): string {
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) return "меньше минуты";

  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} мин`;
  return `${hours} ч ${minutes} мин`;
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  collecting: "Собирается",
  paid: "Оплачено",
  transit: "В пути",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

// "pickup"/"post" only ever appear on historical orders — self-pickup and
// Почта России were both retired, every new order is fulfilled via "cdek".
// Kept here (not relabeled to "СДЭК") so old orders still show what
// actually happened at the time, not a retroactively rewritten history.
export const FULFILLMENT_LABEL: Record<string, string> = {
  pickup: "Самовывоз",
  post: "Почта России",
  cdek: "СДЭК",
};

// Mirrors web/src/lib/format.ts's FORMAT_TYPE_LABEL — kept in sync by hand
// (separate repo, no shared package) since both apps read the same
// productVariants.formatType values. Russian labels for AZ's own raw
// format-type slugs, only backfilled for the ~30 products where two
// variants share a capacity and this is the only way to tell them apart.
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

export function formatTypeLabel(formatType: string | null | undefined): string | null {
  if (!formatType) return null;
  return FORMAT_TYPE_LABEL[formatType] ?? formatType;
}

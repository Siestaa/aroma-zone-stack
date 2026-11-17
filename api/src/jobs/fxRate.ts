// Bank of Russia's official daily EUR rate, via a well-known JSON mirror of
// their XML feed (CBR itself only publishes XML). Verified live before wiring
// this in — returns { Date, Valute: { EUR: { Value, Nominal, ... } } }.
const CBR_DAILY_JSON_URL = "https://www.cbr-xml-daily.ru/daily_json.js";

export async function fetchEurRubRate(): Promise<number> {
  const res = await fetch(CBR_DAILY_JSON_URL);
  if (!res.ok) throw new Error(`CBR rate fetch failed: ${res.status}`);
  const data = (await res.json()) as { Valute?: Record<string, { Value?: number; Nominal?: number }> };
  const eur = data?.Valute?.EUR;
  if (!eur || typeof eur.Value !== "number" || typeof eur.Nominal !== "number") {
    throw new Error("CBR response missing EUR rate");
  }
  return eur.Value / eur.Nominal;
}

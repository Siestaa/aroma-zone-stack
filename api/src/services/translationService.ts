// Product name/description are translated FR→RU by hand, in batches, not
// by a live API call from the daily sync job (see api/CLAUDE.md) — these
// two helpers are the only places that logic lives, so every read path
// (products, favorites, cart, order snapshots) falls back to the French
// original the same way whenever a translation is missing.
export function displayName(row: { name: string; nameRu: string | null }): string {
  return row.nameRu ?? row.name;
}

export function displayDescription(row: { description: string; descriptionRu: string | null }): string {
  return row.descriptionRu ?? row.description;
}

// Called from syncCatalog.ts's upsert: whenever the French source text
// actually changed since the last sync, the existing translation is stale
// — null it out (rather than trying to re-translate inline) so it's
// visibly missing until the next manual translation pass, instead of
// silently showing outdated Russian text forever.
export function translationInvalidationPatch(
  existing: { name: string; description: string } | undefined,
  incoming: { name: string; description: string }
): { nameRu?: null; descriptionRu?: null } {
  const patch: { nameRu?: null; descriptionRu?: null } = {};
  if (!existing || existing.name !== incoming.name) patch.nameRu = null;
  if (!existing || existing.description !== incoming.description) patch.descriptionRu = null;
  return patch;
}

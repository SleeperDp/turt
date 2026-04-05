export type WeightedItem<T> = { item: T; weight: number };

export function weightedPickOne<T>(items: WeightedItem<T>[]) {
  const total = items.reduce((sum, it) => sum + Math.max(0, it.weight), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const it of items) {
    const w = Math.max(0, it.weight);
    if (w === 0) continue;
    if (r < w) return it.item;
    r -= w;
  }
  return items[items.length - 1]?.item ?? null;
}

export function weightedPickManyUnique<T>(
  items: WeightedItem<T>[],
  count: number,
  getKey: (item: T) => string
) {
  const pool = [...items];
  const picked: T[] = [];
  const seen = new Set<string>();

  while (picked.length < count) {
    const candidate = weightedPickOne(pool);
    if (!candidate) break;
    const key = getKey(candidate);
    if (!seen.has(key)) {
      picked.push(candidate);
      seen.add(key);
    }
    const idx = pool.findIndex((p) => getKey(p.item) === key);
    if (idx >= 0) pool.splice(idx, 1);
  }

  return picked;
}


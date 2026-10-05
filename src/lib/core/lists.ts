/** Listes proposées dans les formulaires (carnet D-023). */

export const MAIN_CRYPTOS: readonly string[] = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT',
  'LTC', 'TRX', 'TON', 'SUI', 'POL', 'NEAR', 'ATOM', 'UNI', 'PEPE', 'SHIB',
];

export const MAIN_QUOTES: readonly string[] = ['USDT', 'USDC', 'EUR', 'BTC'];

/** Nombre de saisies gardées en mémoire. */
export const MEMORY_MAX = 40;

/** Ajoute une saisie en tête de la mémoire (sans doublon, bornée). */
export function remember(list: readonly string[], value: string, max = MEMORY_MAX): string[] {
  const v = value.trim().toUpperCase();
  if (!v) return [...list];
  return [v, ...list.filter((x) => x !== v)].slice(0, max);
}

/** Suggestions : mémoire (plus récente d'abord), puis déjà utilisées, puis principales ; sans doublon. */
export function suggestions(...groups: readonly (readonly string[])[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const g of groups)
    for (const raw of g) {
      const v = raw.trim().toUpperCase();
      if (v && !seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
  return out;
}

/** Filtre d'une saisie : commence par d'abord, puis contient (insensible à la casse). */
export function filterOptions(options: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  const starts = options.filter((o) => o.toLowerCase().startsWith(q));
  const contains = options.filter((o) => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q));
  return [...starts, ...contains];
}

/** Formatage propre au carnet (le reste vient de commun-crypto/format). */
import { D, type Dec } from 'commun-crypto/money';
import { amount, dateFr } from 'commun-crypto/format';

/** « 05/01/2026 09:30 ». */
export function dateTimeFr(local: string): string {
  return `${dateFr(local)} ${local.slice(11, 16)}`;
}

/** Durée lisible : « 3 j 4 h », « 45 min », « 2 mois 3 j ». */
export function durationLabel(ms: number | null): string {
  if (ms === null) return '—';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
  const d = Math.floor(h / 24);
  if (d < 31) return `${d} j${h % 24 ? ` ${h % 24} h` : ''}`;
  const months = Math.floor(d / 30.44);
  if (months < 12) return `${months} mois${d - Math.round(months * 30.44) > 0 ? ` ${d - Math.round(months * 30.44)} j` : ''}`;
  const y = Math.floor(months / 12);
  return `${y} an${y > 1 ? 's' : ''}${months % 12 ? ` ${months % 12} mois` : ''}`;
}

/** Cours ou PMP : précision adaptée à l'ordre de grandeur (comme pmpa D-030). */
export function priceIn(d: Dec, quote: string): string {
  const a = d.abs();
  const places = a.gte(100) ? 2 : a.gte(1) ? 4 : a.isZero() ? 2 : Math.min(10, Math.max(2, 5 - Math.floor(Math.log10(a.toNumber()))));
  return amount(d, quote, places);
}

/** Fraction → pourcentage saisi (« 0,1 »). */
export function rateToPercent(rate: string): string {
  try {
    return new D(rate).mul(100).toFixed().replace('.', ',');
  } catch {
    return '0';
  }
}

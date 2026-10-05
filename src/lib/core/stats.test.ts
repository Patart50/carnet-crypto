import { describe, expect, it } from 'vitest';
import { dec } from 'commun-crypto/money';
import type { Position, TradeEvent } from './model';
import { computeStats, priceKey } from './stats';

let n = 0;
const ev = (kind: TradeEvent['kind'], day: number, quantity: string | undefined, price: string, fee = '0'): TradeEvent => ({
  id: `e${++n}`,
  kind,
  date: `2026-04-${String(day).padStart(2, '0')}T10:00`,
  quantity,
  price,
  fee,
});
const p = (id: string, asset: string, quote: string, side: Position['side'], events: TradeEvent[]): Position => ({ id, asset, quote, side, events });

const positions: Position[] = [
  // Gagnante : +6,1 net.
  p('a', 'BTC', 'USDT', 'long', [ev('open', 1, '1', '100', '1'), ev('add', 2, '1', '80', '1'), ev('reduce', 3, '1', '120', '1.2'), ev('close', 5, undefined, '70', '0.7')]),
  // Perdante : −5.
  p('b', 'ETH', 'USDT', 'long', [ev('open', 1, '1', '100'), ev('close', 2, undefined, '95')]),
  // Gain brut de 0,5 effacé par 2 de frais : perte de 1,5 (carnet D-006).
  p('c', 'SOL', 'usdt', 'short', [ev('open', 1, '1', '100', '1'), ev('close', 2, undefined, '99.5', '1')]),
  // Autre devise : jamais additionnée aux USDT.
  p('d', 'BTC', 'EUR', 'long', [ev('open', 1, '1', '100'), ev('close', 2, undefined, '110')]),
  // Ouvertes : une avec cours, une sans.
  p('e', 'ADA', 'USDT', 'long', [ev('open', 1, '10', '1', '0.01'), ev('reduce', 2, '5', '1.2')]),
  p('f', 'DOT', 'USDT', 'short', [ev('open', 1, '2', '5')]),
];

describe('statistiques par devise', () => {
  const stats = computeStats(positions, { prices: new Map([[priceKey('ada', 'usdt'), dec('1.1')]]) });
  const usdt = stats.find((x) => x.quote === 'USDT')!;
  const eur = stats.find((x) => x.quote === 'EUR')!;

  it('une ligne par devise, sans conversion', () => {
    expect(stats.map((x) => x.quote)).toEqual(['EUR', 'USDT']);
    expect(eur.closed).toBe(1);
    expect(eur.realizedNet.toString()).toBe('10');
    expect(eur.winrate!.toString()).toBe('100');
    expect(eur.profitFactor).toBeNull();
  });

  it('winrate net de frais, toujours avec gains, pertes, profit factor et espérance', () => {
    expect(usdt.closed).toBe(3);
    expect(usdt.open).toBe(2);
    expect(usdt.wins).toBe(1);
    expect(usdt.losses).toBe(2);
    expect(usdt.winrate!.toFixed(2)).toBe('33.33');
    expect(usdt.avgWin!.toString()).toBe('6.1');
    expect(usdt.avgLoss!.toString()).toBe('-3.25');
    expect(usdt.profitFactor!.eq(dec('6.1').div('6.5'))).toBe(true);
    expect(usdt.expectancy!.eq(dec('-0.4').div(3))).toBe(true);
    expect(usdt.best).toMatchObject({ positionId: 'a' });
    expect(usdt.worst).toMatchObject({ positionId: 'b' });
  });

  it('réalisé de toutes les positions, latent des ouvertes avec cours', () => {
    // Fermées : 6,1 − 5 − 1,5 ; ouverte ADA : (1,2 − 1) × 5 − 0,005 = 0,995.
    expect(usdt.realizedNet.toString()).toBe('0.595');
    // ADA restante : (1,1 − 1) × 5 − 0,005 = 0,495.
    expect(usdt.latentNet.toString()).toBe('0.495');
    expect(usdt.openWithoutPrice).toBe(1);
    expect(usdt.feesTotal.toString()).toBe('5.91');
  });

  it('carnet vide : aucune ligne ; aucune fermée : statistiques nulles', () => {
    expect(computeStats([])).toEqual([]);
    const only = computeStats([positions[5]])[0];
    expect(only.winrate).toBeNull();
    expect(only.expectancy).toBeNull();
    expect(only.best).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { dec, type Dec } from 'commun-crypto/money';
import { priceIn } from './quote';

const t = new Map<string, Dec | null>(
  Object.entries({ BTCUSDT: '60000', BTCEUR: '55000', EURUSDT: '1.08', USDCUSDT: '1.0008', ABCUSDC: '2', XYZBTC: '0.0001', SOLUSDT: '216' }).map(([k, v]) => [k, dec(v)]),
);

describe('cours dans la devise de la position', () => {
  it('paire directe, inverse, identité', () => {
    expect(priceIn('btc', 'usdt', t)).toEqual({ price: dec('60000'), route: 'BTCUSDT' });
    expect(priceIn('USDT', 'EUR', t)!.route).toBe('1 ÷ EURUSDT');
    expect(priceIn('USDT', 'USDT', t)!.price.toString()).toBe('1');
  });

  it('EUR par les chemins de pmpa, USDC ↔ USDT, repli par BTC', () => {
    expect(priceIn('SOL', 'EUR', t)!.price.toString()).toBe('200');
    expect(priceIn('SOL', 'USDC', t)!.route).toBe('SOLUSDT ÷ USDCUSDT');
    expect(priceIn('ABC', 'USDT', t)!.price.toString()).toBe('2.0016');
    expect(priceIn('XYZ', 'USDT', t)!.price.toString()).toBe('6');
    expect(priceIn('NOPE', 'USDT', t)).toBeNull();
  });
});

describe('cours à une date (bougies d’une minute)', () => {
  it('demande seulement les paires utiles, dans la devise de la position', async () => {
    const { MinuteKlines } = await import('commun-crypto/klines');
    const { priceAt, localToUtcMs } = await import('./quote');
    const urls: string[] = [];
    const listed = ['BTCUSDT', 'SOLUSDT', 'EURUSDT'];
    const closes: Record<string, string> = { BTCUSDT: '60123.45', SOLUSDT: '216', EURUSDT: '1.08' };
    const klines = new MinuteKlines(async (url) => {
      urls.push(url);
      if (url.includes('ticker')) return { ok: true, status: 200, json: async () => listed.map((symbol) => ({ symbol, price: '1' })) };
      const symbol = new URL(url).searchParams.get('symbol')!;
      return { ok: true, status: 200, json: async () => [[Number(new URL(url).searchParams.get('startTime')), '0', '0', '0', closes[symbol]]] };
    });
    const q = await priceAt(klines, 'btc', 'usdt', '2026-01-05T09:30');
    expect(q).toMatchObject({ route: 'BTCUSDT' });
    expect(q!.price.toString()).toBe('60123.45');
    const sol = await priceAt(klines, 'SOL', 'EUR', '2026-01-05T09:30');
    expect(sol!.price.toString()).toBe('200');
    // SOLEUR n'existe pas : jamais interrogée ; une seule liste des paires.
    expect(urls.filter((u) => u.includes('SOLEUR'))).toEqual([]);
    expect(urls.filter((u) => u.includes('ticker'))).toHaveLength(1);
    expect(() => localToUtcMs('05/01/2026')).toThrow(RangeError);
  });
});

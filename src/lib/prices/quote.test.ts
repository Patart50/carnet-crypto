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

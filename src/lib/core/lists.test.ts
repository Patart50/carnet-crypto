import { describe, expect, it } from 'vitest';
import { filterOptions, MAIN_CRYPTOS, remember, suggestions } from './lists';

describe('listes proposées', () => {
  it('mémoire : en tête, sans doublon, bornée, en majuscules', () => {
    expect(remember(['ETH', 'BTC'], ' btc ')).toEqual(['BTC', 'ETH']);
    expect(remember(['A', 'B', 'C'], 'D', 3)).toEqual(['D', 'A', 'B']);
    expect(remember(['A'], '  ')).toEqual(['A']);
  });

  it('suggestions : mémoire, puis utilisées, puis principales', () => {
    const s = suggestions(['WIF', 'BTC'], ['ARB'], MAIN_CRYPTOS);
    expect(s.slice(0, 4)).toEqual(['WIF', 'BTC', 'ARB', 'ETH']);
    expect(s.filter((x) => x === 'BTC')).toHaveLength(1);
  });

  it('filtre : commence par, puis contient ; vide = tout', () => {
    expect(filterOptions(['BTC', 'ETH', 'WBTC', 'SOL'], 'bt')).toEqual(['BTC', 'WBTC']);
    expect(filterOptions(['BTC', 'ETH'], '')).toEqual(['BTC', 'ETH']);
  });
});

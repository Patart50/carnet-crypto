import { describe, expect, it } from 'vitest';
import { dec } from 'commun-crypto/money';
import { dateTimeFr, durationLabel, priceIn, rateToPercent } from './format';

const n = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatage du carnet', () => {
  it('dates, durées', () => {
    expect(dateTimeFr('2026-01-05T09:30')).toBe('05/01/2026 09:30');
    expect(durationLabel(null)).toBe('—');
    expect(durationLabel(45 * 60_000)).toBe('45 min');
    expect(durationLabel(26 * 3_600_000)).toBe('1 j 2 h');
    expect(durationLabel(400 * 86_400_000)).toBe('1 an 1 mois');
  });

  it('prix selon l’ordre de grandeur, taux en pourcentage', () => {
    expect(n(priceIn(dec('58000'), 'USDT'))).toBe('58 000,00 USDT');
    expect(n(priceIn(dec('1.23456'), 'USDT'))).toBe('1,2346 USDT');
    expect(n(priceIn(dec('0.000012345'), 'USDT'))).toBe('0,0000123450 USDT');
    expect(rateToPercent('0.001')).toBe('0,1');
  });
});

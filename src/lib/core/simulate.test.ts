import { describe, expect, it } from 'vitest';
import { dec } from 'commun-crypto/money';
import type { Position } from './model';
import { exposureAt, formulaFeeRate, simulateAdd, simulateTarget } from './simulate';
import { computePosition } from './position';

const position = (side: Position['side'], fee = '0', price = '100'): Position => ({
  id: 'p',
  asset: 'BTC',
  quote: 'USDT',
  side,
  events: [{ id: 'o', kind: 'open', date: '2026-05-01T10:00', quantity: '1', price, fee }],
});
const input = (price: string, feeRate = '0') => ({ price: dec(price), feeRate: dec(feeRate), date: '2026-05-02T10:00' });

describe('simulateur de renfort (carnet D-008)', () => {
  it('ajout Long : nouveau PMP brut et frais inclus, capital engagé', () => {
    const r = simulateAdd(position('long'), dec('1'), input('80', '0.001'));
    expect(r.pmpBefore.toString()).toBe('100');
    expect(r.pmpAfter.toString()).toBe('90');
    expect(r.fee.toString()).toBe('0.08');
    expect(r.after.pmpWithFees.toString()).toBe('90.04');
    expect(r.engagedAfter.toString()).toBe('180');
    expect(r.worsensPmp).toBe(false);
    expect(simulateAdd(position('long'), dec('1'), input('120')).worsensPmp).toBe(true);
  });

  it('cible en mode brut : quantité exacte', () => {
    const r = simulateTarget(position('long'), dec('90'), input('80', '0.001'));
    if (r.status !== 'ok') throw new Error(r.status);
    expect(r.simulation.quantity.toString()).toBe('1');
    expect(r.simulation.pmpAfter.toString()).toBe('90');
  });

  it('cible en mode frais inclus : le PMP rejoué tombe exactement sur la cible (Long et Short)', () => {
    const long = simulateTarget(position('long', '1'), dec('95'), input('80', '0.001'), 'withFees');
    if (long.status !== 'ok') throw new Error(long.status);
    expect(long.simulation.pmpBefore.toString()).toBe('101');
    expect(long.simulation.pmpAfter.minus('95').abs().lt('1e-30')).toBe(true);

    const short = simulateTarget(position('short', '0.1'), dec('105'), input('120', '0.001'), 'withFees');
    if (short.status !== 'ok') throw new Error(short.status);
    expect(short.simulation.pmpBefore.toString()).toBe('99.9');
    expect(short.simulation.pmpAfter.minus('105').abs().lt('1e-30')).toBe(true);
  });

  it('prix limite cohérent avec les frais du carnet : Long Y ÷ (1 + r)', () => {
    expect(formulaFeeRate('long', dec('0.01')).eq(dec('0.01').div('1.01'))).toBe(true);
    const r = simulateTarget(position('long', '0', '100'), dec('90'), input('95', '0.01'), 'withFees');
    expect(r.status).toBe('unreachable');
    if (r.status === 'unreachable') expect(r.limitPrice.minus(dec('90').div('1.01')).abs().lt('1e-40')).toBe(true);
  });

  it('cible atteinte, inatteignable, position fermée', () => {
    expect(simulateTarget(position('long'), dec('110'), input('80')).status).toBe('reached');
    expect(simulateTarget(position('short'), dec('90'), input('120')).status).toBe('reached');
    expect(simulateTarget(position('long'), dec('90'), input('95'))).toEqual({ status: 'unreachable', limitPrice: dec('90') });
    const closed: Position = { ...position('long'), events: [...position('long').events, { id: 'c', kind: 'close', date: '2026-05-02T10:00', price: '110', fee: '0' }] };
    expect(() => simulateAdd(closed, dec('1'), input('80'))).toThrow(RangeError);
    expect(() => simulateAdd(position('long'), dec('0'), input('80'))).toThrow(RangeError);
  });

  it('break-even avant et après, exposition (choc défavorable)', () => {
    const r = simulateAdd(position('long'), dec('1'), input('80'));
    expect(r.breakEvenBefore!.toString()).toBe('100');
    expect(r.breakEvenAfter!.toString()).toBe('90');
    const e = exposureAt(computePosition(position('short')), dec('100'));
    expect(e.gainAfterShock.toString()).toBe('-20');
  });
});

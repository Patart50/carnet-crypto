import { describe, expect, it } from 'vitest';
import { dec, type Dec } from 'commun-crypto/money';
import type { Position, TradeEvent } from './model';
import { breakEven, computePosition, durationMs, latentNet, returnOnMaxCost, totalNet } from './position';

let n = 0;
const ev = (kind: TradeEvent['kind'], date: string, quantity: string | undefined, price: string, fee = '0'): TradeEvent => ({
  id: `e${++n}`,
  kind,
  date,
  quantity,
  price,
  fee,
});
const pos = (side: Position['side'], events: TradeEvent[]): Position => ({ id: 'p', asset: 'BTC', quote: 'USDT', side, events });
const s = (d: Dec | null) => d?.toString();

describe('Long : ouverture, ajout, réduction, clôture', () => {
  const events = [
    ev('open', '2026-01-01T10:00', '1', '100', '1'),
    ev('add', '2026-01-02T10:00', '1', '80', '1'),
    ev('reduce', '2026-01-03T10:00', '1', '120', '1.2'),
  ];

  it('ajout : PMP brut et PMP frais inclus recalculés', () => {
    const st = computePosition(pos('long', events.slice(0, 2)));
    expect(s(st.quantity)).toBe('2');
    expect(s(st.pmpGross)).toBe('90');
    expect(s(st.pmpWithFees)).toBe('91');
    expect(st.status).toBe('open');
  });

  it('réduction : P&L réalisé sur la partie, PMP inchangé, frais d’entrée au prorata', () => {
    const st = computePosition(pos('long', events));
    const r = st.realizations[0];
    expect(s(r.gross)).toBe('30');
    expect(s(r.entryFeeShare)).toBe('1');
    expect(s(r.net)).toBe('27.8');
    expect(s(st.quantity)).toBe('1');
    expect(s(st.pmpGross)).toBe('90');
    expect(s(st.pmpWithFees)).toBe('91');
    expect(s(st.entryFeesOpen)).toBe('1');
  });

  it('latent net, break-even (réalisé compris), total', () => {
    const st = computePosition(pos('long', events));
    expect(s(latentNet(st, dec('110'), dec('0.01')))).toBe('17.9');
    expect(s(breakEven(st))).toBe('63.2');
    expect(breakEven(st, dec('0.01'))!.eq(dec('63.2').div('0.99'))).toBe(true);
    // Au break-even, le P&L net total est nul.
    expect(totalNet(st, breakEven(st, dec('0.01'))!, dec('0.01')).abs().lt('1e-40')).toBe(true);
  });

  it('clôture : position fermée, réalisé = brut − tous les frais', () => {
    const st = computePosition(pos('long', [...events, ev('close', '2026-01-05T10:00', undefined, '70', '0.7')]));
    expect(st.status).toBe('closed');
    expect(s(st.quantity)).toBe('0');
    expect(s(st.realizations[1].net)).toBe('-21.7');
    expect(s(st.realizedNet)).toBe('6.1');
    expect(s(st.realizedGross)).toBe('10');
    expect(s(st.feesTotal)).toBe('3.9');
    expect(st.closedAt).toBe('2026-01-05T10:00');
    expect(durationMs(st, '2030-01-01T00:00')).toBe(4 * 86_400_000);
    expect(s(st.maxCost)).toBe('180');
    expect(returnOnMaxCost(st)!.toFixed(4)).toBe('3.3889');
    expect(breakEven(st)).toBeNull();
    expect(s(latentNet(st, dec('500')))).toBe('0');
  });
});

describe('Short', () => {
  const events = [
    ev('open', '2026-02-01T09:00', '2', '100', '0.2'),
    ev('add', '2026-02-02T09:00', '1', '130', '0.13'),
    ev('reduce', '2026-02-03T09:00', '1.5', '90', '0.135'),
  ];

  it('ajout : moyenne des prix de vente, frais déduits du PMP frais inclus', () => {
    const st = computePosition(pos('short', events.slice(0, 2)));
    expect(s(st.pmpGross)).toBe('110');
    expect(s(st.pmpWithFees)).toBe('109.89');
  });

  it('réduction sous le PMP : gain', () => {
    const st = computePosition(pos('short', events));
    expect(s(st.realizations[0].gross)).toBe('30');
    expect(s(st.realizations[0].net)).toBe('29.7');
    expect(s(st.quantity)).toBe('1.5');
    expect(s(st.pmpGross)).toBe('110');
  });

  it('latent et break-even', () => {
    const st = computePosition(pos('short', events));
    expect(s(latentNet(st, dec('120')))).toBe('-15.165');
    expect(s(breakEven(st))).toBe('129.69');
    expect(totalNet(st, dec('129.69')).abs().lt('1e-40')).toBe(true);
  });
});

describe('Validation (carnet D-005)', () => {
  const open = () => ev('open', '2026-03-01T10:00', '1', '100');

  it('premier événement : une ouverture', () => {
    const st = computePosition(pos('long', [ev('add', '2026-03-01T10:00', '1', '100')]));
    expect(st.errors[0].message).toMatch(/ouverture/);
  });

  it('réduire au-delà de la quantité détenue est refusé, sans effet', () => {
    const bad = ev('reduce', '2026-03-02T10:00', '2', '110', '1');
    const st = computePosition(pos('long', [open(), bad]));
    expect(st.errors).toEqual([{ eventId: bad.id, message: 'Quantité supérieure à la quantité détenue (1).' }]);
    expect(s(st.quantity)).toBe('1');
    expect(s(st.feesTotal)).toBe('0');
  });

  it('réduire toute la quantité clôt la position ; rien après la clôture', () => {
    const st = computePosition(pos('long', [open(), ev('reduce', '2026-03-02T10:00', '1', '110')]));
    expect(st.status).toBe('closed');
    const after = computePosition(pos('long', [open(), ev('close', '2026-03-02T10:00', undefined, '110'), ev('add', '2026-03-03T10:00', '1', '90')]));
    expect(after.errors[0].message).toMatch(/déjà clôturée/);
  });

  it('deux ouvertures, prix, quantité, frais, date invalides', () => {
    expect(computePosition(pos('long', [open(), open()])).errors[0].message).toMatch(/déjà ouverte/);
    expect(computePosition(pos('long', [ev('open', '2026-03-01T10:00', '1', '0')])).errors[0].message).toMatch(/prix/);
    expect(computePosition(pos('long', [ev('open', '2026-03-01T10:00', '-1', '100')])).errors[0].message).toMatch(/quantité/);
    expect(computePosition(pos('long', [ev('open', '2026-03-01T10:00', '1', '100', '-1')])).errors[0].message).toMatch(/frais/);
    expect(computePosition(pos('long', [ev('open', '01/03/2026', '1', '100')])).errors[0].message).toMatch(/Date/);
    expect(computePosition(pos('long', [ev('open', '2026-03-01T10:00', 'abc', '100')])).errors[0].message).toMatch(/quantité/);
  });

  it('événements triés par date (saisie dans le désordre)', () => {
    const st = computePosition(pos('long', [ev('add', '2026-03-02T10:00', '1', '80'), open()]));
    expect(st.errors).toEqual([]);
    expect(s(st.pmpGross)).toBe('90');
    expect(st.steps.map((x) => x.event.kind)).toEqual(['open', 'add']);
  });

  it('frais vides = 0 ; sans événement : position vide', () => {
    expect(computePosition(pos('long', [ev('open', '2026-03-01T10:00', '1', '100', '')])).errors).toEqual([]);
    expect(computePosition(pos('long', [])).status).toBe('empty');
  });

  it('précision décimale exacte (0,1 + 0,2)', () => {
    const st = computePosition(pos('long', [ev('open', '2026-03-01T10:00', '0.1', '1'), ev('add', '2026-03-02T10:00', '0.2', '1')]));
    expect(s(st.quantity)).toBe('0.3');
  });
});

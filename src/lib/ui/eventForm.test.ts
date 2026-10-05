import { describe, expect, it } from 'vitest';
import { emptyEventForm, eventToForm, parseEventForm } from './eventForm';

describe('saisie d’un événement', () => {
  it('nombres à la française, frais vides = 0, textes nettoyés', () => {
    const r = parseEventForm({ ...emptyEventForm('add', '2026-01-02T10:00'), quantity: '0,05', price: '54 000', emotion: ' FOMO ', note: '' });
    expect(r).toEqual({ ok: true, event: { kind: 'add', date: '2026-01-02T10:00', quantity: '0.05', price: '54000', fee: '0', emotion: 'FOMO' } });
  });

  it('clôture sans quantité', () => {
    const r = parseEventForm({ ...emptyEventForm('close', '2026-01-02T10:00'), quantity: 'ignoré', price: '1,5', fee: '0,01' });
    expect(r).toEqual({ ok: true, event: { kind: 'close', date: '2026-01-02T10:00', price: '1.5', fee: '0.01' } });
  });

  it('erreurs par champ', () => {
    const r = parseEventForm({ ...emptyEventForm('reduce', ''), quantity: '0', price: 'abc', fee: '-1' });
    expect(r).toEqual({
      ok: false,
      errors: { date: 'Date : à renseigner (jour et heure).', quantity: 'Quantité : doit être strictement positif.', price: 'Prix : nombre illisible.', fee: 'Frais : ne peut pas être négatif.' },
    });
  });

  it('événement → formulaire (virgule décimale)', () => {
    expect(eventToForm({ id: 'x', kind: 'add', date: '2026-01-02T10:00', quantity: '0.05', price: '54000', fee: '2.7' })).toMatchObject({ quantity: '0,05', fee: '2,7' });
  });
});

describe('funding et frais proposés', () => {
  it('funding signé sur une sortie, ignoré sur une entrée, illisible signalé', () => {
    const exit = parseEventForm({ ...emptyEventForm('close', '2026-01-02T10:00'), price: '100', funding: '-1,5' });
    expect(exit.ok && exit.event.funding).toBe('-1.5');
    const entry = parseEventForm({ ...emptyEventForm('add', '2026-01-02T10:00'), quantity: '1', price: '100', funding: '3' });
    expect(entry.ok && entry.event.funding).toBeUndefined();
    const bad = parseEventForm({ ...emptyEventForm('reduce', '2026-01-02T10:00'), quantity: '1', price: '100', funding: 'x' });
    expect(bad).toEqual({ ok: false, errors: { funding: 'Funding : nombre illisible.' } });
  });

  it('frais : taux d’entrée ou de sortie, quantité détenue pour une clôture', async () => {
    const { autoFee, feeText } = await import('./eventForm');
    const { dec } = await import('commun-crypto/money');
    const rates = { entry: dec('0.001'), exit: dec('0.002') };
    expect(autoFee({ kind: 'open', quantity: '0,1', price: '60 000' }, rates, null)!.toString()).toBe('6');
    expect(autoFee({ kind: 'reduce', quantity: '0,1', price: '60000' }, rates, null)!.toString()).toBe('12');
    expect(autoFee({ kind: 'close', quantity: '', price: '60000' }, rates, dec('0.05'))!.toString()).toBe('6');
    expect(autoFee({ kind: 'open', quantity: '', price: '60000' }, rates, null)).toBeNull();
    expect(feeText(dec('6.0049'))).toBe('6');
    expect(feeText(dec('0.0001234567'))).toBe('0,000123457');
  });
});


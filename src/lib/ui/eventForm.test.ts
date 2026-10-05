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

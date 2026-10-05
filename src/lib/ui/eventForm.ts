/**
 * Saisie d'un événement : chaînes du formulaire → champs décimaux validés.
 * Nombres à la française ou à l'anglaise (commun-crypto/parse, renfort D-012).
 */
import { parseNumber } from 'commun-crypto/parse';
import type { EventKind, TradeEvent } from '../core/model';

export interface EventFormValues {
  kind: EventKind;
  date: string;
  quantity: string;
  price: string;
  fee: string;
  emotion: string;
  note: string;
}

export type EventField = 'date' | 'quantity' | 'price' | 'fee';

export type ParsedEvent =
  | { ok: true; event: Omit<TradeEvent, 'id'> }
  | { ok: false; errors: Partial<Record<EventField, string>> };

export function emptyEventForm(kind: EventKind, date: string): EventFormValues {
  return { kind, date, quantity: '', price: '', fee: '', emotion: '', note: '' };
}

export function eventToForm(e: TradeEvent): EventFormValues {
  const fr = (s: string | undefined) => (s ?? '').replace('.', ',');
  return { kind: e.kind, date: e.date, quantity: fr(e.quantity), price: fr(e.price), fee: e.fee === '0' ? '' : fr(e.fee), emotion: e.emotion ?? '', note: e.note ?? '' };
}

export function parseEventForm(f: EventFormValues): ParsedEvent {
  const errors: Partial<Record<EventField, string>> = {};
  const read = (field: EventField, label: string, opts: { required: boolean; positive: boolean }) => {
    try {
      const v = parseNumber(f[field]);
      if (v === null) {
        if (opts.required) errors[field] = `${label} : à renseigner.`;
        return null;
      }
      if (opts.positive ? !v.gt(0) : v.isNeg()) {
        errors[field] = opts.positive ? `${label} : doit être strictement positif.` : `${label} : ne peut pas être négatif.`;
        return null;
      }
      return v;
    } catch {
      errors[field] = `${label} : nombre illisible.`;
      return null;
    }
  };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(f.date)) errors.date = 'Date : à renseigner (jour et heure).';
  const quantity = f.kind === 'close' ? null : read('quantity', 'Quantité', { required: true, positive: true });
  const price = read('price', 'Prix', { required: true, positive: true });
  const fee = read('fee', 'Frais', { required: false, positive: false });
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const event: Omit<TradeEvent, 'id'> = { kind: f.kind, date: f.date, price: price!.toString(), fee: fee ? fee.toString() : '0' };
  if (quantity) event.quantity = quantity.toString();
  if (f.emotion.trim()) event.emotion = f.emotion.trim().slice(0, 60);
  if (f.note.trim()) event.note = f.note.trim().slice(0, 2000);
  return { ok: true, event };
}

/** Position fictive de démonstration (page d'attente, puis exemple de l'interface). */
import type { Position } from './model';

export const EXAMPLE: Position = {
  id: 'exemple',
  asset: 'BTC',
  quote: 'USDT',
  side: 'long',
  events: [
    { id: 'x1', kind: 'open', date: '2026-01-05T09:30', quantity: '0.10', price: '60000', fee: '6', emotion: 'Conviction', note: 'Cassure du range.' },
    { id: 'x2', kind: 'add', date: '2026-01-12T18:10', quantity: '0.05', price: '54000', fee: '2.7', emotion: 'Discipline', note: 'Renfort prévu au plan.' },
    { id: 'x3', kind: 'reduce', date: '2026-02-02T11:00', quantity: '0.08', price: '66000', fee: '5.28', emotion: 'Discipline', note: 'Premier objectif.' },
  ],
};

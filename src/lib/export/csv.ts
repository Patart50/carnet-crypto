/**
 * Exports pour tableur (comme dca D-015) : séparateur « ; », virgule décimale,
 * BOM UTF-8. La sauvegarde JSON reste le format de réimport sans perte.
 */
import { toCsv } from 'commun-crypto/csv';
import type { Dec } from 'commun-crypto/money';
import { KIND_LABELS, SIDE_LABELS, type Position } from '../core/model';
import type { PositionState } from '../core/position';

const BOM = '﻿';
const frNum = (s: string | undefined) => (s ?? '').replace('.', ',');
const frDec = (d: Dec | null | undefined) => (d ? d.toDecimalPlaces(8).toFixed().replace('.', ',') : '');

/** Une ligne par événement. */
export function eventsCsv(positions: readonly Position[], states: ReadonlyMap<string, PositionState>): string {
  const headers = ['Position', 'Actif', 'Devise', 'Sens', 'Date', 'Événement', 'Quantité', 'Prix', 'Frais', 'Funding', 'PMP brut après', 'P&L net réalisé', 'Émotion', 'Note'];
  const rows: string[][] = [];
  for (const p of positions) {
    const st = states.get(p.id);
    for (const step of st?.steps ?? []) {
      const e = step.event;
      rows.push([
        p.id,
        p.asset,
        p.quote,
        SIDE_LABELS[p.side],
        e.date.replace('T', ' '),
        KIND_LABELS[e.kind],
        e.kind === 'close' ? frDec(step.realization?.quantity) : frNum(e.quantity),
        frNum(e.price),
        frNum(e.fee),
        frNum(e.funding),
        frDec(step.pmpGross),
        frDec(step.realization?.net),
        e.emotion ?? '',
        e.note ?? '',
      ]);
    }
  }
  return BOM + toCsv(headers, rows, ';');
}

/** Une ligne par position. */
export function positionsCsv(positions: readonly Position[], states: ReadonlyMap<string, PositionState>): string {
  const headers = ['Position', 'Actif', 'Devise', 'Sens', 'Statut', 'Ouverture', 'Clôture', 'Quantité', 'PMP brut', 'PMP frais inclus', 'P&L net réalisé', 'Frais', 'Funding', 'Capital engagé max', 'Note'];
  const rows = positions.map((p) => {
    const st = states.get(p.id);
    return [
      p.id,
      p.asset,
      p.quote,
      SIDE_LABELS[p.side],
      st?.status === 'open' ? 'Ouverte' : st?.status === 'closed' ? 'Fermée' : '',
      st?.openedAt?.replace('T', ' ') ?? '',
      st?.closedAt?.replace('T', ' ') ?? '',
      frDec(st?.quantity),
      frDec(st?.pmpGross),
      frDec(st?.pmpWithFees),
      frDec(st?.realizedNet),
      frDec(st?.feesTotal),
      frDec(st?.fundingTotal),
      frDec(st?.maxCost),
      p.note ?? '',
    ];
  });
  return BOM + toCsv(headers, rows, ';');
}

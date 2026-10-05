/**
 * Modèle de données du carnet (carnet D-002) : une position est une suite
 * d'événements. Montants et quantités en chaînes décimales (jamais de `number`),
 * dates en heure locale « AAAA-MM-JJTHH:mm ».
 */
import type { Side } from 'commun-crypto/renfort';

export type { Side };

export type EventKind = 'open' | 'add' | 'reduce' | 'close';

/** Émotions proposées ; le champ reste libre (carnet SPEC § 7). */
export const EMOTIONS: readonly string[] = ['Discipline', 'Conviction', 'FOMO', 'Peur', 'Revanche', 'Ennui', 'Euphorie', 'Doute'];

export interface TradeEvent {
  id: string;
  kind: EventKind;
  /** Heure locale, « AAAA-MM-JJTHH:mm ». */
  date: string;
  /**
   * Quantité d'actif. Obligatoire pour ouverture, ajout et réduction ;
   * ignorée pour une clôture (toute la quantité restante).
   */
  quantity?: string;
  /** Prix d'exécution, en devise de cotation. */
  price: string;
  /** Frais de l'opération, en devise de cotation (« 0 » si aucun). */
  fee: string;
  note?: string;
  emotion?: string;
}

export interface Position {
  id: string;
  /** Actif traité, ex. « BTC ». */
  asset: string;
  /** Devise de cotation, ex. « USDT », « EUR » (carnet D-007). */
  quote: string;
  side: Side;
  /** Événements dans l'ordre de saisie ; le calcul les trie par date. */
  events: TradeEvent[];
  /** Note générale de la position. */
  note?: string;
}

export const KIND_LABELS: Record<EventKind, string> = {
  open: 'Ouverture',
  add: 'Ajout',
  reduce: 'Réduction',
  close: 'Clôture',
};

export const SIDE_LABELS: Record<Side, string> = { long: 'Long', short: 'Short' };

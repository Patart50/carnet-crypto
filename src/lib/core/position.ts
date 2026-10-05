/**
 * Calcul d'une position en rejouant ses événements (carnet D-002).
 *
 * Conventions (docs/DECISIONS.md) :
 * - D-003 : le prix d'exécution et les frais sont gardés séparément ; on calcule
 *   un PMP brut et un PMP frais inclus. P&L net et break-even incluent toujours
 *   les frais.
 * - D-005 : une réduction ne change pas le PMP (coût moyen pondéré) ; réduire
 *   au-delà de la quantité détenue est refusé ; une réduction de toute la
 *   quantité clôt la position.
 * - Frais d'entrée : imputés aux sorties au prorata de la quantité sortie.
 *
 * Notations : s = +1 en Long, −1 en Short ; q quantité ; p prix ; f frais.
 */
import { D, ZERO, dec, type Dec } from 'commun-crypto/money';
import { sideSign } from 'commun-crypto/renfort';
import type { EventKind, Position, Side, TradeEvent } from './model';

export interface Realization {
  eventId: string;
  date: string;
  kind: EventKind;
  quantity: Dec;
  price: Dec;
  /** s × (prix de sortie − PMP brut) × q. */
  gross: Dec;
  /** Frais de la sortie. */
  exitFee: Dec;
  /** Part des frais d'entrée imputée à cette sortie. */
  entryFeeShare: Dec;
  /** gross − exitFee − entryFeeShare. */
  net: Dec;
}

/** État de la position après un événement (fil d'événements). */
export interface Step {
  event: TradeEvent;
  quantity: Dec;
  pmpGross: Dec;
  pmpWithFees: Dec;
  realization?: Realization;
}

export interface EventError {
  eventId: string;
  message: string;
}

export interface PositionState {
  side: Side;
  status: 'open' | 'closed' | 'empty';
  /** Quantité détenue (0 si fermée). */
  quantity: Dec;
  /** Prix moyen pondéré au prix d'exécution. */
  pmpGross: Dec;
  /** PMP avec les frais d'entrée restants : Long (coût + frais) ÷ q, Short (coût − frais) ÷ q. */
  pmpWithFees: Dec;
  /** Coût de la quantité détenue au PMP brut. */
  cost: Dec;
  /** Frais d'entrée pas encore imputés à une sortie. */
  entryFeesOpen: Dec;
  realizedGross: Dec;
  realizedNet: Dec;
  feesTotal: Dec;
  /** Plus grande quantité détenue. */
  maxQuantity: Dec;
  /** Plus grand capital engagé (quantité × PMP brut). */
  maxCost: Dec;
  openedAt: string | null;
  closedAt: string | null;
  realizations: Realization[];
  steps: Step[];
  /** Première erreur rencontrée : le calcul s'arrête à l'événement fautif. */
  errors: EventError[];
}

/** Tri par date, puis ordre de saisie (tri stable). */
export function sortEvents(events: readonly TradeEvent[]): TradeEvent[] {
  return events.map((e, i) => ({ e, i })).sort((a, b) => (a.e.date < b.e.date ? -1 : a.e.date > b.e.date ? 1 : a.i - b.i)).map(({ e }) => e);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function readDec(raw: string | undefined): Dec | null {
  if (raw === undefined) return null;
  try {
    return dec(raw);
  } catch {
    return null;
  }
}

function empty(side: Side): PositionState {
  return {
    side,
    status: 'empty',
    quantity: ZERO,
    pmpGross: ZERO,
    pmpWithFees: ZERO,
    cost: ZERO,
    entryFeesOpen: ZERO,
    realizedGross: ZERO,
    realizedNet: ZERO,
    feesTotal: ZERO,
    maxQuantity: ZERO,
    maxCost: ZERO,
    openedAt: null,
    closedAt: null,
    realizations: [],
    steps: [],
    errors: [],
  };
}

function withFees(side: Side, cost: Dec, fees: Dec, quantity: Dec): Dec {
  if (quantity.isZero()) return ZERO;
  return (side === 'long' ? cost.plus(fees) : cost.minus(fees)).div(quantity);
}

/** Rejoue les événements et renvoie l'état de la position. */
export function computePosition(position: Pick<Position, 'side' | 'events'>): PositionState {
  const st = empty(position.side);
  const s = sideSign(position.side);
  const fail = (e: TradeEvent, message: string) => {
    st.errors.push({ eventId: e.id, message });
    return st;
  };

  for (const e of sortEvents(position.events)) {
    if (!DATE_RE.test(e.date)) return fail(e, 'Date invalide (attendu AAAA-MM-JJTHH:mm).');
    const price = readDec(e.price);
    if (!price || !price.gt(0)) return fail(e, 'Le prix doit être strictement positif.');
    const fee = readDec(e.fee === '' ? '0' : e.fee);
    if (!fee || fee.isNeg()) return fail(e, 'Les frais doivent être positifs ou nuls.');

    if (st.status === 'closed') return fail(e, 'La position est déjà clôturée : ouvrez une nouvelle position.');
    if (st.status === 'empty' && e.kind !== 'open') return fail(e, 'Le premier événement doit être une ouverture.');
    if (st.status === 'open' && e.kind === 'open') return fail(e, 'La position est déjà ouverte : utilisez un ajout.');

    let quantity: Dec;
    if (e.kind === 'close') {
      quantity = st.quantity;
    } else {
      const q = readDec(e.quantity);
      if (!q || !q.gt(0)) return fail(e, 'La quantité doit être strictement positive.');
      quantity = q;
    }

    if ((e.kind === 'reduce' || e.kind === 'close') && quantity.gt(st.quantity)) {
      return fail(e, `Quantité supérieure à la quantité détenue (${st.quantity.toString().replace(".", ",")}).`);
    }

    st.feesTotal = st.feesTotal.plus(fee);
    let realization: Realization | undefined;

    if (e.kind === 'open' || e.kind === 'add') {
      st.cost = st.cost.plus(quantity.mul(price));
      st.quantity = st.quantity.plus(quantity);
      st.entryFeesOpen = st.entryFeesOpen.plus(fee);
      st.pmpGross = st.cost.div(st.quantity);
      if (e.kind === 'open') {
        st.status = 'open';
        st.openedAt = e.date;
      }
    } else {
      const share = st.entryFeesOpen.mul(quantity).div(st.quantity);
      const gross = price.minus(st.pmpGross).mul(quantity).mul(s);
      realization = {
        eventId: e.id,
        date: e.date,
        kind: e.kind,
        quantity,
        price,
        gross,
        exitFee: fee,
        entryFeeShare: share,
        net: gross.minus(fee).minus(share),
      };
      st.realizations.push(realization);
      st.realizedGross = st.realizedGross.plus(gross);
      st.realizedNet = st.realizedNet.plus(realization.net);
      st.entryFeesOpen = st.entryFeesOpen.minus(share);
      st.quantity = st.quantity.minus(quantity);
      st.cost = st.quantity.isZero() ? ZERO : st.pmpGross.mul(st.quantity);
      if (st.quantity.isZero()) {
        st.status = 'closed';
        st.closedAt = e.date;
        st.entryFeesOpen = ZERO;
      }
    }

    st.pmpWithFees = withFees(position.side, st.cost, st.entryFeesOpen, st.quantity);
    if (st.quantity.gt(st.maxQuantity)) st.maxQuantity = st.quantity;
    if (st.cost.gt(st.maxCost)) st.maxCost = st.cost;
    st.steps.push({
      event: e,
      quantity: st.quantity,
      pmpGross: st.pmpGross,
      pmpWithFees: st.pmpWithFees,
      realization,
    });
  }
  return st;
}

/** PMP affiché selon le réglage (carnet D-003). */
export function displayedPmp(st: PositionState, mode: 'gross' | 'withFees'): Dec {
  return mode === 'gross' ? st.pmpGross : st.pmpWithFees;
}

/**
 * Résultat latent net de la quantité détenue au cours donné : s × (cours − PMP brut) × q,
 * moins les frais d'entrée restants et les frais de sortie estimés (taux `exitFeeRate`).
 */
export function latentNet(st: PositionState, price: Dec, exitFeeRate: Dec = ZERO): Dec {
  if (st.status !== 'open') return ZERO;
  const s = sideSign(st.side);
  const exitFee = st.quantity.mul(price).mul(exitFeeRate);
  return price.minus(st.pmpGross).mul(st.quantity).mul(s).minus(st.entryFeesOpen).minus(exitFee);
}

/**
 * Prix de sortie de toute la quantité qui annule le P&L net de la position
 * (réalisé compris), frais de sortie estimés compris :
 * - Long : (coût + frais d'entrée restants − réalisé net) ÷ (q × (1 − f_v)) ;
 * - Short : (coût − frais d'entrée restants + réalisé net) ÷ (q × (1 + f_v)).
 * Null si la position n'est pas ouverte, ou si le Short ne peut plus revenir à zéro.
 */
export function breakEven(st: PositionState, exitFeeRate: Dec = ZERO): Dec | null {
  if (st.status !== 'open' || st.quantity.isZero()) return null;
  if (exitFeeRate.isNeg() || exitFeeRate.gte(1)) throw new RangeError(`Frais de sortie hors de [0 %, 100 %[ : ${exitFeeRate.toString()}`);
  const one = new D(1);
  const value =
    st.side === 'long'
      ? st.cost.plus(st.entryFeesOpen).minus(st.realizedNet).div(st.quantity.mul(one.minus(exitFeeRate)))
      : st.cost.minus(st.entryFeesOpen).plus(st.realizedNet).div(st.quantity.mul(one.plus(exitFeeRate)));
  return value.gt(0) ? value : null;
}

/** P&L net total : réalisé + latent (si un cours est fourni pour une position ouverte). */
export function totalNet(st: PositionState, price?: Dec, exitFeeRate: Dec = ZERO): Dec {
  return price && st.status === 'open' ? st.realizedNet.plus(latentNet(st, price, exitFeeRate)) : st.realizedNet;
}

/** Durée en millisecondes de l'ouverture à la clôture (ou à `now`, heure locale « AAAA-MM-JJTHH:mm »). */
export function durationMs(st: PositionState, now: string): number | null {
  if (!st.openedAt) return null;
  const end = st.closedAt ?? now;
  return Math.max(0, Date.parse(end) - Date.parse(st.openedAt));
}

/** Rendement en % du plus grand capital engagé (meilleure et pire position, en option). */
export function returnOnMaxCost(st: PositionState): Dec | null {
  return st.maxCost.gt(0) ? st.realizedNet.div(st.maxCost).mul(100) : null;
}

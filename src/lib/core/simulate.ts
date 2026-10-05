/**
 * Simulateur de renfort intégré (carnet D-008).
 *
 * La simulation ajoute un événement « ajout » hypothétique et rejoue la position
 * avec le même moteur : nouveau PMP, break-even et frais sont donc exactement
 * ceux qu'on obtiendrait en saisissant l'ajout.
 *
 * Frais : saisis en taux r du montant (quantité × prix), comme sur les plateformes.
 * Dans le carnet, le prix effectif d'un ajout vaut p × (1 + r) en Long et p × (1 − r)
 * en Short. Les formules de commun-crypto (commun D-008) prennent les frais Long sur
 * le montant décaissé (p ÷ (1 − f)) : on leur passe f = r ÷ (1 + r), qui donne le même
 * prix effectif. En Short, f = r.
 */
import { D, ZERO, type Dec } from 'commun-crypto/money';
import { exposureFor, quantityForTarget, type Side } from 'commun-crypto/renfort';
import type { Position, TradeEvent } from './model';
import { breakEven, computePosition, displayedPmp, type PositionState } from './position';

export type PmpMode = 'gross' | 'withFees';

export interface SimulationInput {
  price: Dec;
  /** Taux de frais de l'ajout, en fraction (0,001 = 0,1 %). */
  feeRate: Dec;
  /** Heure locale de l'ajout simulé (« AAAA-MM-JJTHH:mm »), après le dernier événement. */
  date: string;
  /** Taux de frais de sortie estimés, pour le break-even. */
  exitFeeRate?: Dec;
}

export interface Simulation {
  quantity: Dec;
  price: Dec;
  /** Montant au prix d'exécution. */
  notional: Dec;
  fee: Dec;
  before: PositionState;
  after: PositionState;
  /** PMP affiché selon le réglage, avant et après. */
  pmpBefore: Dec;
  pmpAfter: Dec;
  breakEvenBefore: Dec | null;
  breakEvenAfter: Dec | null;
  /** Capital engagé au PMP brut (quantité × PMP brut), avant et après. */
  engagedBefore: Dec;
  engagedAfter: Dec;
  /** L'ajout dégrade le PMP : il monte en Long, baisse en Short. */
  worsensPmp: boolean;
}

/** Taux équivalent pour les formules de commun-crypto (voir l'en-tête). */
export function formulaFeeRate(side: Side, feeRate: Dec): Dec {
  if (feeRate.isNeg() || feeRate.gte(1)) throw new RangeError(`Frais hors de [0 %, 100 %[ : ${feeRate.toString()}`);
  return side === 'long' ? feeRate.div(new D(1).plus(feeRate)) : feeRate;
}

/** Ajout hypothétique d'une quantité au prix donné. */
export function simulateAdd(position: Position, quantity: Dec, input: SimulationInput, mode: PmpMode = 'gross'): Simulation {
  const before = computePosition(position);
  if (before.status !== 'open') throw new RangeError('La simulation demande une position ouverte.');
  if (!quantity.gt(0)) throw new RangeError('La quantité doit être strictement positive.');
  if (!input.price.gt(0)) throw new RangeError('Le prix doit être strictement positif.');
  formulaFeeRate(position.side, input.feeRate);
  const notional = quantity.mul(input.price);
  const fee = notional.mul(input.feeRate);
  const event: TradeEvent = {
    id: '__simulation__',
    kind: 'add',
    date: input.date,
    quantity: quantity.toString(),
    price: input.price.toString(),
    fee: fee.toString(),
  };
  const after = computePosition({ side: position.side, events: [...position.events, event] });
  if (after.errors.length > 0 || after.status !== 'open') throw new RangeError(after.errors[0]?.message ?? 'Simulation impossible.');
  const pmpBefore = displayedPmp(before, mode);
  const pmpAfter = displayedPmp(after, mode);
  const exit = input.exitFeeRate ?? ZERO;
  return {
    quantity,
    price: input.price,
    notional,
    fee,
    before,
    after,
    pmpBefore,
    pmpAfter,
    breakEvenBefore: breakEven(before, exit),
    breakEvenAfter: breakEven(after, exit),
    engagedBefore: before.cost,
    engagedAfter: after.cost,
    worsensPmp: position.side === 'long' ? pmpAfter.gt(pmpBefore) : pmpAfter.lt(pmpBefore),
  };
}

export type TargetSimulation =
  | { status: 'ok'; simulation: Simulation; limitPrice: Dec }
  /** PMP déjà au niveau visé : sous la cible en Long, au-dessus en Short. */
  | { status: 'reached' }
  /** Au prix choisi, aucune quantité ne suffit ; `limitPrice` est le prix à dépasser. */
  | { status: 'unreachable'; limitPrice: Dec };

/** Quantité à ajouter au prix donné pour amener le PMP affiché à la cible. */
export function simulateTarget(position: Position, target: Dec, input: SimulationInput, mode: PmpMode = 'gross'): TargetSimulation {
  const before = computePosition(position);
  if (before.status !== 'open') throw new RangeError('La simulation demande une position ouverte.');
  // En mode brut, les frais ne changent pas le PMP brut : la formule les ignore.
  const rate = mode === 'gross' ? ZERO : formulaFeeRate(position.side, input.feeRate);
  const base = { quantity: before.quantity, pmp: displayedPmp(before, mode) };
  const r = quantityForTarget(position.side, base, target, input.price, rate);
  if (r.status === 'no-position') throw new RangeError('La simulation demande une position ouverte.');
  if (r.status === 'reached') return r;
  if (r.status === 'unreachable') return r;
  return { status: 'ok', simulation: simulateAdd(position, r.quantity, input, mode), limitPrice: r.limitPrice };
}

/** Exposition au cours actuel, avec un choc défavorable de 20 % (baisse en Long, hausse en Short). */
export function exposureAt(st: PositionState, price: Dec, exitFeeRate: Dec = ZERO) {
  return exposureFor(st.side, { quantity: st.quantity, pmp: st.pmpGross }, price, exitFeeRate);
}

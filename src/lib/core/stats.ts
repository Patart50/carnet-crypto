/**
 * Statistiques du carnet (carnet D-006, D-007).
 *
 * - Par devise de cotation, sans conversion : additionner des USDT et des euros serait faux.
 * - Sur les positions fermées seulement, P&L net de frais : un gain brut effacé
 *   par les frais compte comme une perte.
 * - Le winrate n'est jamais seul : gain moyen, perte moyenne, profit factor et
 *   espérance l'accompagnent, car un winrate élevé peut cacher une stratégie perdante.
 */
import { D, ZERO, type Dec } from 'commun-crypto/money';
import type { Position } from './model';
import { computePosition, latentNet, type PositionState } from './position';

export interface Ranked {
  positionId: string;
  asset: string;
  net: Dec;
}

export interface QuoteStats {
  quote: string;
  /** Positions fermées. */
  closed: number;
  open: number;
  wins: number;
  /** P&L net ≤ 0 : les positions à zéro comptent comme des pertes (rien n'a été gagné). */
  losses: number;
  /** wins ÷ fermées, en %. Null sans position fermée. */
  winrate: Dec | null;
  /** Moyenne des P&L nets gagnants. */
  avgWin: Dec | null;
  /** Moyenne des P&L nets perdants (négative ou nulle). */
  avgLoss: Dec | null;
  /** Σ gains ÷ |Σ pertes|. Null si aucune perte (non défini) ou aucune position fermée. */
  profitFactor: Dec | null;
  /** P&L net moyen par position fermée. */
  expectancy: Dec | null;
  best: Ranked | null;
  worst: Ranked | null;
  /** P&L net réalisé de toutes les positions (fermées et réductions des ouvertes). */
  realizedNet: Dec;
  /** Latent net des positions ouvertes dont le cours est connu. */
  latentNet: Dec;
  /** Positions ouvertes sans cours : latent incomplet. */
  openWithoutPrice: number;
  feesTotal: Dec;
}

export interface StatsOptions {
  /** Cours actuel par actif, dans la devise de cotation : clé « BTC/USDT ». */
  prices?: ReadonlyMap<string, Dec>;
  /** Taux de frais de sortie estimés pour le latent. */
  exitFeeRate?: Dec;
}

export function priceKey(asset: string, quote: string): string {
  return `${asset.toUpperCase()}/${quote.toUpperCase()}`;
}

function blank(quote: string): QuoteStats {
  return {
    quote,
    closed: 0,
    open: 0,
    wins: 0,
    losses: 0,
    winrate: null,
    avgWin: null,
    avgLoss: null,
    profitFactor: null,
    expectancy: null,
    best: null,
    worst: null,
    realizedNet: ZERO,
    latentNet: ZERO,
    openWithoutPrice: 0,
    feesTotal: ZERO,
  };
}

/** Statistiques par devise de cotation, triées par nom de devise. */
export function computeStats(positions: readonly Position[], options: StatsOptions = {}, states?: ReadonlyMap<string, PositionState>): QuoteStats[] {
  const byQuote = new Map<string, { stats: QuoteStats; sumWins: Dec; sumLosses: Dec; sumClosed: Dec }>();
  for (const p of positions) {
    const quote = p.quote.toUpperCase();
    let acc = byQuote.get(quote);
    if (!acc) {
      acc = { stats: blank(quote), sumWins: ZERO, sumLosses: ZERO, sumClosed: ZERO };
      byQuote.set(quote, acc);
    }
    const st = states?.get(p.id) ?? computePosition(p);
    const s = acc.stats;
    s.realizedNet = s.realizedNet.plus(st.realizedNet);
    s.feesTotal = s.feesTotal.plus(st.feesTotal);

    if (st.status === 'open') {
      s.open++;
      const price = options.prices?.get(priceKey(p.asset, quote));
      if (price) s.latentNet = s.latentNet.plus(latentNet(st, price, options.exitFeeRate));
      else s.openWithoutPrice++;
    } else if (st.status === 'closed') {
      s.closed++;
      const net = st.realizedNet;
      acc.sumClosed = acc.sumClosed.plus(net);
      if (net.gt(0)) {
        s.wins++;
        acc.sumWins = acc.sumWins.plus(net);
      } else {
        s.losses++;
        acc.sumLosses = acc.sumLosses.plus(net);
      }
      const ranked = { positionId: p.id, asset: p.asset, net };
      if (!s.best || net.gt(s.best.net)) s.best = ranked;
      if (!s.worst || net.lt(s.worst.net)) s.worst = ranked;
    }
  }

  for (const { stats: s, sumWins, sumLosses, sumClosed } of byQuote.values()) {
    if (s.closed > 0) {
      s.winrate = new D(s.wins).div(s.closed).mul(100);
      s.expectancy = sumClosed.div(s.closed);
      if (s.losses > 0 && !sumLosses.isZero()) s.profitFactor = sumWins.div(sumLosses.abs());
    }
    if (s.wins > 0) s.avgWin = sumWins.div(s.wins);
    if (s.losses > 0) s.avgLoss = sumLosses.div(s.losses);
  }
  return [...byQuote.values()].map((a) => a.stats).sort((a, b) => a.quote.localeCompare(b.quote));
}

export interface EmotionStats {
  quote: string;
  /** Émotion notée à l'ouverture ; « Non renseignée » sinon. */
  emotion: string;
  closed: number;
  wins: number;
  winrate: Dec;
  realizedNet: Dec;
}

export const NO_EMOTION = 'Non renseignée';

/**
 * Positions fermées par émotion notée à l'ouverture, par devise : montre si
 * les trades pris sous le coup du FOMO ou de la revanche coûtent plus cher.
 */
export function statsByEmotion(positions: readonly Position[], states?: ReadonlyMap<string, PositionState>): EmotionStats[] {
  const map = new Map<string, EmotionStats>();
  for (const p of positions) {
    const st = states?.get(p.id) ?? computePosition(p);
    if (st.status !== 'closed') continue;
    const opening = st.steps[0]?.event;
    const emotion = opening?.emotion?.trim() || NO_EMOTION;
    const quote = p.quote.toUpperCase();
    const key = `${quote}\u0000${emotion}`;
    const row = map.get(key) ?? { quote, emotion, closed: 0, wins: 0, winrate: ZERO, realizedNet: ZERO };
    row.closed++;
    if (st.realizedNet.gt(0)) row.wins++;
    row.realizedNet = row.realizedNet.plus(st.realizedNet);
    row.winrate = new D(row.wins).div(row.closed).mul(100);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.quote.localeCompare(b.quote) || a.realizedNet.cmp(b.realizedNet));
}

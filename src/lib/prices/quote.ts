/**
 * Cours d'un actif dans la devise de cotation d'une position (carnet D-007, D-016).
 *
 * Chemins : paire directe (BTCUSDT) ; inverse ; EUR → chemins de pmpa (commun D-006) ;
 * USDT ↔ USDC par USDCUSDT ; repli par BTC (XBTC × BTC<devise>).
 *
 * Écrit une seule fois en générateur (comme commun-crypto/binance) : il demande les
 * paires une par une, ce qui sert à la fois la table des cours du jour (synchrone)
 * et les bougies historiques à la minute (asynchrone, une requête par paire utile).
 */
import { D, type Dec } from 'commun-crypto/money';
import { eurRoute, type PriceQuote } from 'commun-crypto/binance';
import { MinuteKlines } from 'commun-crypto/klines';

export function* quoteRoute(asset: string, quote: string): Generator<string, PriceQuote | null, Dec | null> {
  const a = asset.toUpperCase();
  const q = quote.toUpperCase();
  if (a === q) return { price: new D(1), route: q };

  const direct = yield `${a}${q}`;
  if (direct) return { price: direct, route: `${a}${q}` };
  const inverse = yield `${q}${a}`;
  if (inverse && !inverse.isZero()) return { price: new D(1).div(inverse), route: `1 ÷ ${q}${a}` };

  if (q === 'EUR') return yield* eurRoute(a);

  if (q === 'USDC') {
    const viaUsdt = yield `${a}USDT`;
    if (viaUsdt) {
      const usdcUsdt = yield 'USDCUSDT';
      if (usdcUsdt && !usdcUsdt.isZero()) return { price: viaUsdt.div(usdcUsdt), route: `${a}USDT ÷ USDCUSDT` };
    }
  }
  if (q === 'USDT') {
    const viaUsdc = yield `${a}USDC`;
    if (viaUsdc) {
      const usdcUsdt = yield 'USDCUSDT';
      if (usdcUsdt) return { price: viaUsdc.times(usdcUsdt), route: `${a}USDC × USDCUSDT` };
    }
  }

  const viaBtc = yield `${a}BTC`;
  if (viaBtc) {
    const btcQuote = yield `BTC${q}`;
    if (btcQuote) return { price: viaBtc.times(btcQuote), route: `${a}BTC × BTC${q}` };
  }
  return null;
}

/** Cours à partir d'une table déjà chargée (cours du jour). */
export function priceIn(asset: string, quote: string, ticker: Map<string, Dec | null>): PriceQuote | null {
  const route = quoteRoute(asset, quote);
  let step = route.next();
  while (!step.done) step = route.next(ticker.get(step.value) ?? null);
  return step.value;
}

/** Cours à partir de paires obtenues à la demande (bougies historiques). */
export async function priceInAsync(asset: string, quote: string, get: (symbol: string) => Promise<Dec | null>): Promise<PriceQuote | null> {
  const route = quoteRoute(asset, quote);
  let step = route.next();
  while (!step.done) step = route.next(await get(step.value));
  return step.value;
}

/** Heure locale du navigateur (« AAAA-MM-JJTHH:mm ») → instant UTC. */
export function localToUtcMs(local: string): number {
  const ms = Date.parse(local);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || Number.isNaN(ms)) throw new RangeError(`Date invalide : ${local}`);
  return ms;
}

/** Cours de clôture de la minute, dans la devise de la position. */
export async function priceAt(klines: MinuteKlines, asset: string, quote: string, local: string): Promise<PriceQuote | null> {
  const utc = localToUtcMs(local);
  return priceInAsync(asset, quote, (symbol) => klines.close(symbol, utc));
}

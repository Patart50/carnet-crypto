/**
 * Cours d'un actif dans la devise de cotation d'une position (carnet D-007),
 * à partir de la table des cours Binance (commun-crypto/binance, une requête,
 * après consentement ; rien n'est envoyé d'autre que la demande de la liste).
 *
 * Chemins : paire directe (BTCUSDT) ; EUR → chemins de pmpa (commun D-006) ;
 * USDT ↔ USDC par la paire USDCUSDT ; repli par BTC (XBTC × BTC<devise>).
 */
import { D, type Dec } from 'commun-crypto/money';
import { priceEur, type PriceQuote } from 'commun-crypto/binance';

export function priceIn(asset: string, quote: string, ticker: Map<string, Dec | null>): PriceQuote | null {
  const a = asset.toUpperCase();
  const q = quote.toUpperCase();
  const get = (symbol: string) => ticker.get(symbol) ?? null;
  if (a === q) return { price: new D(1), route: q };

  const direct = get(`${a}${q}`);
  if (direct) return { price: direct, route: `${a}${q}` };
  const inverse = get(`${q}${a}`);
  if (inverse && !inverse.isZero()) return { price: new D(1).div(inverse), route: `1 ÷ ${q}${a}` };

  if (q === 'EUR') return priceEur(a, ticker);

  const usdcUsdt = get('USDCUSDT');
  if (q === 'USDC' && usdcUsdt && !usdcUsdt.isZero()) {
    const viaUsdt = get(`${a}USDT`);
    if (viaUsdt) return { price: viaUsdt.div(usdcUsdt), route: `${a}USDT ÷ USDCUSDT` };
  }
  if (q === 'USDT' && usdcUsdt) {
    const viaUsdc = get(`${a}USDC`);
    if (viaUsdc) return { price: viaUsdc.times(usdcUsdt), route: `${a}USDC × USDCUSDT` };
  }

  const viaBtc = get(`${a}BTC`);
  const btcQuote = get(`BTC${q}`);
  if (viaBtc && btcQuote) return { price: viaBtc.times(btcQuote), route: `${a}BTC × BTC${q}` };
  return null;
}

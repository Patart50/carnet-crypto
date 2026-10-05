/**
 * État de l'application : positions (IndexedDB), réglages et cours (localStorage).
 * Toute écriture d'une position passe par le moteur : une suite d'événements qui
 * ne se rejoue pas est refusée avec le message du moteur (carnet D-002, D-011).
 */
import { fetchTicker, PriceFetchError, roundPrice } from 'commun-crypto/binance';
import { MinuteKlines } from 'commun-crypto/klines';
import { dec, ZERO, type Dec } from 'commun-crypto/money';
import { openLocalStore } from 'commun-crypto/storage';
import { isTheme, type Theme } from 'commun-crypto/theme';
import { EXAMPLE } from '../core/example';
import type { Position, TradeEvent } from '../core/model';
import { computePosition, type PositionState } from '../core/position';
import type { PmpMode } from '../core/simulate';
import { priceKey } from '../core/stats';
import { priceAt, priceIn } from '../prices/quote';
import { MAIN_CRYPTOS, MAIN_QUOTES, remember, suggestions } from '../core/lists';
import { EMOTIONS } from '../core/model';
import { makeBackup, mergePositions, readBackup, type ReadResult } from '../storage/backup';
import { openPositionStore, type PositionStore } from '../storage/db';

export interface Settings {
  theme: Theme;
  pmpMode: PmpMode;
  /** Frais d'entrée, en fraction (0,001 = 0,1 %) : pré-remplit les frais d'une ouverture ou d'un ajout (carnet D-021). */
  entryFeeRate: string;
  /** Frais de sortie, en fraction : pré-remplit les frais d'une sortie ; sert aussi au latent et au break-even. */
  exitFeeRate: string;
  allowPriceFetch: boolean;
}

export interface SavedPrice {
  /** Cours dans la devise de cotation, chaîne décimale. */
  price: string;
  /** Chemin Binance, absent pour une saisie à la main. */
  route?: string;
  /** Date ISO de la mise à jour. */
  at: string;
}

const SETTINGS_KEY = 'reglages';
const PRICES_KEY = 'prix';
const MEMORY_KEY = 'memoire';

interface Memory {
  assets: string[];
  quotes: string[];
}

const RATE_RE = /^\d+(\.\d+)?$/;

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Heure locale actuelle au format « AAAA-MM-JJTHH:mm » (champ datetime-local). */
export function nowLocal(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type Result = { ok: true } | { ok: false; message: string };

class AppState {
  private readonly local = openLocalStore('carnet-crypto:');
  private store: PositionStore | null = null;

  readonly settingsPersistent = this.local.persistent;
  loaded = $state(false);
  persistent = $state(true);
  positions = $state<Position[]>([]);
  settings = $state<Settings>({ theme: 'auto', pmpMode: 'gross', entryFeeRate: '0.001', exitFeeRate: '0.001', allowPriceFetch: false });
  memory = $state<Memory>({ assets: [], quotes: [] });
  private klines: MinuteKlines | null = null;
  prices = $state<Record<string, SavedPrice>>({});
  priceStatus = $state<'idle' | 'loading' | 'error'>('idle');
  priceMessage = $state<string | null>(null);
  toast = $state<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  /** État calculé de chaque position. */
  states = $derived(new Map<string, PositionState>(this.positions.map((p) => [p.id, computePosition(p)])));

  /** Cours connus, en décimal, par clé « ACTIF/DEVISE ». */
  priceMap = $derived(
    new Map<string, Dec>(
      Object.entries(this.prices).flatMap(([k, v]) => {
        try {
          const d = dec(v.price);
          return d.gt(0) ? [[k, d] as const] : [];
        } catch {
          return [];
        }
      }),
    ),
  );

  exitFee = $derived(rate(this.settings.exitFeeRate));
  entryFee = $derived(rate(this.settings.entryFeeRate));

  /** Cryptos proposées : mémoire, puis déjà utilisées, puis principales (carnet D-023). */
  assetOptions = $derived(suggestions(this.memory.assets, this.positions.map((p) => p.asset), MAIN_CRYPTOS));
  quoteOptions = $derived(suggestions(this.memory.quotes, this.positions.map((p) => p.quote), MAIN_QUOTES));
  emotionOptions = $derived([...new Set([...EMOTIONS, ...this.positions.flatMap((p) => p.events.map((e) => e.emotion?.trim()).filter((e): e is string => !!e))])]);

  async init(factory?: IDBFactory | null) {
    const saved = this.local.readJson<Partial<Settings>>(SETTINGS_KEY);
    if (saved) {
      if (isTheme(saved.theme)) this.settings.theme = saved.theme;
      if (saved.pmpMode === 'gross' || saved.pmpMode === 'withFees') this.settings.pmpMode = saved.pmpMode;
      if (typeof saved.entryFeeRate === 'string' && RATE_RE.test(saved.entryFeeRate)) this.settings.entryFeeRate = saved.entryFeeRate;
      if (typeof saved.exitFeeRate === 'string' && RATE_RE.test(saved.exitFeeRate)) this.settings.exitFeeRate = saved.exitFeeRate;
      if (saved.allowPriceFetch === true) this.settings.allowPriceFetch = true;
    }
    this.prices = this.local.readJson<Record<string, SavedPrice>>(PRICES_KEY) ?? {};
    const mem = this.local.readJson<Partial<Memory>>(MEMORY_KEY);
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^[A-Z0-9]{1,20}$/.test(x)) : []);
    this.memory = { assets: strings(mem?.assets), quotes: strings(mem?.quotes) };
    this.store = await openPositionStore(factory === undefined ? (globalThis.indexedDB ?? null) : factory);
    this.persistent = this.store.persistent;
    try {
      this.positions = sortPositions(await this.store.all());
    } catch {
      this.positions = [];
    }
    this.loaded = true;
  }

  private saveSettings() {
    this.local.writeJson(SETTINGS_KEY, this.settings);
  }

  setTheme(theme: Theme) {
    this.settings.theme = theme;
    this.saveSettings();
  }

  setPmpMode(mode: PmpMode) {
    this.settings.pmpMode = mode;
    this.saveSettings();
  }

  setExitFeeRate(rate: string) {
    this.settings.exitFeeRate = rate;
    this.saveSettings();
  }

  setEntryFeeRate(rate: string) {
    this.settings.entryFeeRate = rate;
    this.saveSettings();
  }

  /** Mémorise une crypto et une devise saisies (carnet D-023). */
  rememberPair(asset: string, quote: string) {
    this.memory = { assets: remember(this.memory.assets, asset), quotes: remember(this.memory.quotes, quote) };
    this.local.writeJson(MEMORY_KEY, this.memory);
  }

  forgetAsset(asset: string) {
    this.memory = { ...this.memory, assets: this.memory.assets.filter((a) => a !== asset) };
    this.local.writeJson(MEMORY_KEY, this.memory);
  }

  /**
   * Cours de clôture de la minute à une date (carnet D-024), après consentement.
   * N'est envoyé que des noms de paires et l'heure.
   */
  async priceAtDate(asset: string, quote: string, local: string, fetcher?: ConstructorParameters<typeof MinuteKlines>[0]): Promise<{ price: Dec; route: string } | { error: string }> {
    if (!this.settings.allowPriceFetch) return { error: 'Autorisation Binance nécessaire.' };
    if (!this.klines || fetcher) this.klines = new MinuteKlines(fetcher);
    try {
      const q = await priceAt(this.klines, asset, quote, local);
      if (!q) return { error: `Pas de cours Binance pour ${asset.toUpperCase()}/${quote.toUpperCase()} à cette date.` };
      return { price: roundPrice(q.price), route: q.route };
    } catch (e) {
      if (e instanceof RangeError) return { error: 'Date invalide.' };
      return { error: e instanceof PriceFetchError ? e.message : 'Impossible de joindre Binance.' };
    }
  }

  setAllowPriceFetch(allow: boolean) {
    this.settings.allowPriceFetch = allow;
    this.saveSettings();
  }

  notify(message: string) {
    this.toast = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = null), 3500);
  }

  position(id: string): Position | undefined {
    return this.positions.find((p) => p.id === id);
  }

  /** Enregistre une position après vérification par le moteur. */
  private async commit(next: Position): Promise<Result> {
    const errors = computePosition(next).errors;
    if (errors.length > 0) return { ok: false, message: errors[0].message };
    await this.store?.put(next);
    const others = this.positions.filter((p) => p.id !== next.id);
    this.positions = sortPositions([...others, next]);
    return { ok: true };
  }

  /** Nouvelle position avec son ouverture ; renvoie son identifiant. */
  async createPosition(meta: Pick<Position, 'asset' | 'quote' | 'side' | 'note'>, open: Omit<TradeEvent, 'id' | 'kind'>): Promise<Result & { id?: string }> {
    const position: Position = {
      id: newId(),
      asset: meta.asset.trim().toUpperCase(),
      quote: meta.quote.trim().toUpperCase(),
      side: meta.side,
      events: [{ ...open, id: newId(), kind: 'open' }],
      ...(meta.note?.trim() ? { note: meta.note.trim() } : {}),
    };
    const r = await this.commit(position);
    if (r.ok) this.rememberPair(position.asset, position.quote);
    return r.ok ? { ok: true, id: position.id } : r;
  }

  async updateMeta(id: string, meta: Pick<Position, 'asset' | 'quote' | 'side' | 'note'>): Promise<Result> {
    const current = this.position(id);
    if (!current) return { ok: false, message: 'Position introuvable.' };
    const next: Position = { ...$state.snapshot(current), asset: meta.asset.trim().toUpperCase(), quote: meta.quote.trim().toUpperCase(), side: meta.side };
    if (meta.note?.trim()) next.note = meta.note.trim();
    else delete next.note;
    const r = await this.commit(next);
    if (r.ok) this.rememberPair(next.asset, next.quote);
    return r;
  }

  /** Ajoute (id absent) ou remplace (même id) un événement. */
  async saveEvent(positionId: string, event: Omit<TradeEvent, 'id'> & { id?: string }): Promise<Result> {
    const current = this.position(positionId);
    if (!current) return { ok: false, message: 'Position introuvable.' };
    const full: TradeEvent = { ...event, id: event.id ?? newId() };
    if (full.kind === 'close') delete full.quantity;
    if (!full.note?.trim()) delete full.note;
    if (!full.emotion?.trim()) delete full.emotion;
    if (!full.funding || full.funding === '0' || full.kind === 'open' || full.kind === 'add') delete full.funding;
    const snapshot = $state.snapshot(current);
    const exists = snapshot.events.some((e) => e.id === full.id);
    const events = exists ? snapshot.events.map((e) => (e.id === full.id ? full : e)) : [...snapshot.events, full];
    return this.commit({ ...snapshot, events });
  }

  /** Supprime un événement ; la suppression du seul événement supprime la position. */
  async deleteEvent(positionId: string, eventId: string): Promise<Result> {
    const current = this.position(positionId);
    if (!current) return { ok: false, message: 'Position introuvable.' };
    const events = $state.snapshot(current).events.filter((e) => e.id !== eventId);
    if (events.length === 0) {
      await this.deletePosition(positionId);
      return { ok: true };
    }
    return this.commit({ ...$state.snapshot(current), events });
  }

  async deletePosition(id: string) {
    await this.store?.remove(id);
    this.positions = this.positions.filter((p) => p.id !== id);
  }

  /** Charge la position fictive de démonstration (identifiants neufs). */
  async loadExample(): Promise<string> {
    const copy: Position = { ...structuredClone(EXAMPLE), id: newId() };
    copy.events = copy.events.map((e) => ({ ...e, id: newId() }));
    await this.commit(copy);
    return copy.id;
  }

  async clearAll() {
    await this.store?.replaceAll([]);
    this.positions = [];
  }

  backupJson(): string {
    return JSON.stringify(
      makeBackup($state.snapshot(this.positions), { pmpMode: this.settings.pmpMode, entryFeeRate: this.settings.entryFeeRate, exitFeeRate: this.settings.exitFeeRate }),
      null,
      2,
    );
  }

  /** Lit une sauvegarde sans rien modifier (aperçu avant import). */
  previewBackup(raw: string): ReadResult {
    return readBackup(raw);
  }

  async applyBackup(read: ReadResult, mode: 'replace' | 'merge') {
    const next = mode === 'replace' ? read.positions : mergePositions($state.snapshot(this.positions), read.positions);
    await this.store?.replaceAll(next);
    this.positions = sortPositions(next);
    if (read.settings?.pmpMode) this.settings.pmpMode = read.settings.pmpMode;
    if (read.settings?.exitFeeRate) this.settings.exitFeeRate = read.settings.exitFeeRate;
    if (read.settings?.entryFeeRate) this.settings.entryFeeRate = read.settings.entryFeeRate;
    this.saveSettings();
  }

  setPrice(asset: string, quote: string, value: Dec | null) {
    const key = priceKey(asset, quote);
    const next = { ...this.prices };
    if (value && value.gt(0)) next[key] = { price: value.toString(), at: new Date().toISOString() };
    else delete next[key];
    this.prices = next;
    this.local.writeJson(PRICES_KEY, next);
  }

  /** Paires actif/devise des positions ouvertes. */
  openPairs(): { asset: string; quote: string }[] {
    const seen = new Map<string, { asset: string; quote: string }>();
    for (const p of this.positions) {
      if (this.states.get(p.id)?.status === 'open') seen.set(priceKey(p.asset, p.quote), { asset: p.asset, quote: p.quote });
    }
    return [...seen.values()];
  }

  /** Cours du jour via Binance (après consentement) pour toutes les positions ouvertes. */
  async fetchPrices(fetcher?: Parameters<typeof fetchTicker>[0]): Promise<void> {
    if (!this.settings.allowPriceFetch) return;
    const pairs = this.openPairs();
    if (pairs.length === 0) {
      this.notify('Aucune position ouverte : aucun cours à récupérer.');
      return;
    }
    this.priceStatus = 'loading';
    this.priceMessage = null;
    try {
      const { prices: ticker } = await fetchTicker(fetcher);
      const next = { ...this.prices };
      const missing: string[] = [];
      const at = new Date().toISOString();
      for (const { asset, quote } of pairs) {
        const q = priceIn(asset, quote, ticker);
        if (q) next[priceKey(asset, quote)] = { price: roundPrice(q.price).toString(), route: q.route, at };
        else missing.push(`${asset}/${quote}`);
      }
      this.prices = next;
      this.local.writeJson(PRICES_KEY, next);
      this.priceStatus = 'idle';
      this.priceMessage = missing.length ? `Sans cours sur Binance : ${missing.join(', ')}. À saisir à la main.` : null;
      this.notify(`Cours mis à jour (${pairs.length - missing.length} sur ${pairs.length}).`);
    } catch (e) {
      this.priceStatus = 'error';
      this.priceMessage = e instanceof PriceFetchError ? e.message : 'Impossible de récupérer les cours.';
    }
  }
}

/** Taux en fraction, borné à [0, 1[ ; 0 si illisible. */
function rate(raw: string): Dec {
  try {
    const d = dec(raw);
    return d.isNeg() || d.gte(1) ? ZERO : d;
  } catch {
    return ZERO;
  }
}

/** Ouvertes d'abord, puis par date de dernier événement, la plus récente en tête. */
export function sortPositions(positions: Position[]): Position[] {
  const last = (p: Position) => p.events.reduce((m, e) => (e.date > m ? e.date : m), '');
  const open = (p: Position) => (computePosition(p).status === 'open' ? 0 : 1);
  return [...positions].sort((a, b) => open(a) - open(b) || (last(a) < last(b) ? 1 : last(a) > last(b) ? -1 : 0));
}

export const app = new AppState();

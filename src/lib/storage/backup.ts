/**
 * Sauvegarde JSON versionnée (carnet D-004, comme pmpa D-016).
 *
 * Format : { app: 'carnet-crypto', schemaVersion, exportedAt, positions, settings? }.
 * Lecture en deux niveaux : une erreur de structure refuse tout le fichier
 * (rien n'est importé) ; une position dont les événements ne se rejouent pas
 * est importée mais signalée, pour correction dans l'interface.
 */
import type { EventKind, Position, Side, TradeEvent } from '../core/model';
import { computePosition } from '../core/position';

export const APP_ID = 'carnet-crypto';
export const SCHEMA_VERSION = 1;

export interface BackupSettings {
  pmpMode?: 'gross' | 'withFees';
  exitFeeRate?: string;
}

export interface Backup {
  app: typeof APP_ID;
  schemaVersion: number;
  exportedAt: string;
  positions: Position[];
  settings?: BackupSettings;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export function makeBackup(positions: readonly Position[], settings?: BackupSettings, now = new Date()): Backup {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    positions: JSON.parse(JSON.stringify(positions)) as Position[],
    ...(settings ? { settings } : {}),
  };
}

const KINDS: readonly EventKind[] = ['open', 'add', 'reduce', 'close'];
const SIDES: readonly Side[] = ['long', 'short'];
const MAX_TEXT = 2000;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(v: unknown, where: string, opts: { optional?: boolean; max?: number } = {}): string | undefined {
  if (v === undefined || v === null) {
    if (opts.optional) return undefined;
    throw new BackupError(`${where} : valeur manquante.`);
  }
  if (typeof v !== 'string') throw new BackupError(`${where} : texte attendu.`);
  if (v.length > (opts.max ?? MAX_TEXT)) throw new BackupError(`${where} : texte trop long.`);
  return v;
}

function decimal(v: unknown, where: string, optional = false): string | undefined {
  const s = text(v, where, { optional, max: 60 });
  if (s === undefined) return undefined;
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new BackupError(`${where} : nombre décimal attendu (« ${s.slice(0, 20)} »).`);
  return s;
}

function readEvent(v: unknown, where: string): TradeEvent {
  if (!isObj(v)) throw new BackupError(`${where} : objet attendu.`);
  const kind = text(v.kind, `${where}, type`) as EventKind;
  if (!KINDS.includes(kind)) throw new BackupError(`${where} : type d'événement inconnu (« ${kind} »).`);
  const event: TradeEvent = {
    id: text(v.id, `${where}, identifiant`, { max: 100 })!,
    kind,
    date: text(v.date, `${where}, date`, { max: 30 })!,
    price: decimal(v.price, `${where}, prix`)!,
    fee: decimal(v.fee ?? '0', `${where}, frais`)!,
  };
  const quantity = decimal(v.quantity, `${where}, quantité`, true);
  if (quantity !== undefined) event.quantity = quantity;
  const note = text(v.note, `${where}, note`, { optional: true });
  if (note) event.note = note;
  const emotion = text(v.emotion, `${where}, émotion`, { optional: true, max: 60 });
  if (emotion) event.emotion = emotion;
  return event;
}

function readPosition(v: unknown, index: number): Position {
  const where = `Position ${index + 1}`;
  if (!isObj(v)) throw new BackupError(`${where} : objet attendu.`);
  const side = text(v.side, `${where}, sens`) as Side;
  if (!SIDES.includes(side)) throw new BackupError(`${where} : sens inconnu (« ${side} »).`);
  if (!Array.isArray(v.events)) throw new BackupError(`${where} : liste d'événements attendue.`);
  const position: Position = {
    id: text(v.id, `${where}, identifiant`, { max: 100 })!,
    asset: text(v.asset, `${where}, actif`, { max: 20 })!.toUpperCase(),
    quote: text(v.quote, `${where}, devise`, { max: 10 })!.toUpperCase(),
    side,
    events: v.events.map((e, i) => readEvent(e, `${where}, événement ${i + 1}`)),
  };
  const note = text(v.note, `${where}, note`, { optional: true });
  if (note) position.note = note;
  return position;
}

export interface ReadResult {
  positions: Position[];
  settings?: BackupSettings;
  /** Positions importées dont les événements ne se rejouent pas : à corriger. */
  warnings: string[];
}

/** Lit et valide une sauvegarde. Lève BackupError si la structure est invalide. */
export function readBackup(raw: string): ReadResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new BackupError("Fichier illisible : ce n'est pas du JSON.");
  }
  if (!isObj(data) || data.app !== APP_ID) throw new BackupError("Ce fichier n'est pas une sauvegarde de carnet-crypto.");
  const version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new BackupError('Version de sauvegarde invalide.');
  if (version > SCHEMA_VERSION) throw new BackupError('Sauvegarde créée par une version plus récente de carnet-crypto : mettez la page à jour.');
  if (!Array.isArray(data.positions)) throw new BackupError('Liste de positions manquante.');
  const positions = data.positions.map(readPosition);
  const ids = new Set<string>();
  for (const p of positions) {
    if (ids.has(p.id)) throw new BackupError(`Identifiant de position en double (« ${p.id} »).`);
    ids.add(p.id);
  }
  let settings: BackupSettings | undefined;
  if (isObj(data.settings)) {
    settings = {};
    if (data.settings.pmpMode === 'gross' || data.settings.pmpMode === 'withFees') settings.pmpMode = data.settings.pmpMode;
    const rate = decimal(data.settings.exitFeeRate, 'Réglages, frais de sortie', true);
    if (rate !== undefined) settings.exitFeeRate = rate;
  }
  const warnings = positions
    .map((p) => ({ p, errors: computePosition(p).errors }))
    .filter(({ errors }) => errors.length > 0)
    .map(({ p, errors }) => `${p.asset}/${p.quote} : ${errors[0].message}`);
  return { positions, settings, warnings };
}

/** Fusion par identifiant : les positions importées remplacent celles qui portent le même id. */
export function mergePositions(current: readonly Position[], imported: readonly Position[]): Position[] {
  const byId = new Map(current.map((p) => [p.id, p]));
  for (const p of imported) byId.set(p.id, p);
  return [...byId.values()];
}

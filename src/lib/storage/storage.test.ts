import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { EXAMPLE } from '../core/example';
import type { Position } from '../core/model';
import { BackupError, makeBackup, mergePositions, readBackup, SCHEMA_VERSION } from './backup';
import { MemoryPositionStore, openPositionStore } from './db';

const other: Position = { ...EXAMPLE, id: 'autre', asset: 'ETH', side: 'short', events: [{ id: 'o', kind: 'open', date: '2026-03-01T10:00', quantity: '1', price: '3000', fee: '0' }] };

describe('IndexedDB', () => {
  it('ajout, lecture, remplacement, suppression ; données persistantes', async () => {
    const store = await openPositionStore();
    expect(store.persistent).toBe(true);
    await store.put(EXAMPLE);
    await store.put(other);
    expect((await store.all()).map((p) => p.id).sort()).toEqual(['autre', 'exemple']);
    await store.remove('autre');
    expect((await store.all()).map((p) => p.id)).toEqual(['exemple']);
    await store.replaceAll([other]);
    expect(await store.all()).toEqual([other]);
    // Réouverture : les données sont toujours là.
    expect((await (await openPositionStore()).all()).map((p) => p.id)).toEqual(['autre']);
  });

  it('sans IndexedDB : repli en mémoire signalé', async () => {
    const store = await openPositionStore(null);
    expect(store).toBeInstanceOf(MemoryPositionStore);
    expect(store.persistent).toBe(false);
    await store.put(EXAMPLE);
    expect(await store.all()).toEqual([EXAMPLE]);
  });
});

describe('sauvegarde JSON', () => {
  it('aller-retour sans perte, réglages compris', () => {
    const raw = JSON.stringify(makeBackup([EXAMPLE, other], { pmpMode: 'withFees', exitFeeRate: '0.001' }));
    const r = readBackup(raw);
    expect(r.positions).toEqual([EXAMPLE, other]);
    expect(r.settings).toEqual({ pmpMode: 'withFees', exitFeeRate: '0.001' });
    expect(r.warnings).toEqual([]);
  });

  it('structure invalide : tout est refusé avec un message clair', () => {
    const base = makeBackup([EXAMPLE]);
    const bad = (patch: (b: Record<string, unknown>) => void) => {
      const b = JSON.parse(JSON.stringify(base));
      patch(b);
      return () => readBackup(JSON.stringify(b));
    };
    expect(() => readBackup('pas du json')).toThrow(/JSON/);
    expect(bad((b) => (b.app = 'pmpa-crypto'))).toThrow(/carnet-crypto/);
    expect(bad((b) => (b.schemaVersion = SCHEMA_VERSION + 1))).toThrow(/plus récente/);
    expect(bad((b) => ((b.positions as Position[])[0].side = 'neutre' as never))).toThrow(/sens inconnu/);
    expect(bad((b) => ((b.positions as Position[])[0].events[0].price = '60 000'))).toThrow(/nombre décimal/);
    expect(bad((b) => ((b.positions as Position[])[0].events[0].kind = 'swap' as never))).toThrow(/type d'événement/);
    expect(bad((b) => (b.positions = [EXAMPLE, EXAMPLE]))).toThrow(/double/);
    expect(bad((b) => delete b.positions)).toThrow(BackupError);
  });

  it('événements incohérents : importés mais signalés', () => {
    const broken: Position = { ...other, id: 'casse', events: [{ id: 'r', kind: 'reduce', date: '2026-03-01T10:00', quantity: '1', price: '1', fee: '0' }] };
    const r = readBackup(JSON.stringify(makeBackup([broken])));
    expect(r.positions).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/ETH\/USDT : Le premier événement doit être une ouverture/);
  });

  it('funding signé conservé, ancienne sauvegarde sans funding lisible', () => {
    const withFunding = { ...other, id: 'f', events: [...other.events, { id: 'c', kind: 'close' as const, date: '2026-03-02T10:00', price: '2900', fee: '1', funding: '-1.5' }] };
    expect(readBackup(JSON.stringify(makeBackup([withFunding]))).positions[0].events[1].funding).toBe('-1.5');
    expect(readBackup(JSON.stringify(makeBackup([other]))).positions[0].events[0].funding).toBeUndefined();
  });

  it('fusion par identifiant', () => {
    const changed = { ...EXAMPLE, note: 'modifiée' };
    expect(mergePositions([EXAMPLE, other], [changed]).map((p) => p.note ?? p.id)).toEqual(['modifiée', 'autre']);
  });
});

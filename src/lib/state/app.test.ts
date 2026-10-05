import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { dec } from 'commun-crypto/money';
import { app, nowLocal } from './app.svelte';

const open = { date: '2026-06-01T10:00', quantity: '1', price: '100', fee: '0.1' };

describe('état de l’application', () => {
  it('création, ajout, refus d’une suite invalide, suppression', async () => {
    await app.init();
    expect(app.loaded).toBe(true);
    expect(app.persistent).toBe(true);
    const r = await app.createPosition({ asset: ' btc ', quote: 'usdt', side: 'long' }, open);
    expect(r.ok).toBe(true);
    const id = r.id!;
    expect(app.position(id)!.asset).toBe('BTC');

    expect(await app.saveEvent(id, { kind: 'add', date: '2026-06-02T10:00', quantity: '1', price: '80', fee: '0' })).toEqual({ ok: true });
    expect(app.states.get(id)!.pmpGross.toString()).toBe('90');

    const refused = await app.saveEvent(id, { kind: 'reduce', date: '2026-06-03T10:00', quantity: '5', price: '120', fee: '0' });
    expect(refused).toEqual({ ok: false, message: 'Quantité supérieure à la quantité détenue (2).' });
    expect(app.position(id)!.events).toHaveLength(2);

    // Modifier l'ajout (même id) puis le supprimer.
    const addId = app.position(id)!.events[1].id;
    expect((await app.saveEvent(id, { id: addId, kind: 'add', date: '2026-06-02T10:00', quantity: '1', price: '60', fee: '0' })).ok).toBe(true);
    expect(app.states.get(id)!.pmpGross.toString()).toBe('80');
    expect((await app.deleteEvent(id, addId)).ok).toBe(true);
    expect(app.states.get(id)!.quantity.toString()).toBe('1');

    // Supprimer l'ouverture alors que d'autres événements existent : refusé.
    await app.saveEvent(id, { kind: 'add', date: '2026-06-04T10:00', quantity: '1', price: '90', fee: '0' });
    const openId = app.position(id)!.events[0].id;
    expect((await app.deleteEvent(id, openId)).ok).toBe(false);
  });

  it('sauvegarde : export puis import en remplacement et en fusion', async () => {
    await app.clearAll();
    await app.loadExample();
    const json = app.backupJson();
    await app.clearAll();
    expect(app.positions).toHaveLength(0);
    await app.applyBackup(app.previewBackup(json), 'replace');
    expect(app.positions).toHaveLength(1);
    await app.applyBackup(app.previewBackup(json), 'merge');
    expect(app.positions).toHaveLength(1);
    // Données relues depuis IndexedDB par un nouvel état ? Vérifié via le magasin dans storage.test.ts.
  });

  it('cours du jour : consentement obligatoire, chemin et arrondi', async () => {
    await app.clearAll();
    await app.createPosition({ asset: 'BTC', quote: 'USDT', side: 'long' }, open);
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => [{ symbol: 'BTCUSDT', price: '61234.5678' }] };
    };
    app.setAllowPriceFetch(false);
    await app.fetchPrices(fetcher);
    expect(calls).toEqual([]);
    app.setAllowPriceFetch(true);
    await app.fetchPrices(fetcher);
    expect(calls).toEqual(['https://data-api.binance.vision/api/v3/ticker/price']);
    expect(app.prices['BTC/USDT']).toMatchObject({ price: '61234.57', route: 'BTCUSDT' });
    expect(app.priceMap.get('BTC/USDT')!.toString()).toBe('61234.57');
    app.setPrice('BTC', 'USDT', dec('0'));
    expect(app.prices['BTC/USDT']).toBeUndefined();
  });

  it('heure locale au format du champ', () => {
    expect(nowLocal(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });
});

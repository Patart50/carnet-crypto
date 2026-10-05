import { describe, expect, it } from 'vitest';
import { EXAMPLE } from '../core/example';
import { computePosition } from '../core/position';
import { eventsCsv, positionsCsv } from './csv';

const states = new Map([[EXAMPLE.id, computePosition(EXAMPLE)]]);

describe('exports pour tableur', () => {
  it('événements : BOM, « ; », virgule décimale, P&L net de la réduction', () => {
    const csv = eventsCsv([EXAMPLE], states);
    expect(csv.startsWith('﻿Position;Actif;Devise')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('exemple;BTC;USDT;Long;2026-02-02 11:00;Réduction;0,08;66000;5,28;58000;630,08;Discipline;Premier objectif.');
  });

  it('positions : une ligne de synthèse', () => {
    const lines = positionsCsv([EXAMPLE], states).trim().split('\r\n');
    expect(lines[1]).toBe('exemple;BTC;USDT;Long;Ouverte;2026-01-05 09:30;;0,07;58000;58058;630,08;13,98;8700;');
  });
});

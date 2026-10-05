<script lang="ts">
  /** Simulateur de renfort sur une position ouverte (carnet D-008, D-012). */
  import { qty } from 'commun-crypto/format';
  import { D, type Dec } from 'commun-crypto/money';
  import { parseNumber } from 'commun-crypto/parse';
  import { app, nowLocal } from '../state/app.svelte';
  import type { Position } from '../core/model';
  import { simulateAdd, simulateTarget, type Simulation } from '../core/simulate';
  import { priceKey } from '../core/stats';
  import { priceIn, rateToPercent } from './format';
  import { amount } from 'commun-crypto/format';

  let { position }: { position: Position } = $props();

  const st = $derived(app.states.get(position.id)!);
  const current = $derived(app.priceMap.get(priceKey(position.asset, position.quote)));
  const quote = $derived(position.quote);
  const mode = $derived(app.settings.pmpMode);

  let kind = $state<'add' | 'target'>('target');
  let priceText = $state('');
  let feeText = $state('0,1');
  let quantityText = $state('');
  let targetText = $state('');

  const read = (s: string): Dec | null => {
    try {
      return parseNumber(s);
    } catch {
      return null;
    }
  };

  type Out =
    | { kind: 'empty'; message: string }
    | { kind: 'ok'; sim: Simulation; limit?: Dec }
    | { kind: 'reached' }
    | { kind: 'unreachable'; limit: Dec }
    | { kind: 'error'; message: string };

  const out = $derived.by<Out>(() => {
    const price = read(priceText) ?? current ?? null;
    const feePct = read(feeText) ?? new D(0);
    if (!price || !price.gt(0)) return { kind: 'empty', message: "Indiquez le prix d'achat envisagé (cours ou ordre limite)." };
    if (feePct.isNeg() || feePct.gte(100)) return { kind: 'error', message: 'Frais : entre 0 et 100 %.' };
    const input = { price, feeRate: feePct.div(100), date: laterThanLast(), exitFeeRate: app.exitFee };
    try {
      if (kind === 'add') {
        const q = read(quantityText);
        if (!q || !q.gt(0)) return { kind: 'empty', message: 'Indiquez la quantité à ajouter.' };
        return { kind: 'ok', sim: simulateAdd(position, q, input, mode) };
      }
      const y = read(targetText);
      if (!y || !y.gt(0)) return { kind: 'empty', message: 'Indiquez le prix moyen visé.' };
      const r = simulateTarget(position, y, input, mode);
      if (r.status === 'ok') return { kind: 'ok', sim: r.simulation, limit: r.limitPrice };
      if (r.status === 'reached') return { kind: 'reached' };
      return { kind: 'unreachable', limit: r.limitPrice };
    } catch (e) {
      return { kind: 'error', message: e instanceof Error ? e.message : 'Simulation impossible.' };
    }
  });

  /** L'ajout simulé est daté après le dernier événement. */
  function laterThanLast(): string {
    const last = position.events.reduce((m, e) => (e.date > m ? e.date : m), '');
    const now = nowLocal();
    return now > last ? now : last;
  }

  const pmpLabel = $derived(mode === 'gross' ? 'Prix moyen brut' : 'Prix moyen frais inclus');
  const better = $derived(position.side === 'long' ? 'baisser' : 'monter');

  // Lien vers renfort-crypto (Long, en euros : renfort raisonne en euros, Long seulement).
  const renfortLink = $derived.by(() => {
    if (position.side !== 'long' || position.quote !== 'EUR' || st.status !== 'open') return null;
    const p = new URLSearchParams();
    p.set('mode', 'cible');
    p.set('a', position.asset);
    p.set('q', st.quantity.toDecimalPlaces(8).toFixed());
    p.set('pmp', st.pmpWithFees.toDecimalPlaces(2).toFixed());
    if (current) p.set('c', current.toFixed());
    p.set('fa', feeText.trim() || '0');
    p.set('fv', rateToPercent(app.settings.exitFeeRate));
    const y = read(targetText);
    if (kind === 'target' && y) p.set('y', y.toFixed());
    return `https://patart50.github.io/renfort-crypto/#partage?${p.toString()}`;
  });
</script>

<section class="panel sim" aria-labelledby="sim-title">
  <h2 id="sim-title">Simuler un renfort</h2>
  <div class="tabs" role="radiogroup" aria-label="Type de simulation">
    <label class:active={kind === 'target'}><input type="radio" name="simkind" value="target" bind:group={kind} /> Viser un prix moyen</label>
    <label class:active={kind === 'add'}><input type="radio" name="simkind" value="add" bind:group={kind} /> Ajouter une quantité</label>
  </div>
  <div class="grid">
    {#if kind === 'target'}
      <label class="field"><span>{pmpLabel} visé ({quote})</span><input inputmode="decimal" autocomplete="off" bind:value={targetText} /></label>
    {:else}
      <label class="field"><span>Quantité à ajouter ({position.asset})</span><input inputmode="decimal" autocomplete="off" bind:value={quantityText} /></label>
    {/if}
    <label class="field">
      <span>Prix d'achat ({quote})</span>
      <input inputmode="decimal" autocomplete="off" placeholder={current ? current.toFixed().replace('.', ',') : ''} bind:value={priceText} aria-describedby="sim-price-help" />
      <small id="sim-price-help">{current ? 'Vide : cours actuel.' : 'Au cours ou à un ordre limite.'}</small>
    </label>
    <label class="field"><span>Frais (%)</span><input inputmode="decimal" autocomplete="off" bind:value={feeText} /></label>
  </div>

  <div class="result" aria-live="polite">
    {#if out.kind === 'empty'}
      <p class="muted">{out.message}</p>
    {:else if out.kind === 'error'}
      <p class="error">{out.message}</p>
    {:else if out.kind === 'reached'}
      <p>Le prix moyen est déjà à ce niveau : aucun ajout nécessaire.</p>
    {:else if out.kind === 'unreachable'}
      <p class="warn">
        Inatteignable à ce prix : pour faire {better} le prix moyen à ce niveau, il faut acheter {position.side === 'long' ? 'sous' : 'au-dessus de'}
        <strong>{priceIn(out.limit, quote)}</strong> (frais compris). Plus on s'en approche, plus la quantité nécessaire explose.
      </p>
    {:else}
      {@const s = out.sim}
      <dl class="figures">
        <div><dt>Quantité à ajouter</dt><dd>{qty(s.quantity)} {position.asset}</dd></div>
        <div><dt>Montant</dt><dd>{amount(s.notional, quote)}</dd></div>
        <div><dt>Frais estimés</dt><dd>{amount(s.fee, quote)}</dd></div>
        <div><dt>{pmpLabel}</dt><dd>{priceIn(s.pmpBefore, quote)} → <strong>{priceIn(s.pmpAfter, quote)}</strong></dd></div>
        <div><dt>Break-even</dt><dd>{s.breakEvenBefore ? priceIn(s.breakEvenBefore, quote) : '—'} → {s.breakEvenAfter ? priceIn(s.breakEvenAfter, quote) : '—'}</dd></div>
        <div><dt>Capital engagé</dt><dd>{amount(s.engagedBefore, quote)} → <strong>{amount(s.engagedAfter, quote)}</strong></dd></div>
      </dl>
      {#if s.worsensPmp}<p class="warn small">Cet ajout dégrade le prix moyen : il {position.side === 'long' ? 'monte' : 'baisse'}.</p>{/if}
      <p class="muted small">
        Renforcer {better === 'baisser' ? 'baisse' : 'monte'} le prix moyen mais augmente l'exposition : le résultat ne dépend que du prix futur et de
        la quantité détenue. Rien n'est enregistré.
      </p>
    {/if}
  </div>
  {#if renfortLink}
    <p class="small"><a href={renfortLink} target="_blank" rel="noopener">Analyse complète dans renfort-crypto</a> <span class="muted">(scénarios de baisse, graphique)</span></p>
  {/if}
</section>

<style>
  .sim {
    padding: 1rem;
    display: grid;
    gap: 0.8rem;
  }
  h2 {
    font-size: 1.1rem;
  }
  .tabs {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .tabs label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius);
    padding: 0.35rem 0.7rem;
    cursor: pointer;
    font-size: 0.92rem;
  }
  .tabs label.active {
    border-color: var(--accent);
    background: var(--accent-soft);
    font-weight: 600;
  }
  .tabs input {
    width: auto;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.75rem;
  }
  .result {
    display: grid;
    gap: 0.5rem;
  }
  .result p {
    margin: 0;
  }
  .figures {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.5rem 1rem;
    margin: 0;
  }
  dt {
    font-size: 0.78rem;
    color: var(--muted);
  }
  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .warn {
    color: var(--warn);
  }
  .error {
    color: var(--loss);
  }
  .small {
    font-size: 0.85rem;
    margin: 0;
  }
</style>

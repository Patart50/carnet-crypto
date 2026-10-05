<script lang="ts">
  /** Liste des positions avec filtres (SPEC § 7). */
  import { amountSigned, qty } from 'commun-crypto/format';
  import { app, nowLocal } from '../state/app.svelte';
  import { SIDE_LABELS } from '../core/model';
  import { displayedPmp, durationMs, latentNet } from '../core/position';
  import { priceKey } from '../core/stats';
  import { durationLabel, priceIn } from './format';
  import PriceFetch from './PriceFetch.svelte';

  let status = $state<'all' | 'open' | 'closed'>('all');
  let side = $state<'all' | 'long' | 'short'>('all');
  let asset = $state('');
  let quote = $state('');
  let emotion = $state('');

  const assets = $derived([...new Set(app.positions.map((p) => p.asset))].sort());
  const quotes = $derived([...new Set(app.positions.map((p) => p.quote))].sort());
  const emotions = $derived([...new Set(app.positions.flatMap((p) => p.events.map((e) => e.emotion).filter((e): e is string => !!e)))].sort());
  const now = nowLocal();

  const rows = $derived(
    app.positions
      .map((p) => ({ p, st: app.states.get(p.id)! }))
      .filter(({ p, st }) => {
        if (status !== 'all' && st.status !== status) return false;
        if (side !== 'all' && p.side !== side) return false;
        if (asset && p.asset !== asset) return false;
        if (quote && p.quote !== quote) return false;
        if (emotion && !p.events.some((e) => e.emotion === emotion)) return false;
        return true;
      })
      .map(({ p, st }) => {
        const price = app.priceMap.get(priceKey(p.asset, p.quote));
        return { p, st, latent: st.status === 'open' && price ? latentNet(st, price, app.exitFee) : null };
      }),
  );

  const filtered = $derived(status !== 'all' || side !== 'all' || !!asset || !!quote || !!emotion);
  const hasOpen = $derived(rows.some((r) => r.st.status === 'open'));

  function reset() {
    status = 'all';
    side = 'all';
    asset = quote = emotion = '';
  }
</script>

<section class="list" aria-labelledby="positions-title">
  <div class="head">
    <h1 id="positions-title">Positions</h1>
    <a class="btn btn-primary" href="#nouvelle">Ouvrir une position</a>
  </div>

  <div class="filters" role="group" aria-label="Filtres">
    <label class="field"><span>Statut</span>
      <select bind:value={status}>
        <option value="all">Toutes</option>
        <option value="open">Ouvertes</option>
        <option value="closed">Fermées</option>
      </select>
    </label>
    <label class="field"><span>Sens</span>
      <select bind:value={side}>
        <option value="all">Long et Short</option>
        <option value="long">Long</option>
        <option value="short">Short</option>
      </select>
    </label>
    <label class="field"><span>Crypto</span>
      <select bind:value={asset}>
        <option value="">Toutes</option>
        {#each assets as a (a)}<option value={a}>{a}</option>{/each}
      </select>
    </label>
    <label class="field"><span>Devise</span>
      <select bind:value={quote}>
        <option value="">Toutes</option>
        {#each quotes as q (q)}<option value={q}>{q}</option>{/each}
      </select>
    </label>
    <label class="field"><span>Émotion</span>
      <select bind:value={emotion}>
        <option value="">Toutes</option>
        {#each emotions as e (e)}<option value={e}>{e}</option>{/each}
      </select>
    </label>
    {#if filtered}<button class="btn btn-quiet btn-small reset" type="button" onclick={reset}>Effacer les filtres</button>{/if}
  </div>

  {#if hasOpen}<PriceFetch />{/if}

  {#if rows.length === 0}
    <p class="muted">Aucune position ne correspond aux filtres.</p>
  {:else}
    <p class="sr-only" aria-live="polite">{rows.length} position{rows.length > 1 ? 's' : ''} affichée{rows.length > 1 ? 's' : ''}.</p>
    <ul class="cards">
      {#each rows as { p, st, latent } (p.id)}
        <li class="card" class:closed={st.status === 'closed'}>
          <div class="title">
            <a href={`#position/${p.id}`} class="name">{p.asset}<span class="muted">/{p.quote}</span></a>
            <span class="badge" class:short={p.side === 'short'}>{SIDE_LABELS[p.side]}</span>
            <span class="status">{st.status === 'open' ? 'Ouverte' : st.status === 'closed' ? 'Fermée' : 'Vide'}</span>
            {#if st.errors.length}<span class="warn" title={st.errors[0].message}>À corriger</span>{/if}
          </div>
          <dl>
            {#if st.status === 'open'}
              <div><dt>Quantité</dt><dd>{qty(st.quantity)}</dd></div>
              <div><dt>Prix moyen</dt><dd>{priceIn(displayedPmp(st, app.settings.pmpMode), p.quote)}</dd></div>
            {/if}
            <div>
              <dt>Réalisé net</dt>
              <dd class:gain={st.realizedNet.gt(0)} class:loss={st.realizedNet.lt(0)}>{amountSigned(st.realizedNet, p.quote)}</dd>
            </div>
            {#if st.status === 'open'}
              <div>
                <dt>Latent net</dt>
                <dd class:gain={latent?.gt(0)} class:loss={latent?.lt(0)}>{latent ? amountSigned(latent, p.quote) : 'cours inconnu'}</dd>
              </div>
            {/if}
            <div><dt>Durée</dt><dd>{durationLabel(durationMs(st, now))}</dd></div>
          </dl>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .list {
    display: grid;
    gap: 1rem;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  h1 {
    font-size: 1.5rem;
  }
  .filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: 0.6rem;
    align-items: end;
  }
  .reset {
    justify-self: start;
  }
  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.6rem;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--radius-lg);
    padding: 0.8rem 1rem;
    display: grid;
    gap: 0.6rem;
    position: relative;
  }
  .card:hover {
    border-color: var(--rule-strong);
  }
  .card.closed {
    background: var(--surface-2);
  }
  .title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .name {
    font-weight: 650;
    font-size: 1.05rem;
    color: var(--ink);
    text-decoration: none;
  }
  /* Toute la carte est cliquable via le lien du titre. */
  .name::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--radius-lg);
  }
  .name:focus-visible::after {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .name:focus-visible {
    outline: none;
  }
  .badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.05rem 0.5rem;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
  }
  .badge.short {
    background: var(--warn-bg);
    color: var(--warn);
  }
  .status {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .warn {
    font-size: 0.78rem;
    color: var(--loss);
    font-weight: 600;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.4rem 1rem;
    margin: 0;
  }
  dt {
    font-size: 0.75rem;
    color: var(--muted);
  }
  dd {
    margin: 0;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>

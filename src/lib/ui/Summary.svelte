<script lang="ts">
  /** Résumé par devise de cotation (carnet D-006, D-007). */
  import { amount, amountSigned, pct } from 'commun-crypto/format';
  import { app } from '../state/app.svelte';
  import { computeStats, statsByEmotion } from '../core/stats';
  import PriceFetch from './PriceFetch.svelte';

  const stats = $derived(computeStats(app.positions, { prices: app.priceMap, exitFeeRate: app.exitFee }, app.states));
  const emotions = $derived(statsByEmotion(app.positions, app.states));
  const anyOpen = $derived(stats.some((s) => s.open > 0));
</script>

<section class="summary" aria-labelledby="summary-title">
  <h1 id="summary-title" tabindex="-1">Résumé</h1>
  <p class="muted intro">
    Statistiques nettes de frais, par devise de cotation, sur les positions fermées. Un gain brut effacé par les frais compte comme une perte ;
    le winrate ne se lit jamais sans le profit factor et l'espérance.
  </p>
  {#if anyOpen}<PriceFetch />{/if}

  {#if stats.length === 0}
    <p class="muted">Aucune position pour l'instant.</p>
  {/if}

  {#each stats as s (s.quote)}
    <article class="panel quote" aria-labelledby={`q-${s.quote}`}>
      <h2 id={`q-${s.quote}`}>{s.quote}</h2>
      <dl class="tiles">
        <div>
          <dt>Réalisé net</dt>
          <dd class:gain={s.realizedNet.gt(0)} class:loss={s.realizedNet.lt(0)}>{amountSigned(s.realizedNet, s.quote)}</dd>
          <dd class="sub">fermées et réductions des ouvertes</dd>
        </div>
        <div>
          <dt>Latent net</dt>
          <dd class:gain={s.latentNet.gt(0)} class:loss={s.latentNet.lt(0)}>{s.open === 0 ? '—' : amountSigned(s.latentNet, s.quote)}</dd>
          <dd class="sub">
            {s.open} ouverte{s.open > 1 ? 's' : ''}{s.openWithoutPrice ? ` · ${s.openWithoutPrice} sans cours (non comptée${s.openWithoutPrice > 1 ? 's' : ''})` : ''}
          </dd>
        </div>
        <div>
          <dt>Espérance par trade</dt>
          <dd class:gain={s.expectancy?.gt(0)} class:loss={s.expectancy?.lt(0)}>{s.expectancy ? amountSigned(s.expectancy, s.quote) : '—'}</dd>
          <dd class="sub">P&amp;L net moyen d'une position fermée</dd>
        </div>
        <div>
          <dt>Winrate</dt>
          <dd>{s.winrate ? `${s.winrate.toDecimalPlaces(1).toFixed(1).replace('.', ',')} %` : '—'}</dd>
          <dd class="sub">{s.wins} gagnante{s.wins > 1 ? 's' : ''} · {s.losses} perdante{s.losses > 1 ? 's' : ''} sur {s.closed}</dd>
        </div>
        <div>
          <dt>Profit factor</dt>
          <dd>{s.profitFactor ? s.profitFactor.toDecimalPlaces(2).toFixed(2).replace('.', ',') : s.closed > 0 && s.losses === 0 ? 'aucune perte' : '—'}</dd>
          <dd class="sub">gains ÷ pertes ; sous 1, la stratégie perd</dd>
        </div>
        <div>
          <dt>Gain moyen · perte moyenne</dt>
          <dd>{s.avgWin ? amount(s.avgWin, s.quote) : '—'} · <span class:loss={s.avgLoss?.lt(0)}>{s.avgLoss ? amountSigned(s.avgLoss, s.quote) : '—'}</span></dd>
        </div>
        <div>
          <dt>Meilleure · pire</dt>
          <dd class="links">
            {#if s.best}<a href={`#position/${s.best.positionId}`}>{s.best.asset} {amountSigned(s.best.net, s.quote)}</a>{:else}—{/if}
            ·
            {#if s.worst}<a href={`#position/${s.worst.positionId}`}>{s.worst.asset} {amountSigned(s.worst.net, s.quote)}</a>{:else}—{/if}
          </dd>
        </div>
        <div>
          <dt>Frais payés</dt>
          <dd>{amount(s.feesTotal, s.quote)}</dd>
        </div>
        {#if !s.fundingTotal.isZero()}
          <div>
            <dt>Funding et intérêts</dt>
            <dd class:loss={s.fundingTotal.gt(0)} class:gain={s.fundingTotal.lt(0)}>{amountSigned(s.fundingTotal.neg(), s.quote)}</dd>
            <dd class="sub">{s.fundingTotal.gt(0) ? 'payés' : 'reçus'}, inclus dans le réalisé</dd>
          </div>
        {/if}
      </dl>
      {#if s.winrate && s.expectancy && s.winrate.gte(50) && s.expectancy.lt(0)}
        <p class="notice"><strong>À noter :</strong>&nbsp;plus de la moitié des trades sont gagnants, mais l'espérance est négative : les pertes pèsent plus que les gains.</p>
      {/if}
    </article>
  {/each}

  {#if emotions.length > 0}
    <section class="panel emo" aria-labelledby="emo-title">
      <h2 id="emo-title">Par émotion à l'ouverture</h2>
      <p class="muted small">Positions fermées, regroupées selon l'émotion notée à l'ouverture, de la plus coûteuse à la plus rentable.</p>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="table-wrap" role="region" aria-label="Résultats par émotion" tabindex="0">
        <table>
          <thead>
            <tr><th scope="col">Émotion</th><th scope="col">Devise</th><th scope="col">Fermées</th><th scope="col">Winrate</th><th scope="col">Réalisé net</th></tr>
          </thead>
          <tbody>
            {#each emotions as e (e.quote + e.emotion)}
              <tr>
                <td>{e.emotion}</td>
                <td>{e.quote}</td>
                <td>{e.closed}</td>
                <td>{pct(e.winrate).replace('+', '')}</td>
                <td class:gain={e.realizedNet.gt(0)} class:loss={e.realizedNet.lt(0)}>{amountSigned(e.realizedNet, e.quote)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
</section>

<style>
  .summary {
    display: grid;
    gap: 1rem;
  }
  h1 {
    font-size: 1.5rem;
  }
  h1:focus {
    outline: none;
  }
  .intro {
    max-width: 46rem;
    margin: 0;
    font-size: 0.92rem;
  }
  .quote,
  .emo {
    padding: 1rem;
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  h2 {
    font-size: 1.15rem;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.9rem 1.2rem;
    margin: 0;
  }
  dt {
    font-size: 0.78rem;
    color: var(--muted);
  }
  dd {
    margin: 0;
    font-weight: 650;
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
  }
  dd.sub {
    font-weight: 400;
    font-size: 0.78rem;
    color: var(--muted);
  }
  .links {
    font-size: 0.95rem;
  }
  .small {
    font-size: 0.85rem;
    margin: 0;
  }
  .table-wrap:focus-visible {
    outline: 2px solid var(--focus);
  }
</style>

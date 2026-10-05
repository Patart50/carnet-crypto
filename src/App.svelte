<script lang="ts">
  /**
   * Page d'attente (J1) : présentation et aperçu du moteur sur une position fictive.
   * L'interface complète arrive en J2.
   */
  import ThemeToggle from 'commun-crypto/ui/ThemeToggle.svelte';
  import Support from 'commun-crypto/ui/Support.svelte';
  import { applyTheme, isTheme, type Theme } from 'commun-crypto/theme';
  import { openLocalStore } from 'commun-crypto/storage';
  import { AUTHOR } from 'commun-crypto/support';
  import { amount, amountSigned, dateFr, qty } from 'commun-crypto/format';
  import { dec } from 'commun-crypto/money';
  import { SUPPORT_INTRO } from './lib/ui/supportIntro';
  import { EXAMPLE } from './lib/core/example';
  import { KIND_LABELS, SIDE_LABELS } from './lib/core/model';
  import { breakEven, computePosition, latentNet } from './lib/core/position';
  import { simulateTarget } from './lib/core/simulate';

  const store = openLocalStore('carnet-crypto:');
  const saved = store.readJson<{ theme?: unknown }>('reglages');
  let theme = $state<Theme>(isTheme(saved?.theme) ? saved.theme : 'auto');

  function setTheme(t: Theme) {
    theme = t;
    store.writeJson('reglages', { theme: t });
  }

  $effect(() => applyTheme(theme));

  // Aperçu : la position fictive, rejouée par le moteur.
  const quote = EXAMPLE.quote;
  const st = computePosition(EXAMPLE);
  const price = dec('63000');
  const latent = latentNet(st, price);
  const be = breakEven(st);
  const target = simulateTarget(EXAMPLE, dec('55000'), { price: dec('50000'), feeRate: dec('0.001'), date: '2026-02-10T10:00' });
</script>

<a class="skip" href="#contenu">Aller au contenu</a>

<header class="top">
  <div class="top-inner">
    <div class="brand">
      <a class="brand-name" href="./" aria-label="carnet-crypto, accueil">carnet-crypto</a>
      <span class="brand-tag"
        ><span class="tagline">Carnet de trades ·&nbsp;</span>par
        <a href={AUTHOR.url} target="_blank" rel="noopener author">{AUTHOR.name} ({AUTHOR.handle})</a></span
      >
    </div>
    <div class="top-actions">
      <span class="local" title="Aucune donnée n'est envoyée sur Internet">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
          ><path d="M8 1.5 2.5 3.8v3.7c0 3.2 2.3 6 5.5 7 3.2-1 5.5-3.8 5.5-7V3.8L8 1.5Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg
        >
        100 % local
      </span>
      <ThemeToggle {theme} onchange={setTheme} />
    </div>
  </div>
</header>

<main id="contenu" tabindex="-1">
  <section class="intro" aria-labelledby="titre">
    <p class="badge">En construction</p>
    <h1 id="titre">Un carnet de trades honnête, qui reste chez vous</h1>
    <p>
      Suivez chaque position, Long ou Short, de l'ouverture à la clôture : renforts, clôtures partielles, prix moyen pondéré, P&amp;L
      réalisé et latent <strong>nets de frais</strong>, notes et émotions. Les statistiques ne montrent jamais le winrate seul : gain
      moyen, perte moyenne, profit factor et espérance l'accompagnent.
    </p>
    <p class="muted">Aucun compte, aucune donnée envoyée : tout reste dans votre navigateur. L'interface complète arrive bientôt.</p>
  </section>

  <section class="card" aria-labelledby="apercu">
    <h2 id="apercu">Aperçu du moteur</h2>
    <p class="muted small">
      Position fictive : {SIDE_LABELS[EXAMPLE.side]} {EXAMPLE.asset}/{quote}, calculée en direct par le moteur du carnet.
    </p>
    <!-- Zone défilante sur petit écran : focusable pour le défilement au clavier (axe scrollable-region-focusable, motif WAI « region »). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="table-wrap" role="region" aria-label="Fil des événements" tabindex="0">
      <table>
        <caption class="sr-only">Fil des événements de la position fictive</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Événement</th>
            <th scope="col" class="num">Quantité</th>
            <th scope="col" class="num">Prix</th>
            <th scope="col" class="num">PMP après</th>
            <th scope="col" class="num">P&amp;L net</th>
          </tr>
        </thead>
        <tbody>
          {#each st.steps as step (step.event.id)}
            <tr>
              <td>{dateFr(step.event.date)}</td>
              <td>{KIND_LABELS[step.event.kind]}{#if step.event.emotion}<span class="tag">{step.event.emotion}</span>{/if}</td>
              <td class="num">{qty(dec(step.event.quantity ?? '0'))}</td>
              <td class="num">{amount(dec(step.event.price), quote)}</td>
              <td class="num">{amount(step.pmpGross, quote)}</td>
              <td class="num">{step.realization ? amountSigned(step.realization.net, quote) : '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <dl class="figures">
      <div><dt>Quantité restante</dt><dd>{qty(st.quantity)} {EXAMPLE.asset}</dd></div>
      <div><dt>Réalisé net</dt><dd class:gain={st.realizedNet.gt(0)}>{amountSigned(st.realizedNet, quote)}</dd></div>
      <div><dt>Latent net à {amount(price, quote, 0)}</dt><dd class:gain={latent.gt(0)} class:loss={latent.lt(0)}>{amountSigned(latent, quote)}</dd></div>
      <div><dt>Break-even</dt><dd>{be ? amount(be, quote) : '—'}</dd></div>
      <div><dt>Frais payés</dt><dd>{amount(st.feesTotal, quote)}</dd></div>
    </dl>
    {#if target.status === 'ok'}
      <p class="small">
        Simulateur : pour ramener le PMP à {amount(dec('55000'), quote, 0)} en achetant à {amount(dec('50000'), quote, 0)}, il faudrait
        ajouter {qty(target.simulation.quantity)} {EXAMPLE.asset}, soit {amount(target.simulation.notional, quote)}. Capital engagé :
        {amount(target.simulation.engagedBefore, quote)} → {amount(target.simulation.engagedAfter, quote)}.
      </p>
    {/if}
  </section>
</main>

<footer class="foot">
  <p>
    Outil de suivi, pas un conseil en investissement. Pour la fiscalité (plus-values, formulaire 2086), voir
    <a href="https://patart50.github.io/pmpa-crypto/" target="_blank" rel="noopener">pmpa-crypto</a>. Code source libre (AGPL-3.0) sur
    <a href="https://github.com/Patart50/carnet-crypto" rel="noopener" target="_blank">GitHub</a> · v{__APP_VERSION__}
  </p>
  <p class="credit">
    Créé par <a href={AUTHOR.url} target="_blank" rel="noopener author">{AUTHOR.name} ({AUTHOR.handle})</a> · <Support intro={SUPPORT_INTRO} />
  </p>
</footer>

<style>
  .skip {
    position: absolute;
    left: 1rem;
    top: -3rem;
    z-index: 100;
    background: var(--accent);
    color: var(--on-accent);
    padding: 0.5rem 0.8rem;
    border-radius: var(--radius);
    font-weight: 600;
  }
  .skip:focus {
    top: 0.5rem;
  }
  main:focus {
    outline: none;
  }
  .top {
    background: var(--surface);
    border-bottom: 1px solid var(--rule);
  }
  .top-inner,
  main,
  .foot {
    max-width: 60rem;
    margin: 0 auto;
    padding-inline: 1rem;
  }
  .top-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-block: 0.9rem;
  }
  .brand {
    display: grid;
  }
  .brand-name {
    text-decoration: none;
    color: var(--ink);
    width: fit-content;
    font-family: var(--font-doc);
    font-size: 1.45rem;
    font-weight: 650;
    letter-spacing: -0.01em;
  }
  .brand-tag {
    font-size: 0.82rem;
    color: var(--muted);
  }
  .top-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .local {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.82rem;
    color: var(--gain);
    padding-inline: 0.4rem;
  }
  main {
    padding-block: 2rem 3rem;
    display: grid;
    gap: 1.5rem;
    min-width: 0;
  }
  .intro {
    display: grid;
    gap: 0.8rem;
    max-width: 42rem;
  }
  .intro h1 {
    font-size: 1.8rem;
    line-height: 1.2;
  }
  .badge {
    width: fit-content;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--warn);
    background: var(--warn-bg);
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 1.1rem;
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .card h2 {
    font-size: 1.15rem;
  }
  .table-wrap {
    overflow-x: auto;
  }
  .table-wrap:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.45rem 0.5rem;
    border-bottom: 1px solid var(--rule);
    white-space: nowrap;
  }
  th {
    font-weight: 600;
    color: var(--muted);
    font-size: 0.8rem;
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .tag {
    margin-left: 0.4rem;
    font-size: 0.75rem;
    color: var(--muted);
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 0 0.4rem;
  }
  .figures {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 0.6rem 1rem;
    margin: 0;
  }
  .figures dt {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .figures dd {
    margin: 0;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .gain {
    color: var(--gain);
  }
  .loss {
    color: var(--loss);
  }
  .small {
    font-size: 0.88rem;
  }
  @media (max-width: 560px) {
    .tagline {
      display: none;
    }
  }
  .foot {
    padding-block: 0 2.5rem;
    font-size: 0.82rem;
    color: var(--muted);
  }
  .foot p:first-child {
    border-top: 1px solid var(--rule);
    padding-top: 1.5rem;
  }
  .credit {
    margin-top: 0.4rem;
  }
</style>

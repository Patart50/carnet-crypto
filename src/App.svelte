<script lang="ts">
  /**
   * Carnet de trades (J2). Navigation par ancre :
   * #positions (défaut), #nouvelle, #position/<id>, #resume.
   */
  import { onMount, tick } from 'svelte';
  import ThemeToggle from 'commun-crypto/ui/ThemeToggle.svelte';
  import Support from 'commun-crypto/ui/Support.svelte';
  import { applyTheme } from 'commun-crypto/theme';
  import { AUTHOR } from 'commun-crypto/support';
  import { app } from './lib/state/app.svelte';
  import { SUPPORT_INTRO } from './lib/ui/supportIntro';
  import PositionList from './lib/ui/PositionList.svelte';
  import PositionDetail from './lib/ui/PositionDetail.svelte';
  import NewPosition from './lib/ui/NewPosition.svelte';
  import Summary from './lib/ui/Summary.svelte';
  import Settings from './lib/ui/Settings.svelte';

  type View = { name: 'positions' } | { name: 'nouvelle' } | { name: 'resume' } | { name: 'position'; id: string };

  function readView(hash = location.hash): View {
    if (hash === '#nouvelle') return { name: 'nouvelle' };
    if (hash === '#resume') return { name: 'resume' };
    const m = /^#position\/([\w-]{1,100})$/.exec(hash);
    if (m) return { name: 'position', id: m[1] };
    return { name: 'positions' };
  }

  let view = $state<View>(readView());
  let settings: Settings;

  onMount(() => {
    void app.init();
    const onHash = async () => {
      view = readView();
      scrollTo(0, 0);
      await tick();
      document.querySelector<HTMLElement>('main h1')?.focus();
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  });

  $effect(() => applyTheme(app.settings.theme));

  async function example() {
    const id = await app.loadExample();
    app.notify('Exemple chargé : position fictive BTC/USDT.');
    location.hash = `#position/${id}`;
  }

  const tab = $derived(view.name === 'resume' ? 'resume' : 'positions');
</script>

<a class="skip" href="#contenu">Aller au contenu</a>

<header class="top">
  <div class="top-inner">
    <div class="brand">
      <a class="brand-name" href="#positions" aria-label="carnet-crypto, positions">carnet-crypto</a>
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
        <span class="local-text">100 % local</span>
      </span>
      <button class="btn btn-quiet" type="button" onclick={() => settings.open()} aria-label="Réglages et sauvegarde" title="Réglages et sauvegarde">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"
          ><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /><circle cx="7" cy="5" r="1.8" fill="var(--surface)" stroke="currentColor" stroke-width="1.4" /><circle cx="13" cy="10" r="1.8" fill="var(--surface)" stroke="currentColor" stroke-width="1.4" /><circle cx="8" cy="15" r="1.8" fill="var(--surface)" stroke="currentColor" stroke-width="1.4" /></svg
        >
      </button>
      <ThemeToggle theme={app.settings.theme} onchange={(t) => app.setTheme(t)} />
    </div>
  </div>
  <nav class="tabs" aria-label="Sections">
    <a href="#positions" aria-current={tab === 'positions' ? 'page' : undefined}>Positions</a>
    <a href="#resume" aria-current={tab === 'resume' ? 'page' : undefined}>Résumé</a>
  </nav>
</header>

<main id="contenu" tabindex="-1">
  {#if app.loaded && !app.persistent}
    <p class="notice" role="status">
      <strong>Stockage indisponible :</strong>&nbsp;le navigateur bloque l'enregistrement. Vos saisies seront perdues à la fermeture ; exportez une sauvegarde.
    </p>
  {/if}

  {#if !app.loaded}
    <p class="muted">Chargement du carnet…</p>
  {:else if view.name === 'nouvelle'}
    <NewPosition />
  {:else if view.name === 'position'}
    <PositionDetail id={view.id} />
  {:else if view.name === 'resume'}
    <Summary />
  {:else if app.positions.length === 0}
    <section class="welcome" aria-labelledby="welcome-title">
      <h1 id="welcome-title" tabindex="-1">Un carnet de trades honnête, qui reste chez vous</h1>
      <p>
        Suivez chaque position, Long ou Short, de l'ouverture à la clôture : renforts, clôtures partielles, prix moyen pondéré, P&amp;L réalisé
        et latent <strong>nets de frais</strong>, notes et émotions. Les statistiques ne montrent jamais le winrate seul.
      </p>
      <div class="actions">
        <a class="btn btn-primary" href="#nouvelle">Ouvrir une position</a>
        <button class="btn" type="button" onclick={example}>Charger un exemple</button>
      </div>
      <p class="muted small">Aucun compte, aucune donnée envoyée : tout reste dans ce navigateur. Pensez à exporter une sauvegarde (menu Réglages).</p>
    </section>
  {:else}
    <PositionList />
  {/if}
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

<Settings bind:this={settings} />

{#if app.toast}
  <div class="toast" role="status" aria-live="polite">{app.toast}</div>
{/if}

<style>
  /* Liens présentés en boutons : pas de soulignement. */
  :global(a.btn) {
    text-decoration: none;
  }
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
  .tabs,
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
    padding-block: 0.8rem 0.4rem;
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
    gap: 0.2rem;
  }
  .local {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.82rem;
    color: var(--gain);
    padding-inline: 0.4rem;
  }
  .tabs {
    display: flex;
    gap: 0.2rem;
  }
  .tabs a {
    padding: 0.5rem 0.8rem;
    text-decoration: none;
    color: var(--muted);
    font-weight: 550;
    border-bottom: 2px solid transparent;
  }
  .tabs a[aria-current='page'] {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }
  main {
    padding-block: 1.5rem 3rem;
    display: grid;
    gap: 1rem;
    min-width: 0;
  }
  .welcome {
    display: grid;
    gap: 0.9rem;
    max-width: 42rem;
    padding-block: 1rem;
  }
  .welcome h1 {
    font-size: 1.8rem;
    line-height: 1.2;
  }
  .welcome h1:focus {
    outline: none;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .small {
    font-size: 0.86rem;
  }
  @media (max-width: 560px) {
    .tagline,
    .local-text {
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
  .toast {
    position: fixed;
    left: 50%;
    bottom: 1.25rem;
    transform: translateX(-50%);
    background: var(--ink);
    color: var(--paper);
    padding: 0.6rem 1rem;
    border-radius: var(--radius);
    box-shadow: var(--shadow-pop);
    font-size: 0.92rem;
    z-index: 50;
    max-width: calc(100vw - 2rem);
  }
</style>

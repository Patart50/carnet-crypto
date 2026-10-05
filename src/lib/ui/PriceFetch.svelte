<script lang="ts">
  /**
   * Cours du jour via Binance, en opt-in (comme renfort D-013) : une seule requête,
   * la liste publique de tous les cours ; aucune crypto ni montant n'est envoyé.
   */
  import { app } from '../state/app.svelte';

  let asking = $state(false);

  function click() {
    if (app.settings.allowPriceFetch) void app.fetchPrices();
    else asking = true;
  }

  function accept() {
    app.setAllowPriceFetch(true);
    asking = false;
    void app.fetchPrices();
  }
</script>

<div class="prices">
  <button class="btn btn-small" type="button" onclick={click} disabled={app.priceStatus === 'loading'} aria-expanded={asking}>
    {app.priceStatus === 'loading' ? 'Chargement des cours…' : 'Mettre à jour les cours (Binance)'}
  </button>
  <span class="muted small">Cours utilisés pour le latent ; modifiables dans chaque position.</span>
  {#if app.priceMessage}<p class="small" class:err={app.priceStatus === 'error'} role="status">{app.priceMessage}</p>{/if}
</div>

{#if asking}
  <div class="consent panel" role="region" aria-label="Autorisation de contacter Binance">
    <p>
      <strong>Contacter Binance ?</strong> L'outil télécharge la liste publique de tous les cours (une requête). Binance voit votre adresse
      IP, mais aucune crypto, quantité ni montant n'est envoyé. Le choix est mémorisé et se retire dans les réglages.
    </p>
    <div class="actions">
      <button class="btn btn-primary btn-small" type="button" onclick={accept}>Autoriser et récupérer</button>
      <button class="btn btn-quiet btn-small" type="button" onclick={() => (asking = false)}>Saisir à la main</button>
    </div>
  </div>
{/if}

<style>
  .prices {
    display: flex;
    align-items: center;
    gap: 0.4rem 0.8rem;
    flex-wrap: wrap;
  }
  .prices p {
    flex-basis: 100%;
    margin: 0;
  }
  .small {
    font-size: 0.82rem;
  }
  .err {
    color: var(--loss);
  }
  .consent {
    padding: 0.9rem 1rem;
    display: grid;
    gap: 0.6rem;
    font-size: 0.92rem;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
</style>

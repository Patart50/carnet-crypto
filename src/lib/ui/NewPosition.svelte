<script lang="ts">
  /** Ouverture d'une position : actif, devise, sens, puis l'événement d'ouverture. */
  import { app, nowLocal } from '../state/app.svelte';
  import type { Side } from '../core/model';
  import EventFields from './EventFields.svelte';
  import Combobox from './Combobox.svelte';
  import { emptyEventForm, parseEventForm, type EventField } from './eventForm';

  let asset = $state('');
  let quote = $state('USDT');
  let side = $state<Side>('long');
  let positionNote = $state('');
  let values = $state(emptyEventForm('open', nowLocal()));
  let errors = $state<Partial<Record<EventField, string>>>({});
  let metaError = $state<string | null>(null);
  let formError = $state<string | null>(null);
  let saving = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    formError = null;
    metaError = !/^[A-Za-z0-9]{1,20}$/.test(asset.trim()) ? 'Crypto : symbole de 1 à 20 lettres ou chiffres (ex. BTC).' : !/^[A-Za-z0-9]{2,10}$/.test(quote.trim()) ? 'Devise : 2 à 10 lettres ou chiffres (ex. USDT).' : null;
    const parsed = parseEventForm(values);
    errors = parsed.ok ? {} : parsed.errors;
    if (metaError || !parsed.ok) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    saving = true;
    const r = await app.createPosition({ asset, quote, side, note: positionNote }, parsed.event);
    saving = false;
    if (!r.ok) {
      formError = r.message;
      return;
    }
    app.notify(`Position ${asset.toUpperCase()}/${quote.toUpperCase()} ouverte.`);
    location.hash = `#position/${r.id}`;
  }
</script>

<section class="new" aria-labelledby="new-title">
  <p><a href="#positions">← Positions</a></p>
  <h1 id="new-title" tabindex="-1">Ouvrir une position</h1>

  <form class="panel" onsubmit={submit} novalidate>
    <div class="grid">
      <div class="field">
        <label for="new-asset">Crypto</label>
        <Combobox id="new-asset" bind:value={asset} options={app.assetOptions} placeholder="BTC" invalid={!!metaError && metaError.startsWith('Crypto')} describedby="asset-help" />
        <small id="asset-help">Liste : vos cryptos, puis les principales.</small>
      </div>
      <div class="field">
        <label for="new-quote">Devise de cotation</label>
        <Combobox id="new-quote" bind:value={quote} options={app.quoteOptions} maxlength={10} invalid={!!metaError && metaError.startsWith('Devise')} describedby="quote-help" />
        <small id="quote-help">Totaux par devise, jamais additionnés.</small>
      </div>
      <fieldset class="field side">
        <legend>Sens</legend>
        <div class="seg">
          <label><input type="radio" name="side" value="long" bind:group={side} /> Long</label>
          <label><input type="radio" name="side" value="short" bind:group={side} /> Short</label>
        </div>
      </fieldset>
    </div>
    {#if metaError}<p class="error" role="alert">{metaError}</p>{/if}

    <h2>Ouverture</h2>
    <EventFields bind:values {errors} quote={quote.toUpperCase()} asset={asset.toUpperCase()} idPrefix="new" />

    <label class="field">
      <span>Note sur la position</span>
      <textarea rows="2" maxlength="2000" placeholder="Facultatif : plan, objectif, invalidation" bind:value={positionNote}></textarea>
    </label>

    {#if formError}<p class="error" role="alert">{formError}</p>{/if}
    <div class="actions">
      <button class="btn btn-primary" type="submit" disabled={saving}>Ouvrir la position</button>
      <a class="btn btn-quiet" href="#positions">Annuler</a>
    </div>
  </form>
</section>

<style>
  .new {
    display: grid;
    gap: 0.8rem;
    max-width: 48rem;
  }
  h1 {
    font-size: 1.5rem;
  }
  h1:focus {
    outline: none;
  }
  h2 {
    font-size: 1.05rem;
    margin-top: 0.4rem;
  }
  form {
    padding: 1rem;
    display: grid;
    gap: 0.8rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.9rem 0.75rem;
    align-items: start;
  }
  .field > label {
    font-size: 0.85rem;
    font-weight: 550;
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
  }
  legend {
    font-size: 0.85rem;
    font-weight: 550;
    margin-bottom: 0.3rem;
    padding: 0;
  }
  .seg {
    display: flex;
    gap: 1rem;
    align-items: center;
    height: 2.5rem;
  }
  .seg label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .seg input {
    width: auto;
  }
  .error {
    color: var(--loss);
    margin: 0;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
</style>

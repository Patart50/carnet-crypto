<script lang="ts">
  /**
   * Champs d'un événement : date, quantité, prix (avec « Cours à cette date »),
   * frais (calculés depuis les taux des réglages, carnet D-021), funding à la
   * sortie (D-022), émotion (liste, D-023), note.
   */
  import { dec, type Dec } from 'commun-crypto/money';
  import { app } from '../state/app.svelte';
  import Combobox from './Combobox.svelte';
  import { autoFee, feeText, type EventField, type EventFormValues } from './eventForm';
  import { rateToPercent } from './format';

  let {
    values = $bindable(),
    errors = {},
    quote,
    asset,
    held = null,
    idPrefix,
    editing = false,
  }: {
    values: EventFormValues;
    errors?: Partial<Record<EventField, string>>;
    quote: string;
    asset: string;
    /** Quantité détenue avant l'événement (réduction, clôture). */
    held?: Dec | null;
    idPrefix: string;
    /** Modification d'un événement existant : ses frais ne sont pas recalculés. */
    editing?: boolean;
  } = $props();

  const id = (f: string) => `${idPrefix}-${f}`;
  const isExit = $derived(values.kind === 'reduce' || values.kind === 'close');

  // ---- Frais calculés (D-021) ----
  // svelte-ignore state_referenced_locally
  let feeTouched = $state(editing || values.fee.trim() !== '');
  const rate = $derived(isExit ? app.settings.exitFeeRate : app.settings.entryFeeRate);
  const proposed = $derived(autoFee(values, { entry: app.entryFee, exit: app.exitFee }, held));
  $effect(() => {
    if (!feeTouched) values.fee = proposed && !proposed.isZero() ? feeText(proposed) : '';
  });

  function recompute() {
    feeTouched = false;
  }

  // ---- Cours à cette date (D-024) ----
  let priceStatus = $state<'idle' | 'loading' | 'consent'>('idle');
  let priceInfo = $state<string | null>(null);
  let priceError = $state<string | null>(null);
  const canFetch = $derived(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(values.date) && /^[A-Za-z0-9]{1,20}$/.test(asset) && /^[A-Za-z0-9]{2,10}$/.test(quote));

  async function fetchPrice() {
    priceError = priceInfo = null;
    if (!app.settings.allowPriceFetch) {
      priceStatus = 'consent';
      return;
    }
    priceStatus = 'loading';
    const r = await app.priceAtDate(asset, quote, values.date);
    priceStatus = 'idle';
    if ('error' in r) {
      priceError = r.error;
      return;
    }
    values.price = r.price.toFixed().replace('.', ',');
    priceInfo = `Cours Binance de la minute (${r.route}) : vérifiez votre prix réel.`;
  }

  function accept() {
    app.setAllowPriceFetch(true);
    void fetchPrice();
  }

  const heldText = $derived(held ? held.toString().replace('.', ',') : null);
</script>

<div class="grid">
  <label class="field">
    <span>Date et heure</span>
    <input type="datetime-local" bind:value={values.date} aria-invalid={!!errors.date} aria-describedby={errors.date ? id('date-err') : undefined} />
    {#if errors.date}<small class="error" id={id('date-err')}>{errors.date}</small>{/if}
  </label>

  {#if values.kind !== 'close'}
    <label class="field">
      <span>Quantité{asset ? ` (${asset})` : ''}</span>
      <input inputmode="decimal" autocomplete="off" bind:value={values.quantity} aria-invalid={!!errors.quantity} aria-describedby={errors.quantity ? id('qty-err') : heldText ? id('qty-help') : undefined} />
      {#if errors.quantity}<small class="error" id={id('qty-err')}>{errors.quantity}</small>
      {:else if heldText && values.kind === 'reduce'}<small id={id('qty-help')}>Détenu : {heldText}</small>{/if}
    </label>
  {/if}

  <div class="field">
    <label for={id('price')}>Prix{quote ? ` (${quote})` : ''}</label>
    <input id={id('price')} inputmode="decimal" autocomplete="off" bind:value={values.price} oninput={() => (priceInfo = null)} aria-invalid={!!errors.price} aria-describedby={id('price-help')} />
    <small id={id('price-help')} class:error={!!errors.price || !!priceError}>
      {#if errors.price}{errors.price}
      {:else if priceError}{priceError}
      {:else if priceInfo}{priceInfo}
      {:else}Prix d'exécution.{/if}
    </small>
    {#if canFetch && priceStatus !== 'consent'}
      <button class="btn btn-small link" type="button" onclick={fetchPrice} disabled={priceStatus === 'loading'}>
        {priceStatus === 'loading' ? 'Recherche du cours…' : 'Cours à cette date'}
      </button>
    {/if}
  </div>

  <div class="field">
    <label for={id('fee')}>Frais{quote ? ` (${quote})` : ''}</label>
    <input id={id('fee')} inputmode="decimal" autocomplete="off" placeholder="0" bind:value={values.fee} oninput={() => (feeTouched = true)} aria-invalid={!!errors.fee} aria-describedby={id('fee-help')} />
    <small id={id('fee-help')} class:error={!!errors.fee}>
      {#if errors.fee}{errors.fee}
      {:else if !feeTouched}Auto : {rateToPercent(rate)} % du montant.
      {:else}Saisis à la main.{/if}
    </small>
    {#if feeTouched && proposed}
      <button class="btn btn-small link" type="button" onclick={recompute}>Recalculer ({rateToPercent(rate)} %)</button>
    {/if}
  </div>

  {#if isExit}
    <label class="field">
      <span>Funding et intérêts</span>
      <input inputmode="decimal" autocomplete="off" placeholder="0" bind:value={values.funding} aria-invalid={!!errors.funding} aria-describedby={id('funding-help')} />
      <small id={id('funding-help')} class:error={!!errors.funding}>{errors.funding ?? 'Payé : positif · reçu : négatif (−). Déduit du P&L.'}</small>
    </label>
  {/if}

  <div class="field">
    <label for={id('emotion')}>Émotion</label>
    <Combobox id={id('emotion')} bind:value={values.emotion} options={app.emotionOptions} uppercase={false} maxlength={60} placeholder="Facultatif" />
  </div>

  <label class="field wide">
    <span>Note</span>
    <textarea rows="2" maxlength="2000" placeholder="Facultatif : raison, plan, ce qui s'est passé" bind:value={values.note}></textarea>
  </label>
</div>

{#if priceStatus === 'consent'}
  <div class="consent" role="region" aria-label="Autorisation de contacter Binance">
    <p class="small">
      <strong>Contacter Binance ?</strong> Pour trouver le cours, l'outil envoie le nom de la paire (ex. {asset || 'BTC'}{quote || 'USDT'}) et l'heure, rien d'autre.
      Binance voit votre adresse IP. Le choix est mémorisé et se retire dans les réglages.
    </p>
    <div class="actions">
      <button class="btn btn-primary btn-small" type="button" onclick={accept}>Autoriser et récupérer</button>
      <button class="btn btn-quiet btn-small" type="button" onclick={() => (priceStatus = 'idle')}>Saisir à la main</button>
    </div>
  </div>
{/if}

{#if held && values.kind === 'reduce'}
  <div class="quick" role="group" aria-label="Raccourcis de quantité">
    {#each [25, 50, 75] as pct (pct)}
      <button class="btn btn-small" type="button" onclick={() => (values.quantity = dec(held!).mul(pct).div(100).toDecimalPlaces(12).toFixed().replace('.', ','))}>{pct} %</button>
    {/each}
  </div>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.9rem 0.75rem;
    align-items: start;
  }
  .wide {
    grid-column: 1 / -1;
  }
  .field > label {
    font-size: 0.85rem;
    font-weight: 550;
  }
  .link {
    justify-self: start;
  }
  .consent {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }
  .small {
    font-size: 0.86rem;
    margin: 0;
  }
  .actions,
  .quick {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
</style>

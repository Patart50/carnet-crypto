<script lang="ts">
  /** Champs communs d'un événement (date, quantité, prix, frais, émotion, note). */
  import { dec } from 'commun-crypto/money';
  import { EMOTIONS } from '../core/model';
  import type { EventField, EventFormValues } from './eventForm';

  let {
    values = $bindable(),
    errors = {},
    quote,
    asset,
    held = null,
    idPrefix,
  }: {
    values: EventFormValues;
    errors?: Partial<Record<EventField, string>>;
    quote: string;
    asset: string;
    /** Quantité détenue (réduction) : propose des raccourcis. */
    held?: string | null;
    idPrefix: string;
  } = $props();

  const id = (f: string) => `${idPrefix}-${f}`;
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
      <input inputmode="decimal" autocomplete="off" bind:value={values.quantity} aria-invalid={!!errors.quantity} aria-describedby={errors.quantity ? id('qty-err') : held ? id('qty-help') : undefined} />
      {#if errors.quantity}<small class="error" id={id('qty-err')}>{errors.quantity}</small>
      {:else if held}<small id={id('qty-help')}>Détenu : {held.replace('.', ',')}</small>{/if}
    </label>
  {/if}

  <label class="field">
    <span>Prix d'exécution{quote ? ` (${quote})` : ''}</span>
    <input inputmode="decimal" autocomplete="off" bind:value={values.price} aria-invalid={!!errors.price} aria-describedby={errors.price ? id('price-err') : undefined} />
    {#if errors.price}<small class="error" id={id('price-err')}>{errors.price}</small>{/if}
  </label>

  <label class="field">
    <span>Frais{quote ? ` (${quote})` : ''}</span>
    <input inputmode="decimal" autocomplete="off" placeholder="0" bind:value={values.fee} aria-invalid={!!errors.fee} aria-describedby={id(errors.fee ? 'fee-err' : 'fee-help')} />
    {#if errors.fee}<small class="error" id={id('fee-err')}>{errors.fee}</small>
    {:else}<small id={id('fee-help')}>Montant payé, en devise de cotation.</small>{/if}
  </label>

  <label class="field">
    <span>Émotion <span class="muted">(facultatif)</span></span>
    <input list={id('emotions')} autocomplete="off" maxlength="60" bind:value={values.emotion} />
    <datalist id={id('emotions')}>
      {#each EMOTIONS as e (e)}<option value={e}></option>{/each}
    </datalist>
  </label>

  <label class="field wide">
    <span>Note <span class="muted">(facultatif)</span></span>
    <textarea rows="2" maxlength="2000" bind:value={values.note}></textarea>
  </label>
</div>

{#if held && values.kind === 'reduce'}
  <div class="quick" role="group" aria-label="Raccourcis de quantité">
    {#each [25, 50, 75] as pct (pct)}
      <button class="btn btn-small" type="button" onclick={() => (values.quantity = dec(held).mul(pct).div(100).toDecimalPlaces(12).toFixed().replace('.', ','))}>{pct} %</button>
    {/each}
  </div>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.75rem;
  }
  .wide {
    grid-column: 1 / -1;
  }
  .quick {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
</style>

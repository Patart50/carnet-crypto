<script lang="ts">
  /** Ajout, réduction, clôture, ou modification d'un événement existant. */
  import { app, nowLocal } from '../state/app.svelte';
  import { KIND_LABELS, type EventKind, type Position, type TradeEvent } from '../core/model';
  import EventFields from './EventFields.svelte';
  import { emptyEventForm, eventToForm, parseEventForm, type EventField } from './eventForm';

  let {
    position,
    editing = null,
    initialKind = 'add',
    onclose,
  }: { position: Position; editing?: TradeEvent | null; initialKind?: EventKind; onclose: () => void } = $props();

  const st = $derived(app.states.get(position.id)!);
  // svelte-ignore state_referenced_locally
  let values = $state(editing ? eventToForm(editing) : emptyEventForm(initialKind, nowLocal()));
  let errors = $state<Partial<Record<EventField, string>>>({});
  let formError = $state<string | null>(null);
  let saving = $state(false);

  const kinds: EventKind[] = ['add', 'reduce', 'close'];
  const title = $derived(editing ? `Modifier : ${KIND_LABELS[editing.kind].toLowerCase()}` : KIND_LABELS[values.kind]);
  // Quantité détenue : actuelle pour une nouvelle sortie ; pour une clôture modifiée, celle qu'elle a fermée.
  const held = $derived(
    editing ? (st.steps.find((s) => s.event.id === editing.id)?.realization?.quantity ?? null) : st.status === 'open' && (values.kind === 'reduce' || values.kind === 'close') ? st.quantity : null,
  );

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    formError = null;
    const parsed = parseEventForm(values);
    errors = parsed.ok ? {} : parsed.errors;
    if (!parsed.ok) return;
    saving = true;
    const r = await app.saveEvent(position.id, { ...parsed.event, ...(editing ? { id: editing.id } : {}) });
    saving = false;
    if (!r.ok) {
      formError = r.message;
      return;
    }
    app.notify(editing ? 'Événement modifié.' : `${KIND_LABELS[values.kind]} enregistrée.`);
    onclose();
  }

  async function remove() {
    if (!editing) return;
    const last = position.events.length === 1;
    const ok = confirm(last ? 'Supprimer ce seul événement supprime toute la position. Continuer ?' : 'Supprimer cet événement ?');
    if (!ok) return;
    const r = await app.deleteEvent(position.id, editing.id);
    if (!r.ok) {
      formError = r.message;
      return;
    }
    app.notify(last ? 'Position supprimée.' : 'Événement supprimé.');
    if (last) location.hash = '#positions';
    else onclose();
  }
</script>

<form class="panel" onsubmit={submit} novalidate aria-labelledby="event-form-title">
  <h3 id="event-form-title">{title}</h3>
  {#if !editing}
    <div class="tabs" role="radiogroup" aria-label="Type d'événement">
      {#each kinds as k (k)}
        <label class:active={values.kind === k}><input type="radio" name="kind" value={k} bind:group={values.kind} /> {KIND_LABELS[k]}</label>
      {/each}
    </div>
  {/if}
  {#if values.kind === 'close'}
    <p class="muted small">Clôture de toute la quantité restante ({st.quantity.toString().replace('.', ',')} {position.asset}).</p>
  {/if}
  <EventFields bind:values {errors} quote={position.quote} asset={position.asset} {held} idPrefix="evt" editing={!!editing} />
  {#if formError}<p class="error" role="alert">{formError}</p>{/if}
  <div class="actions">
    <button class="btn btn-primary" type="submit" disabled={saving}>{editing ? 'Enregistrer' : `Enregistrer ${values.kind === 'add' ? "l'ajout" : values.kind === 'reduce' ? 'la réduction' : 'la clôture'}`}</button>
    <button class="btn btn-quiet" type="button" onclick={onclose}>Annuler</button>
    {#if editing}<button class="btn btn-quiet btn-danger delete" type="button" onclick={remove}>Supprimer l'événement</button>{/if}
  </div>
</form>

<style>
  form {
    padding: 1rem;
    display: grid;
    gap: 0.8rem;
  }
  h3 {
    font-size: 1.05rem;
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
    color: var(--ink);
    font-weight: 600;
  }
  .tabs input {
    width: auto;
  }
  .small {
    font-size: 0.88rem;
    margin: 0;
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
  .delete {
    margin-left: auto;
  }
</style>

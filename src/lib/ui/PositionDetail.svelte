<script lang="ts">
  /** Fiche d'une position : chiffres clés, cours, fil des événements, saisie, simulateur. */
  import { amount, amountSigned, qty } from 'commun-crypto/format';
  import { dec } from 'commun-crypto/money';
  import { parseNumber } from 'commun-crypto/parse';
  import { app, nowLocal } from '../state/app.svelte';
  import { KIND_LABELS, SIDE_LABELS, type EventKind, type Side, type TradeEvent } from '../core/model';
  import { breakEven, displayedPmp, durationMs, latentNet, totalNet } from '../core/position';
  import { priceKey } from '../core/stats';
  import EventForm from './EventForm.svelte';
  import Simulator from './Simulator.svelte';
  import Combobox from './Combobox.svelte';
  import { dateTimeFr, durationLabel, priceIn } from './format';

  let { id }: { id: string } = $props();

  const position = $derived(app.position(id));
  const st = $derived(position ? app.states.get(position.id) : undefined);
  const key = $derived(position ? priceKey(position.asset, position.quote) : '');
  const current = $derived(app.priceMap.get(key));
  const saved = $derived(app.prices[key]);
  const latent = $derived(st && current ? latentNet(st, current, app.exitFee) : null);
  const be = $derived(st ? breakEven(st, app.exitFee) : null);

  let formKind = $state<EventKind | null>(null);
  let editing = $state<TradeEvent | null>(null);
  let editMeta = $state(false);
  let priceText = $state('');
  let priceError = $state<string | null>(null);

  // Méta-données en cours de modification.
  let mAsset = $state('');
  let mQuote = $state('');
  let mSide = $state<Side>('long');
  let mNote = $state('');
  let metaError = $state<string | null>(null);

  $effect(() => {
    priceText = current ? current.toFixed().replace('.', ',') : '';
  });

  function savePrice() {
    if (!position) return;
    priceError = null;
    try {
      const v = parseNumber(priceText);
      if (v !== null && !v.gt(0)) throw new RangeError();
      app.setPrice(position.asset, position.quote, v);
    } catch {
      priceError = 'Cours : nombre strictement positif.';
    }
  }

  function openForm(kind: EventKind) {
    editing = null;
    formKind = kind;
  }

  function startEdit(e: TradeEvent) {
    formKind = null;
    editing = e;
  }

  function closeForms() {
    formKind = null;
    editing = null;
  }

  function startMeta() {
    if (!position) return;
    mAsset = position.asset;
    mQuote = position.quote;
    mSide = position.side;
    mNote = position.note ?? '';
    metaError = null;
    editMeta = true;
  }

  async function saveMeta(event: SubmitEvent) {
    event.preventDefault();
    if (!position) return;
    if (!/^[A-Za-z0-9]{1,20}$/.test(mAsset.trim()) || !/^[A-Za-z0-9]{2,10}$/.test(mQuote.trim())) {
      metaError = 'Crypto et devise : lettres et chiffres seulement (ex. BTC, USDT).';
      return;
    }
    const r = await app.updateMeta(position.id, { asset: mAsset, quote: mQuote, side: mSide, note: mNote });
    if (!r.ok) {
      metaError = r.message;
      return;
    }
    editMeta = false;
    app.notify('Position modifiée.');
  }

  async function removePosition() {
    if (!position || !confirm(`Supprimer la position ${position.asset}/${position.quote} et tous ses événements ?`)) return;
    await app.deletePosition(position.id);
    app.notify('Position supprimée.');
    location.hash = '#positions';
  }
</script>

{#if !app.loaded}
  <p class="muted">Chargement…</p>
{:else if !position || !st}
  <section>
    <p><a href="#positions">← Positions</a></p>
    <h1 id="detail-title" tabindex="-1">Position introuvable</h1>
    <p class="muted">Elle a peut-être été supprimée.</p>
  </section>
{:else}
  {@const q = position.quote}
  <section class="detail" aria-labelledby="detail-title">
    <p><a href="#positions">← Positions</a></p>
    <div class="head">
      <h1 id="detail-title" tabindex="-1">{position.asset}<span class="muted">/{q}</span></h1>
      <span class="badge" class:short={position.side === 'short'}>{SIDE_LABELS[position.side]}</span>
      <span class="status">{st.status === 'open' ? 'Ouverte' : 'Fermée'} · {durationLabel(durationMs(st, nowLocal()))}</span>
      <div class="head-actions">
        <button class="btn btn-small" type="button" onclick={startMeta} aria-expanded={editMeta}>Modifier</button>
        <button class="btn btn-small btn-danger" type="button" onclick={removePosition}>Supprimer</button>
      </div>
    </div>
    {#if position.note}<p class="note">{position.note}</p>{/if}
    {#if st.errors.length}<p class="notice" role="alert"><strong>À corriger :</strong> {st.errors[0].message}</p>{/if}

    {#if editMeta}
      <form class="panel meta" onsubmit={saveMeta} novalidate aria-label="Modifier la position">
        <div class="grid">
          <div class="field"><label for="meta-asset">Crypto</label><Combobox id="meta-asset" bind:value={mAsset} options={app.assetOptions} /></div>
          <div class="field"><label for="meta-quote">Devise</label><Combobox id="meta-quote" bind:value={mQuote} options={app.quoteOptions} maxlength={10} /></div>
          <label class="field"><span>Sens</span>
            <select bind:value={mSide}><option value="long">Long</option><option value="short">Short</option></select>
          </label>
        </div>
        <label class="field"><span>Note</span><textarea rows="2" maxlength="2000" bind:value={mNote}></textarea></label>
        {#if metaError}<p class="error" role="alert">{metaError}</p>{/if}
        <div class="actions">
          <button class="btn btn-primary btn-small" type="submit">Enregistrer</button>
          <button class="btn btn-quiet btn-small" type="button" onclick={() => (editMeta = false)}>Annuler</button>
        </div>
      </form>
    {/if}

    <dl class="figures panel">
      {#if st.status === 'open'}
        <div><dt>Quantité</dt><dd>{qty(st.quantity)} {position.asset}</dd></div>
        <div>
          <dt>Prix moyen {app.settings.pmpMode === 'gross' ? 'brut' : 'frais inclus'}</dt>
          <dd>{priceIn(displayedPmp(st, app.settings.pmpMode), q)}</dd>
          <dd class="sub">{app.settings.pmpMode === 'gross' ? 'frais inclus' : 'brut'} : {priceIn(displayedPmp(st, app.settings.pmpMode === 'gross' ? 'withFees' : 'gross'), q)}</dd>
        </div>
        <div><dt>Break-even</dt><dd>{be ? priceIn(be, q) : '—'}</dd><dd class="sub">réalisé et frais compris</dd></div>
        <div>
          <dt>Latent net</dt>
          <dd class:gain={latent?.gt(0)} class:loss={latent?.lt(0)}>{latent ? amountSigned(latent, q) : 'cours inconnu'}</dd>
        </div>
      {/if}
      <div><dt>Réalisé net</dt><dd class:gain={st.realizedNet.gt(0)} class:loss={st.realizedNet.lt(0)}>{amountSigned(st.realizedNet, q)}</dd></div>
      {#if st.status === 'open' && current}
        {@const total = totalNet(st, current, app.exitFee)}
        <div><dt>Total net</dt><dd class:gain={total.gt(0)} class:loss={total.lt(0)}>{amountSigned(total, q)}</dd></div>
      {/if}
      <div><dt>Frais payés</dt><dd>{amount(st.feesTotal, q)}</dd></div>
      {#if !st.fundingTotal.isZero()}
        <div>
          <dt>Funding et intérêts</dt>
          <dd class:loss={st.fundingTotal.gt(0)} class:gain={st.fundingTotal.lt(0)}>{amountSigned(st.fundingTotal.neg(), q)}</dd>
          <dd class="sub">{st.fundingTotal.gt(0) ? 'payés' : 'reçus'}, inclus dans le réalisé</dd>
        </div>
      {/if}
      <div><dt>Capital engagé max</dt><dd>{amount(st.maxCost, q)}</dd></div>
    </dl>

    {#if st.status === 'open'}
      <div class="price">
        <label class="field">
          <span>Cours actuel ({q})</span>
          <input inputmode="decimal" autocomplete="off" bind:value={priceText} onchange={savePrice} aria-invalid={!!priceError} aria-describedby="price-help" />
        </label>
        <small id="price-help" class:error={!!priceError}>
          {#if priceError}{priceError}{:else if saved?.route}Binance ({saved.route}), modifiable.{:else}Saisi à la main, ou « Mettre à jour les cours » dans la liste.{/if}
        </small>
      </div>

      {#if !formKind && !editing}
        <div class="actions">
          <button class="btn btn-primary" type="button" onclick={() => openForm('add')}>Ajouter</button>
          <button class="btn" type="button" onclick={() => openForm('reduce')}>Réduire</button>
          <button class="btn" type="button" onclick={() => openForm('close')}>Clôturer</button>
        </div>
      {/if}
    {/if}

    {#if formKind}
      {#key formKind}<EventForm {position} initialKind={formKind} onclose={closeForms} />{/key}
    {/if}
    {#if editing}
      {#key editing.id}<EventForm {position} {editing} onclose={closeForms} />{/key}
    {/if}

    <section aria-labelledby="timeline-title">
      <h2 id="timeline-title">Fil des événements</h2>
      <ol class="timeline">
        {#each st.steps as step (step.event.id)}
          {@const e = step.event}
          {@const r = step.realization}
          <li class={e.kind}>
            <div class="line">
              <strong>{KIND_LABELS[e.kind]}</strong>
              <span class="muted">{dateTimeFr(e.date)}</span>
              {#if e.emotion}<span class="tag">{e.emotion}</span>{/if}
              <button class="btn btn-quiet btn-small edit" type="button" onclick={() => startEdit(e)} aria-label={`Modifier : ${KIND_LABELS[e.kind]} du ${dateTimeFr(e.date)}`}>Modifier</button>
            </div>
            <p class="facts">
              {qty(r ? r.quantity : dec(e.quantity ?? '0'))} {position.asset} à {priceIn(dec(e.price), q)}
              {#if e.fee !== '0'}· frais {amount(dec(e.fee), q)}{/if}
              {#if e.funding}· funding {dec(e.funding).isNeg() ? 'reçu' : 'payé'} {amount(dec(e.funding).abs(), q)}{/if}
              · prix moyen {priceIn(step.pmpGross, q)}
              {#if r}· <span class:gain={r.net.gt(0)} class:loss={r.net.lt(0)}>P&amp;L net {amountSigned(r.net, q)}</span>{/if}
            </p>
            {#if e.note}<p class="note">{e.note}</p>{/if}
          </li>
        {/each}
      </ol>
      {#if position.events.length > st.steps.length}
        {@const blocked = position.events.filter((e) => !st.steps.some((s) => s.event.id === e.id))}
        <p class="muted small">Événements non pris en compte (après l'erreur) :</p>
        <ul class="blocked">
          {#each blocked as e (e.id)}
            <li>{KIND_LABELS[e.kind]} du {dateTimeFr(e.date)} <button class="btn btn-quiet btn-small" type="button" onclick={() => startEdit(e)}>Corriger</button></li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if st.status === 'open'}<Simulator {position} />{/if}
  </section>
{/if}

<style>
  .detail {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  h1 {
    font-size: 1.6rem;
  }
  h1:focus {
    outline: none;
  }
  h2 {
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
  }
  .head-actions {
    margin-left: auto;
    display: flex;
    gap: 0.4rem;
  }
  .badge {
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.05rem 0.55rem;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
  }
  .badge.short {
    background: var(--warn-bg);
    color: var(--warn);
  }
  .status {
    color: var(--muted);
    font-size: 0.88rem;
  }
  .note {
    white-space: pre-line;
    margin: 0;
    font-size: 0.92rem;
  }
  .figures {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
    gap: 0.8rem 1.2rem;
    margin: 0;
    padding: 1rem;
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
  .price {
    display: grid;
    gap: 0.3rem;
    max-width: 22rem;
  }
  .price small {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .meta {
    padding: 1rem;
    display: grid;
    gap: 0.7rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.7rem;
    align-items: start;
  }
  .meta .field > label {
    font-size: 0.85rem;
    font-weight: 550;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .error,
  small.error {
    color: var(--loss);
    margin: 0;
  }
  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0;
    border-left: 2px solid var(--rule);
  }
  .timeline li {
    position: relative;
    padding: 0.4rem 0 0.9rem 1rem;
  }
  .timeline li::before {
    content: '';
    position: absolute;
    left: -6px;
    top: 0.75rem;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--surface);
    border: 2px solid var(--accent);
  }
  .timeline li.reduce::before,
  .timeline li.close::before {
    border-color: var(--warn);
  }
  .line {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .edit {
    margin-left: auto;
  }
  .facts {
    margin: 0.15rem 0 0;
    font-size: 0.92rem;
    font-variant-numeric: tabular-nums;
  }
  .tag {
    font-size: 0.75rem;
    color: var(--muted);
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 0 0.45rem;
  }
  .small {
    font-size: 0.85rem;
  }
  .blocked {
    margin: 0;
    font-size: 0.9rem;
  }
</style>

<script lang="ts">
  /** Réglages (PMP affiché, frais de sortie, Binance) et sauvegarde (JSON, CSV, effacement). */
  import { parseNumber } from 'commun-crypto/parse';
  import { app } from '../state/app.svelte';
  import { eventsCsv, positionsCsv } from '../export/csv';
  import { BackupError, type ReadResult } from '../storage/backup';
  import { rateToPercent } from './format';

  let dialog: HTMLDialogElement;
  let feeText = $state('');
  let feeError = $state<string | null>(null);
  let preview = $state<ReadResult | null>(null);
  let importError = $state<string | null>(null);
  let fileInput: HTMLInputElement;

  export function open() {
    feeText = rateToPercent(app.settings.exitFeeRate);
    feeError = null;
    preview = null;
    importError = null;
    dialog.showModal();
  }

  function saveFee() {
    try {
      const v = parseNumber(feeText) ?? null;
      if (v === null) {
        app.setExitFeeRate('0');
        feeError = null;
        return;
      }
      if (v.isNeg() || v.gte(100)) throw new RangeError();
      app.setExitFeeRate(v.div(100).toFixed());
      feeError = null;
    } catch {
      feeError = 'Entre 0 et 100 %.';
    }
  }

  function download(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const stamp = () => new Date().toISOString().slice(0, 10);

  async function readFile(event: Event) {
    importError = null;
    preview = null;
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      preview = app.previewBackup(await file.text());
    } catch (e) {
      importError = e instanceof BackupError ? e.message : 'Fichier illisible.';
    }
    fileInput.value = '';
  }

  async function applyImport(mode: 'replace' | 'merge') {
    if (!preview) return;
    if (mode === 'replace' && app.positions.length > 0 && !confirm(`Remplacer les ${app.positions.length} positions actuelles par celles du fichier ?`)) return;
    await app.applyBackup(preview, mode);
    app.notify(`${preview.positions.length} position${preview.positions.length > 1 ? 's' : ''} importée${preview.positions.length > 1 ? 's' : ''}.`);
    preview = null;
    dialog.close();
  }

  async function clearAll() {
    if (!confirm('Effacer toutes les positions de cet appareil ? Exportez une sauvegarde avant si besoin.')) return;
    await app.clearAll();
    app.notify('Carnet effacé.');
    dialog.close();
    location.hash = '#positions';
  }
</script>

<dialog bind:this={dialog} aria-labelledby="settings-title">
  <header>
    <h2 id="settings-title">Réglages et sauvegarde</h2>
    <button class="btn btn-quiet" type="button" onclick={() => dialog.close()} aria-label="Fermer">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
    </button>
  </header>

  <div class="body">
    <fieldset>
      <legend>Prix moyen affiché</legend>
      <label><input type="radio" name="pmp" value="gross" checked={app.settings.pmpMode === 'gross'} onchange={() => app.setPmpMode('gross')} /> Brut, au prix d'exécution (comme les plateformes)</label>
      <label><input type="radio" name="pmp" value="withFees" checked={app.settings.pmpMode === 'withFees'} onchange={() => app.setPmpMode('withFees')} /> Frais d'entrée inclus</label>
      <small>P&amp;L net et break-even incluent toujours les frais, quel que soit ce choix.</small>
    </fieldset>

    <label class="field">
      <span>Frais de sortie estimés (%)</span>
      <input inputmode="decimal" autocomplete="off" bind:value={feeText} onchange={saveFee} aria-invalid={!!feeError} aria-describedby="exit-help" />
      <small id="exit-help" class:error={!!feeError}>{feeError ?? 'Déduits du latent et pris en compte dans le break-even. Vide : 0.'}</small>
    </label>

    <div class="block">
      <h3>Cours Binance</h3>
      {#if app.settings.allowPriceFetch}
        <p class="small">Autorisé : l'outil peut télécharger la liste publique des cours quand vous le demandez.</p>
        <button class="btn btn-small" type="button" onclick={() => app.setAllowPriceFetch(false)}>Retirer l'autorisation</button>
      {:else}
        <p class="small muted">Non autorisé. L'autorisation est demandée au premier clic sur « Mettre à jour les cours ».</p>
      {/if}
    </div>

    <div class="block">
      <h3>Sauvegarde</h3>
      <p class="small muted">Vos données ne sont que sur cet appareil{app.persistent ? '' : ' (et en mémoire seulement : elles seront perdues à la fermeture)'}. Exportez une sauvegarde régulièrement.</p>
      <div class="actions">
        <button class="btn btn-small" type="button" onclick={() => download(`carnet-crypto-${stamp()}.json`, app.backupJson(), 'application/json')} disabled={app.positions.length === 0}>Exporter la sauvegarde (JSON)</button>
        <button class="btn btn-small" type="button" onclick={() => fileInput.click()}>Importer une sauvegarde…</button>
        <input bind:this={fileInput} type="file" accept=".json,application/json" class="sr-only" tabindex="-1" aria-hidden="true" onchange={readFile} />
      </div>
      {#if importError}<p class="error small" role="alert">{importError}</p>{/if}
      {#if preview}
        <div class="preview" role="region" aria-label="Aperçu de l'import">
          <p class="small">{preview.positions.length} position{preview.positions.length > 1 ? 's' : ''} dans le fichier.</p>
          {#if preview.warnings.length}
            <p class="small warn">À corriger après import :</p>
            <ul class="small">{#each preview.warnings as w (w)}<li>{w}</li>{/each}</ul>
          {/if}
          <div class="actions">
            <button class="btn btn-primary btn-small" type="button" onclick={() => applyImport('merge')}>Fusionner</button>
            <button class="btn btn-small" type="button" onclick={() => applyImport('replace')}>Remplacer tout</button>
            <button class="btn btn-quiet btn-small" type="button" onclick={() => (preview = null)}>Annuler</button>
          </div>
          <small>Fusionner : les positions du fichier remplacent celles qui portent le même identifiant, les autres sont gardées.</small>
        </div>
      {/if}
    </div>

    <div class="block">
      <h3>Exports pour tableur</h3>
      <div class="actions">
        <button class="btn btn-small" type="button" onclick={() => download(`carnet-evenements-${stamp()}.csv`, eventsCsv(app.positions, app.states), 'text/csv')} disabled={app.positions.length === 0}>Événements (CSV)</button>
        <button class="btn btn-small" type="button" onclick={() => download(`carnet-positions-${stamp()}.csv`, positionsCsv(app.positions, app.states), 'text/csv')} disabled={app.positions.length === 0}>Positions (CSV)</button>
      </div>
    </div>

    <div class="block">
      <button class="btn btn-small btn-danger" type="button" onclick={clearAll} disabled={app.positions.length === 0}>Effacer tout le carnet</button>
    </div>
  </div>
</dialog>

<style>
  dialog {
    border: 1px solid var(--rule);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--ink);
    padding: 0;
    width: min(36rem, calc(100vw - 2rem));
    max-height: calc(100vh - 2rem);
    box-shadow: var(--shadow-pop);
  }
  dialog::backdrop {
    background: rgb(15 21 33 / 0.5);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8rem 1rem;
    border-bottom: 1px solid var(--rule);
    position: sticky;
    top: 0;
    background: var(--surface);
  }
  h2 {
    font-size: 1.15rem;
  }
  h3 {
    font-size: 0.95rem;
  }
  .body {
    padding: 1rem;
    display: grid;
    gap: 1.1rem;
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }
  legend {
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 0.3rem;
    padding: 0;
  }
  fieldset label {
    display: flex;
    gap: 0.45rem;
    align-items: baseline;
    font-size: 0.92rem;
  }
  fieldset input {
    width: auto;
  }
  small {
    color: var(--muted);
    font-size: 0.8rem;
  }
  .block {
    display: grid;
    gap: 0.45rem;
  }
  .actions {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
  }
  .small {
    font-size: 0.86rem;
    margin: 0;
  }
  .error {
    color: var(--loss);
  }
  .warn {
    color: var(--warn);
  }
  .preview {
    display: grid;
    gap: 0.45rem;
    padding: 0.7rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }
  ul {
    margin: 0;
  }
</style>

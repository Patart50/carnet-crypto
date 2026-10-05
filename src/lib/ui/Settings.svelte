<script lang="ts">
  /** Réglages (PMP affiché, frais de sortie, Binance) et sauvegarde (JSON, CSV, effacement). */
  import { parseNumber } from 'commun-crypto/parse';
  import { app } from '../state/app.svelte';
  import { eventsCsv, positionsCsv } from '../export/csv';
  import { BackupError, type ReadResult } from '../storage/backup';
  import { rateToPercent } from './format';

  let dialog: HTMLDialogElement;
  let entryText = $state('');
  let exitText = $state('');
  let entryError = $state<string | null>(null);
  let exitError = $state<string | null>(null);
  let dragging = $state(false);
  let preview = $state<ReadResult | null>(null);
  let importError = $state<string | null>(null);
  let fileInput: HTMLInputElement;

  export function open() {
    entryText = rateToPercent(app.settings.entryFeeRate);
    exitText = rateToPercent(app.settings.exitFeeRate);
    entryError = exitError = null;
    preview = null;
    importError = null;
    dialog.showModal();
  }

  /** Pourcentage saisi → fraction ; null si invalide. Vide = 0. */
  function readRate(text: string): string | null {
    try {
      const v = parseNumber(text);
      if (v === null) return '0';
      if (v.isNeg() || v.gte(100)) return null;
      return v.div(100).toFixed();
    } catch {
      return null;
    }
  }

  function saveEntry() {
    const r = readRate(entryText);
    entryError = r === null ? 'Entre 0 et 100 %.' : null;
    if (r !== null) app.setEntryFeeRate(r);
  }

  function saveExit() {
    const r = readRate(exitText);
    exitError = r === null ? 'Entre 0 et 100 %.' : null;
    if (r !== null) app.setExitFeeRate(r);
  }

  // ---- Sauvegarde (D-026) ----
  // Chrome et Edge : sélecteur de fichiers qui rouvre le dernier dossier utilisé pour
  // les sauvegardes (même identifiant à l'export et à l'import). Ailleurs : téléchargement
  // et sélecteur classique filtré sur .json.
  type Picker = { id?: string; startIn?: string; suggestedName?: string; types?: { description: string; accept: Record<string, string[]> }[] };
  type FsWindow = Window & {
    showSaveFilePicker?: (o: Picker) => Promise<{ createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }> }>;
    showOpenFilePicker?: (o: Picker & { multiple?: boolean }) => Promise<{ getFile(): Promise<File> }[]>;
  };
  const PICKER_ID = 'carnet-crypto-sauvegardes';
  const JSON_TYPES = [{ description: 'Sauvegarde carnet-crypto', accept: { 'application/json': ['.json'] } }];
  const fs = window as FsWindow;
  const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

  async function exportBackup() {
    const name = `carnet-crypto-${stamp()}.json`;
    const content = app.backupJson();
    if (fs.showSaveFilePicker) {
      try {
        const handle = await fs.showSaveFilePicker({ id: PICKER_ID, startIn: 'documents', suggestedName: name, types: JSON_TYPES });
        const w = await handle.createWritable();
        await w.write(content);
        await w.close();
        app.notify('Sauvegarde enregistrée.');
        return;
      } catch (e) {
        if (isAbort(e)) return;
        // refus du navigateur : repli sur le téléchargement
      }
    }
    download(name, content, 'application/json');
  }

  async function chooseBackup() {
    if (fs.showOpenFilePicker) {
      try {
        const [handle] = await fs.showOpenFilePicker({ id: PICKER_ID, startIn: 'documents', types: JSON_TYPES, multiple: false });
        await readText(await handle.getFile());
        return;
      } catch (e) {
        if (isAbort(e)) return;
      }
    }
    fileInput.click();
  }

  async function readText(file: File) {
    importError = null;
    preview = null;
    if (file.size > 20 * 1024 * 1024) {
      importError = 'Fichier trop gros pour une sauvegarde du carnet.';
      return;
    }
    try {
      preview = app.previewBackup(await file.text());
      previewName = file.name;
    } catch (e) {
      importError = e instanceof BackupError ? e.message : 'Fichier illisible.';
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) void readText(file);
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

  let previewName = $state('');

  async function readFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) await readText(file);
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

    <div class="block">
      <h3>Frais par défaut</h3>
      <div class="two">
        <label class="field">
          <span>Entrée (%)</span>
          <input inputmode="decimal" autocomplete="off" bind:value={entryText} onchange={saveEntry} aria-invalid={!!entryError} aria-describedby="entry-help" />
          <small id="entry-help" class:error={!!entryError}>{entryError ?? 'Ouverture et ajout.'}</small>
        </label>
        <label class="field">
          <span>Sortie (%)</span>
          <input inputmode="decimal" autocomplete="off" bind:value={exitText} onchange={saveExit} aria-invalid={!!exitError} aria-describedby="exit-help" />
          <small id="exit-help" class:error={!!exitError}>{exitError ?? 'Réduction et clôture.'}</small>
        </label>
      </div>
      <small>Pré-remplissent le champ Frais (modifiable). La sortie sert aussi au latent et au break-even. Binance Spot : 0,1 % ; Futures : environ 0,02 % et 0,05 %.</small>
    </div>

    {#if app.memory.assets.length > 0}
      <div class="block">
        <h3>Cryptos mémorisées</h3>
        <ul class="chips">
          {#each app.memory.assets as a (a)}
            <li>{a} <button class="btn btn-quiet btn-small" type="button" onclick={() => app.forgetAsset(a)} aria-label={`Retirer ${a} de la liste`}>×</button></li>
          {/each}
        </ul>
        <small>Proposées en premier dans la liste Crypto. Les principales restent toujours proposées.</small>
      </div>
    {/if}

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
        <button class="btn btn-small" type="button" onclick={exportBackup} disabled={app.positions.length === 0}>Exporter la sauvegarde (JSON)</button>
        <button class="btn btn-small" type="button" onclick={chooseBackup}>Importer une sauvegarde…</button>
        <input bind:this={fileInput} type="file" accept=".json,application/json" class="sr-only" tabindex="-1" aria-hidden="true" onchange={readFile} />
      </div>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="drop" class:dragging ondragover={(e) => { e.preventDefault(); dragging = true; }} ondragleave={() => (dragging = false)} ondrop={onDrop}>
        ou glissez ici un fichier <code>carnet-crypto-….json</code>
      </div>
      <small>{fs.showOpenFilePicker ? "L'import rouvre le dossier de la dernière sauvegarde." : 'Le navigateur ne permet pas de filtrer les fichiers par nom : cherchez « carnet-crypto ».'}</small>
      {#if importError}<p class="error small" role="alert">{importError}</p>{/if}
      {#if preview}
        <div class="preview" role="region" aria-label="Aperçu de l'import">
          <p class="small"><strong>{previewName}</strong> : {preview.positions.length} position{preview.positions.length > 1 ? 's' : ''}.</p>
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
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    align-items: start;
  }
  .chips {
    list-style: none;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .chips li {
    display: inline-flex;
    align-items: center;
    gap: 0.1rem;
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding-left: 0.6rem;
    font-size: 0.86rem;
  }
  .chips .btn {
    padding: 0.1rem 0.45rem;
  }
  .drop {
    border: 1px dashed var(--rule-strong);
    border-radius: var(--radius);
    padding: 0.7rem;
    text-align: center;
    font-size: 0.86rem;
    color: var(--muted);
  }
  .drop.dragging {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--ink);
  }
</style>

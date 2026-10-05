<script lang="ts">
  /**
   * Champ avec liste déroulante (motif ARIA « combobox » à liste, carnet D-023).
   * La liste s'ouvre complète (au clic, au focus, flèche bas ou bouton) ; elle ne
   * se filtre que lorsqu'on tape. La saisie libre reste possible.
   */
  import { filterOptions } from '../core/lists';

  let {
    value = $bindable(''),
    options,
    id,
    invalid = false,
    describedby,
    placeholder = '',
    maxlength = 20,
    uppercase = true,
    onchange,
  }: {
    value?: string;
    options: readonly string[];
    id: string;
    invalid?: boolean;
    describedby?: string;
    placeholder?: string;
    maxlength?: number;
    uppercase?: boolean;
    onchange?: (value: string) => void;
  } = $props();

  let open = $state(false);
  let typed = $state(false);
  let active = $state(-1);
  let input: HTMLInputElement;
  let list = $state<HTMLUListElement>();

  const shown = $derived(typed ? filterOptions(options, value) : [...options]);
  const listId = $derived(`${id}-liste`);

  function show() {
    typed = false;
    open = true;
    active = Math.max(0, shown.indexOf(value.trim().toUpperCase()));
  }

  function choose(option: string) {
    value = option;
    open = false;
    typed = false;
    onchange?.(option);
    input.focus();
  }

  function onInput() {
    if (uppercase) value = value.toUpperCase();
    typed = true;
    open = true;
    active = shown.length ? 0 : -1;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) show();
      else active = Math.min(shown.length - 1, active + 1);
      scrollActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (open) active = Math.max(0, active - 1);
      scrollActive();
    } else if (e.key === 'Enter' && open && active >= 0 && shown[active]) {
      e.preventDefault();
      choose(shown[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      open = false;
    } else if (e.key === 'Tab') {
      open = false;
    }
  }

  function scrollActive() {
    queueMicrotask(() => list?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }));
  }

  function onBlur(e: FocusEvent) {
    // Un clic dans la liste ne ferme pas avant la sélection.
    const next = e.relatedTarget as Node | null;
    if (next && list?.contains(next)) return;
    open = false;
    if (typed) onchange?.(value);
  }
</script>

<div class="combo">
  <input
    bind:this={input}
    {id}
    bind:value
    role="combobox"
    aria-expanded={open}
    aria-controls={listId}
    aria-autocomplete="list"
    aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
    aria-invalid={invalid}
    aria-describedby={describedby}
    autocomplete="off"
    autocapitalize={uppercase ? 'characters' : 'sentences'}
    spellcheck="false"
    {placeholder}
    {maxlength}
    oninput={onInput}
    onkeydown={onKeydown}
    onclick={() => (open ? null : show())}
    onblur={onBlur}
  />
  <button class="toggle" type="button" tabindex="-1" aria-label="Afficher la liste" onmousedown={(e) => e.preventDefault()} onclick={() => (open ? (open = false) : (show(), input.focus()))}>
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </button>
  {#if open && shown.length > 0}
    <ul bind:this={list} id={listId} role="listbox" tabindex="-1">
      {#each shown as option, i (option)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          id={`${id}-opt-${i}`}
          role="option"
          aria-selected={i === active}
          class:current={option === value.trim().toUpperCase()}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => choose(option)}
          onmousemove={() => (active = i)}
        >
          {option}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .combo {
    position: relative;
  }
  .combo input {
    padding-right: 2rem;
  }
  .toggle {
    position: absolute;
    right: 1px;
    top: 1px;
    bottom: 1px;
    width: 1.9rem;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 0 var(--radius) var(--radius) 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  ul {
    position: absolute;
    z-index: 30;
    left: 0;
    right: 0;
    top: calc(100% + 2px);
    max-height: 15rem;
    overflow-y: auto;
    margin: 0;
    padding: 0.25rem 0;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius);
    box-shadow: var(--shadow-pop);
  }
  li {
    padding: 0.4rem 0.65rem;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }
  li[aria-selected='true'] {
    background: var(--accent-soft);
  }
  li.current {
    font-weight: 650;
  }
</style>

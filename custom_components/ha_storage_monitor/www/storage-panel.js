/* Storage Monitor 5.3.0 — native panel adapter. Public code, no household data. */
(() => {
  'use strict';
  class StorageMonitorPanel extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({mode: 'open'});
      this.shadowRoot.innerHTML = `<style>:host{display:block;box-sizing:border-box;padding:16px;color:var(--primary-text-color);background:var(--primary-background-color);min-height:100%}.surface{max-width:1400px;margin:auto;min-width:0}p{padding:16px;overflow-wrap:anywhere}</style><div class="surface"><p role="status" aria-live="polite"></p></div>`;
      this._epoch = 0;
      this._card = null;
      this._hass = null;
      this._panel = null;
    }
    set hass(value) { this._hass = value; this._sync(); }
    set panel(value) { this._panel = value; this._sync(); }
    connectedCallback() { this._sync(); }
    disconnectedCallback() { this._epoch++; this._removeCard(); }
    _removeCard() {
      if (this._card) { this._card.hass = null; this._card.remove(); }
      this._card = null;
      this._cardIdentity = null;
    }
    _message(en, pl) {
      const lang = this._hass?.locale?.language || this._hass?.language || 'en';
      let status = this.shadowRoot.querySelector('p');
      if (!status) {
        status = document.createElement('p');
        status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
        this.shadowRoot.querySelector('.surface').append(status);
      }
      status.textContent = lang.startsWith('pl') ? pl : en;
    }
    async _sync() {
      const epoch = ++this._epoch;
      if (!this.isConnected) return;
      const hass = this._hass, config = this._panel?.config || {};
      if (hass?.user?.is_admin !== true || hass.user.is_active === false || !hass.user.id) {
        this._removeCard();
        this._message('An active administrator is required.', 'Wymagane jest konto aktywnego administratora.');
        return;
      }
      const entry = config.entry_id;
      if (typeof entry !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(entry)) {
        this._removeCard();
        this._message('Configure Storage Monitor in Integrations.', 'Skonfiguruj Storage Monitor w Integracjach.');
        return;
      }
      const identity = JSON.stringify([entry, hass.user.id]);
      if (this._card && this._cardIdentity === identity && this._connection === hass.connection) {
        this._card.hass = hass;
        return;
      }
      this._removeCard();
      this._message('Loading Storage Monitor…', 'Wczytywanie Storage Monitor…');
      const current = () => this.isConnected && this._epoch === epoch &&
        this._hass?.connection === hass.connection && this._hass?.user?.id === hass.user.id &&
        this._hass?.user?.is_admin === true && this._hass?.user?.is_active !== false;
      try {
        if (!customElements.get('ha-storage-monitor') && config.card_url) {
          const url = new URL(config.card_url, location.href);
          if (url.origin !== location.origin || url.pathname !== '/ha-storage-monitor-assets/ha-storage-monitor.js') {
            throw new Error('invalid_card_module');
          }
          // Share one immutable module URL with the integration's extra_js.
          await import(url.href);
        }
        if (!customElements.get('ha-storage-monitor')) {
          let timer;
          try {
            await Promise.race([customElements.whenDefined('ha-storage-monitor'),
              new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('card_not_loaded')), 10000); })]);
          } finally { clearTimeout(timer); }
        }
        if (!current()) return;
        if (customElements.get('ha-storage-monitor').storageBackendSchemaVersion !== 1) {
          this._message('Update the Storage Monitor dashboard card and reload this page.',
            'Zaktualizuj kartę Storage Monitor w HACS i odśwież tę stronę.');
          return;
        }
        const card = document.createElement('ha-storage-monitor');
        card.setConfig({type: 'custom:ha-storage-monitor', variant: 'full', default_tab: 'trend',
          backend_entry_id: entry, backend_source: 'auto'});
        card.hass = this._hass;
        this.shadowRoot.querySelector('p')?.remove();
        this.shadowRoot.querySelector('.surface').append(card);
        this._card = card;
        this._cardIdentity = identity;
        this._connection = hass.connection;
      } catch (_) {
        if (current()) this._message('Storage Monitor could not be loaded. Check its HACS installation and reload.',
          'Nie udało się wczytać Storage Monitor. Sprawdź instalację w HACS i odśwież stronę.');
      }
    }
  }
  if (!customElements.get('ha-storage-monitor-panel')) customElements.define('ha-storage-monitor-panel', StorageMonitorPanel);
})();

// Storage adaptation from Smart ae7b379: Energy a1d333dc3fef54e8a1fb430202d275699b65b016. Distinct tag and Storage-only allowlists.
// Native HA dialog-manager (frontend 20260826.7) owns this transient session.
// Its provideHass subscription supplies current identity after Lovelace replaces
// the initiating card. Neither an old card nor a cached hass authorizes Undo.
function createNativeDashboardPlacementV53(options) {
  const {host, getHass, getCardConfig, getSourceKey, createGuard} = options;
  let ancestor = host;
  while (ancestor && ancestor.localName !== 'home-assistant')
    ancestor = ancestor.parentElement || ancestor.getRootNode?.().host;
  if (!ancestor || typeof ancestor.provideHass !== 'function') return null;
  const doc = host.ownerDocument, win = doc.defaultView;
  const tag = 'ha-tools-storage-dashboard-placement-dialog-v53';
  const copy = value => JSON.parse(JSON.stringify(value));
  const route = () => win.location.pathname + win.location.search + win.location.hash;
  if (!win.customElements.get(tag)) {
    win.customElements.define(tag, class extends win.HTMLElement {
      set hass(value) {
        this._hass = value;
        this._guard?.observe(value);
        if (this._request && !this._sourceCurrent()) this.closeDialog();
        this._controller?.update();
      }
      get hass() { return this._hass; }
      _sourceCurrent() {
        const request = this._request;
        if (!request || request.cancelled || route() !== request.route) return false;
        return request.transferred || request.sourceCurrent();
      }
      showDialog(request) {
        this.closeDialog();
        if (request.cancelled) return;
        this._request = request; request.owner = this;
        // HA calls showDialog before appending the native element.
        win.queueMicrotask(() => this._start());
      }
      connectedCallback() { this._start(); }
      disconnectedCallback() { this.closeDialog(); }
      _start() {
        const request = this._request;
        if (!request || this._guard || !this.isConnected) return;
        if (!this._sourceCurrent() || this._hass?.connection !== request.connection ||
            this._hass?.user?.id !== request.user) { this.closeDialog(); return; }
        const guard = createGuard({getHass:() => this._hass,
          getContext:() => ({card:request.card,route:route()}),browser:win});
        this._guard = guard; this._token = guard.snapshot();
        if (!guard.current(this._token,true)) { this.closeDialog(); return; }
        this._unsubscribe = guard.subscribe(() => this.closeDialog());
        this._routeChanged = () => { if (!this._sourceCurrent()) this.closeDialog(); };
        for (const event of ['location-changed','popstate','hashchange']) win.addEventListener(event,this._routeChanged);
        this._controller ||= createDashboardPlacementV53({host:this,nativeOwned:true,
          getHass:() => this._sourceCurrent() && this._guard?.current(this._token,true) ? this._hass : null,
          getCardConfig:() => this._request?.card,
          getSourceKey:() => this._token?.epoch,
          onClose:() => { if (this._request) this.closeDialog(); }});
        if (!this._controller.open()) this.closeDialog();
      }
      transfer(request) {
        // Only a transaction already sent by the user's Add/Undo may outlive
        // a real source disconnect. A preview or unrelated teardown closes.
        if (this._request !== request || request.cancelled || route() !== request.route ||
            !this.isConnected || !this._guard?.current(this._token,true)) return false;
        // The source is already disconnected when its lifecycle callback runs.
        // Validate the sent transaction using the live native owner, rather
        // than requiring that detached source to remain connected.
        request.transferred = true;
        if (!this._controller?.acceptsOwnRemount()) { request.transferred = false; return false; }
        request.sourceCurrent = null; // Release all references to the old source.
        return true;
      }
      closeDialog() {
        const request = this._request;
        if (!request) return true;
        this._request = null; request.cancelled = true; request.owner = null;
        request.sourceCurrent = null; request.card = null; request.connection = null; request.user = null;
        this._unsubscribe?.(); this._unsubscribe = null;
        for (const event of ['location-changed','popstate','hashchange']) win.removeEventListener(event,this._routeChanged);
        this._routeChanged = null;
        const guard = this._guard; this._guard = null; this._token = null;
        this._controller?.close(); // Retain the raw lane until actual settlement.
        guard?.dispose();
        this.dispatchEvent(new win.CustomEvent('dialog-closed',{detail:{dialog:tag},bubbles:true,composed:true}));
        return true;
      }
    });
  }
  let request = null;
  function close() {
    if (!request) return;
    request.cancelled = true;
    if (request.owner?._request === request) request.owner.closeDialog();
    request.sourceCurrent = null; request.card = null; request = null;
  }
  return {
    open() {
      if (request && !request.cancelled) return true;
      const hass = getHass();
      if (!hass || !host.isConnected) return false;
      const card = copy(getCardConfig());
      const known = ['custom:ha-storage-monitor'];
      if (!known.includes(card?.type) || !options.cardTypes.includes(card.type)) return false;
      const source = JSON.stringify(getSourceKey()), signature = JSON.stringify(card);
      const next = {card,route:route(),connection:hass.connection,user:hass.user.id,cancelled:false,transferred:false,owner:null,
        sourceCurrent:() => {
          const live = getHass();
          return host.isConnected && live?.connection === next.connection && live?.user?.id === next.user &&
            JSON.stringify(getCardConfig()) === signature && JSON.stringify(getSourceKey()) === source;
        }};
      request = next;
      host.dispatchEvent(new win.CustomEvent('show-dialog',{bubbles:true,composed:true,detail:{
        dialogTag:tag,dialogImport:() => Promise.resolve(),dialogParams:next,addHistory:false}}));
      return true;
    },
    close,destroy:close,
    update() {
      if (!request || request.cancelled) return;
      if (!request.transferred && !request.sourceCurrent()) close();
      else request.owner?._controller?.update();
    },
    sourceDisconnected() {
      if (request?.owner?.transfer(request)) return true;
      close(); return false;
    }
  };
}
// Lovelace save has no CAS: compare-before-save reduces, but cannot eliminate,
// the race with another editor between the final read and the native save.
function createDashboardPlacementV53({host, getHass, getCardConfig,
  cardTypes = ['custom:ha-storage-monitor'],
  getSourceKey = () => null, createGuard, nativeOwned = false, onClose = () => {}}) {
  if (!nativeOwned) {
    const native = createNativeDashboardPlacementV53({host,getHass,getCardConfig,getSourceKey,cardTypes,createGuard});
    if (native) return native;
  }
  const known = ['custom:ha-storage-monitor'];
  const allowed = known.filter(type => cardTypes.includes(type));
  const clone = value => JSON.parse(JSON.stringify(value));
  const key = value => JSON.stringify(value);
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const pathOK = path => path === null || typeof path === 'string' && /^[a-z0-9][a-z0-9_-]*$/.test(path);
  const titleId = 'ha-tools-placement-' + Math.random().toString(36).slice(2);
  let session = null, dialog = null, destroyed = false, running = false, queued = null, returnFocus = null;
  let cancelledWrite = false;
  const text = (en, pl) => String(getHass()?.locale?.language || getHass()?.language || 'en').startsWith('pl') ? pl : en;
  function identity() {
    const hass = getHass();
    if (!host.isConnected || hass?.connected === false || !hass?.connection || hass.connection.connected === false ||
        typeof hass.callWS !== 'function' || typeof hass.user?.id !== 'string' || !hass.user.id ||
        hass.user.is_admin !== true || hass.user.is_active === false) return null;
    const card = clone(getCardConfig());
    if (!object(card) || !allowed.includes(card.type)) return null;
    return {connection:hass.connection, user:hass.user.id, card, signature:key(card), source:key(getSourceKey())};
  }
  function current(s, intent = s?.intent) {
    if (!s || session !== s || destroyed || s.intent !== intent) return false;
    if (!dialog?.isConnected) { close(); return false; }
    let live;
    try { live = identity(); } catch (_) { live = null; }
    if (!live || live.connection !== s.connection || live.user !== s.user || live.signature !== s.signature || live.source !== s.source) {
      close(); // Purge private snapshots and detached previews on identity/source revocation.
      return false;
    }
    return true;
  }
  // Single raw operation lane, including reads. Replacement intent never starts
  // another operation while a previous promise is unsettled, even after close().
  function enqueue(task) { queued = task; pump(); }
  async function pump() {
    if (running || !queued || destroyed) return;
    const task = queued; queued = null; running = true; paint();
    try { await task(); } catch (_) { /* Tasks expose localized states, never raw backend/private errors. */ }
    finally { running = false; paint(); pump(); }
  }
  async function call(s, intent, type, extra = {}) {
    if (!current(s, intent)) throw Error('cancelled');
    const message = {type, ...extra};
    if (type !== 'lovelace/dashboards/list' && s.target !== null) message.url_path = s.target;
    // Native HA performs fresh require_admin authorization independently.
    let value;
    try { value = await getHass().callWS(message); }
    catch (error) {
      if (['unauthorized','not_allowed','forbidden'].includes(error?.code) && session === s) close();
      throw error;
    }
    if (!current(s, intent)) throw Error('cancelled');
    return value;
  }
  function read(s, intent) { return call(s, intent, 'lovelace/config', {force:true}); }
  function validateConfig(config) {
    if (!object(config) || !Array.isArray(config.views) && !object(config.strategy)) throw Error('invalid_config');
    return clone(config);
  }
  function destination(s) {
    const config = s.baseline, view = config?.views?.[s.view];
    if (!object(config) || config.strategy || !object(view) || view.strategy) return null;
    const type = view.type || (view.panel === true ? 'panel' : 'masonry');
    if (type === 'sections') {
      const section = view.sections?.[s.section];
      return object(section) && !section.strategy && section.type === 'grid' &&
        (section.cards === undefined || Array.isArray(section.cards)) ? ['views',s.view,'sections',s.section,'cards'] : null;
    }
    if (type !== 'masonry' && type !== 'panel' || view.cards !== undefined && !Array.isArray(view.cards)) return null;
    if (type === 'panel' && view.cards?.length) return null;
    return ['views',s.view,'cards'];
  }
  function candidate(s) {
    const path = destination(s);
    if (!path) throw Error('readonly');
    const result = clone(s.baseline);
    let parent = result;
    for (const segment of path.slice(0,-1)) parent = parent[segment];
    parent.cards = [...(parent.cards || []), clone(s.card)];
    return result;
  }
  function clearTarget(s) {
    s.baseline = null; s.tx = null; s.previewReady = false; s.blocked = false;
    s.view = 0; s.section = 0; s.status = 'select';
    dialog?.querySelector('[data-preview]')?.replaceChildren();
  }
  function selectDashboard(value) {
    const s = session;
    if (!current(s) || s.writing) return;
    s.intent++; clearTarget(s);
    const choice = s.dashboards[Number(value)];
    if (value === '' || !choice) { s.target = undefined; paint(); return; }
    s.target = choice.url_path;
    if (choice.mode !== 'storage') { s.status = 'readonly'; paint(); return; }
    const intent = s.intent; s.status = 'loading'; paint();
    enqueue(async () => {
      if (!current(s, intent)) return;
      try {
        const config = validateConfig(await read(s, intent));
        if (!current(s, intent)) return;
        s.baseline = config; s.status = 'ready'; chooseView(0);
      } catch (_) { if (current(s, intent)) { s.status = 'error'; paint(); } }
    });
  }
  function chooseView(value) {
    const s = session;
    if (!current(s) || s.writing || !s.baseline) return;
    s.intent++; s.view = Number(value); s.tx = null; s.blocked = false; s.status = 'ready';
    const sections = s.baseline.views?.[s.view]?.sections;
    s.section = Array.isArray(sections) ? sections.findIndex(section => section?.type === 'grid' && !section.strategy) : -1;
    preview(); paint();
  }
  function chooseSection(value) {
    const s = session;
    if (!current(s) || s.writing) return;
    s.intent++; s.section = Number(value); s.tx = null; s.blocked = false; s.status = 'ready'; preview(); paint();
  }
  function preview() {
    const s = session, area = dialog?.querySelector('[data-preview]');
    if (!current(s) || !area) return;
    area.replaceChildren(); s.previewReady = false;
    if (!destination(s)) { s.status = 'readonly'; return; }
    // The allowlist is intersected with the concrete Storage type. No user HTML,
    // YAML forms, guessed dialog imports, or arbitrary custom-element names.
    const name = s.card.type.slice(7);
    if (!host.ownerDocument.defaultView.customElements.get(name)) { s.status = 'previewerror'; return; }
    try {
      const card = host.ownerDocument.createElement(name);
      // Prevent interactions in the visual preview from invoking card actions.
      card.preview = true; card.inert = true; card.setAttribute('inert',''); card.setConfig(clone(s.card)); card.hass = getHass();
      area.append(card); s.previewReady = true;
    } catch (_) { area.replaceChildren(); s.status = 'previewerror'; }
  }
  async function confirm(s, intent) {
    const value = validateConfig(await read(s, intent));
    if (!current(s, intent)) return;
    const tx = s.tx;
    if (key(value) === key(tx.expected)) {
      s.baseline = clone(value); s.blocked = true;
      if (tx.undoing) { s.tx = null; s.status = 'undone'; }
      else { tx.confirmed = clone(value); s.status = 'confirmed'; }
    } else { s.status = 'unconfirmed'; s.blocked = true; }
  }
  function write(undoing) {
    const s = session;
    if (!current(s) || running || s.writing || !s.baseline || s.target === undefined) return;
    if (undoing ? !s.tx?.confirmed : s.blocked || !s.previewReady || !destination(s)) return;
    const intent = s.intent, expectedCurrent = clone(undoing ? s.tx.confirmed : s.baseline);
    const expected = clone(undoing ? s.tx.before : candidate(s));
    const before = clone(undoing ? s.tx.before : s.baseline);
    s.writing = true; s.status = 'saving'; paint();
    enqueue(async () => {
      try {
        const latest = validateConfig(await read(s, intent));
        if (!current(s, intent)) return;
        if (key(latest) !== key(expectedCurrent)) { s.blocked = true; s.tx = null; s.status = 'conflict'; return; }
        // Private backup is detached and bound to this session's user,
        // connection and target. No persistent storage or exports.
        s.tx = {before, expected, confirmed:null, undoing}; s.blocked = true;
        // Deliberate compare-before-save, NOT atomic compare-and-swap.
        // Call exactly once, even if the response is lost or rejected.
        try { await call(s, intent, 'lovelace/config/save', {config:clone(expected)}); }
        catch (_) { if (!current(s, intent)) return; }
        if (!current(s, intent)) return;
        s.status = 'unconfirmed';
        await confirm(s, intent); // Reconcile an uncertain ACK using a read only.
      } catch (_) { if (current(s, intent)) { s.blocked = true; s.status = s.tx ? 'unconfirmed' : 'error'; } }
      finally { if (current(s, intent)) { s.writing = false; paint(); } }
    });
  }
  function reconcile() {
    const s = session;
    if (!current(s) || running || s.writing || !s.tx || s.tx.confirmed) return;
    const intent = s.intent; s.status = 'loading';
    enqueue(async () => {
      try { await confirm(s, intent); }
      catch (_) { if (current(s, intent)) s.status = 'unconfirmed'; }
    });
  }
  const messages = {
    select: ['Choose an existing dashboard.', 'Wybierz istniejący dashboard.'],
    loading: ['Loading…', 'Wczytywanie…'],
    ready: ['Preview only. Add saves this card to the selected place.', 'To podgląd. Dodaj zapisze kartę w wybranym miejscu.'],
    saving: ['Saving once and checking the result…', 'Jednorazowy zapis i sprawdzanie wyniku…'],
    confirmed: ['Save confirmed. Undo is available while nobody changes this dashboard.', 'Zapis potwierdzony. Cofnij jest dostępne, dopóki nikt nie zmieni tego dashboardu.'],
    undone: ['Original configuration restored and confirmed.', 'Przywrócenie pierwotnej konfiguracji potwierdzone.'],
    conflict: ['Dashboard changed. Nothing was overwritten. Reopen to review the current version.', 'Dashboard zmienił się. Niczego nie nadpisano. Otwórz ponownie, aby sprawdzić bieżącą wersję.'],
    unconfirmed: ['Save unconfirmed. Do not repeat Add. Check the result using read only.', 'Zapis niepotwierdzony. Nie powtarzaj Dodaj. Sprawdź wynik przez sam odczyt.'],
    error: ['Cannot load or compare the dashboard. Reopen to review it.', 'Nie można wczytać lub porównać dashboardu. Otwórz ponownie, aby go sprawdzić.'],
    readonly: ['Read-only here: YAML, strategy, occupied Panel or unsupported layout. Use the native HA editor.', 'Tutaj tylko odczyt: YAML, strategia, zajęty Panel lub nieobsługiwany układ. Użyj natywnego edytora HA.'],
    previewerror: ['Card preview unavailable. Add is disabled.', 'Podgląd karty jest niedostępny. Dodaj jest wyłączone.']
  };
  function options(select, choices, value) {
    // Preserve focused native select nodes and avoid rebuilding their options on busy changes.
    const signature = key(choices);
    if (select._choices !== signature) {
      select.replaceChildren();
      for (const [id, label] of choices) {
        const option = host.ownerDocument.createElement('option'); option.value = id; option.textContent = label; select.append(option);
      }
      select._choices = signature;
    }
    select.value = String(value);
  }
  function paint() {
    const s = session;
    if (!s || !dialog || !current(s)) return;
    const q = selector => dialog.querySelector(selector);
    q('h2').textContent = text('Add to dashboard', 'Dodaj do dashboardu');
    q('[data-label-dashboard]').textContent = text('Dashboard', 'Dashboard');
    q('[data-label-view]').textContent = text('View', 'Widok'); q('[data-label-section]').textContent = text('Section', 'Sekcja');
    q('[data-preview-label]').textContent = text('Card preview (destination layout may resize it)', 'Podgląd karty (układ miejsca docelowego może zmienić rozmiar)');
    q('[data-limit]').textContent = (cancelledWrite ? text('A previous save was cancelled while pending and may have completed. Inspect the dashboard in HA before another Add. ', 'Poprzedni zapis anulowano w trakcie i mógł się zakończyć. Przed kolejnym Dodaj sprawdź dashboard w HA. ') : '') + text('You can undo this addition until this window closes.', 'Możesz cofnąć dodanie karty do zamknięcia tego okna.');
    q('[role=status]').textContent = text(...messages[s.status]);
    const selected = s.dashboards.findIndex(d => d.url_path === s.target);
    options(q('[data-dashboard]'), [['',text('Choose…','Wybierz…')],...s.dashboards.map((d,i)=>[String(i),d.title])], selected < 0 ? '' : selected);
    options(q('[data-view]'), (s.baseline?.views || []).map((v,i)=>[String(i),v.title || v.path || text(`View ${i+1}`,`Widok ${i+1}`)]), s.view);
    const sections = s.baseline?.views?.[s.view]?.sections;
    options(q('[data-section]'), Array.isArray(sections) ? sections.flatMap((v,i)=>v?.type === 'grid' && !v.strategy ? [[String(i),v.title || text(`Section ${i+1}`,`Sekcja ${i+1}`)]] : []) : [], s.section);
    q('[data-section-label]').hidden = !Array.isArray(sections);
    q('[data-dashboard]').disabled = s.writing || !s.dashboards.length;
    q('[data-view]').disabled = s.writing || !s.baseline;
    q('[data-section]').disabled = s.writing || !s.baseline;
    q('[data-add]').textContent = text('Add','Dodaj');
    q('[data-add]').disabled = running || s.writing || s.blocked || !s.previewReady || !destination(s);
    q('[data-undo]').textContent = text('Undo','Cofnij'); q('[data-undo]').disabled = running || s.writing || !s.tx?.confirmed;
    q('[data-reconcile]').textContent = text('Check result (read only)','Sprawdź wynik (tylko odczyt)');
    q('[data-reconcile]').hidden = !s.tx || !!s.tx.confirmed; q('[data-reconcile]').disabled = running || s.writing;
    q('[data-cancel]').textContent = text('Cancel','Anuluj');
    const native = q('[data-native]'); native.textContent = text('Open dashboard in Home Assistant','Otwórz dashboard w Home Assistant');
    native.hidden = s.target === undefined;
    native.setAttribute('href', s.target === undefined ? '/lovelace' : `/${s.target || 'lovelace'}`);
  }
  function mount() {
    dialog = host.ownerDocument.createElement('dialog');
    dialog.setAttribute('data-ha-tools-placement','');
    dialog.setAttribute('aria-labelledby',titleId);
    dialog.setAttribute('aria-describedby',titleId+'-limit');
    dialog.innerHTML = `<style>
dialog[data-ha-tools-placement]{box-sizing:border-box;width:min(640px,calc(100vw - 24px));max-height:calc(100dvh - 32px);overflow:auto;padding:20px;border:1px solid var(--divider-color,#888);border-radius:var(--ha-card-border-radius,12px);background:var(--card-background-color,#fff);color:var(--primary-text-color,#202124);font:14px/1.5 var(--paper-font-body1_-_font-family,system-ui)}dialog[data-ha-tools-placement]::backdrop{background:rgba(0,0,0,.45)}dialog[data-ha-tools-placement] h2{font-size:20px;margin:0 0 16px}dialog[data-ha-tools-placement] label{display:block;margin:12px 0}dialog[data-ha-tools-placement] select,dialog[data-ha-tools-placement] button,dialog[data-ha-tools-placement] a{box-sizing:border-box;min-height:44px;font:inherit}dialog[data-ha-tools-placement] select{width:100%;padding:8px;background:var(--secondary-background-color,#eee);color:inherit;border:1px solid var(--divider-color,#888);border-radius:8px}dialog[data-ha-tools-placement] button{padding:10px 16px;background:var(--secondary-background-color,#eee);color:inherit;border:1px solid var(--divider-color,#888);border-radius:8px;cursor:pointer}dialog[data-ha-tools-placement] button:disabled{opacity:.55;cursor:default}dialog[data-ha-tools-placement] [data-add]{background:var(--primary-color,#1565c0);color:var(--text-primary-color,#fff)}dialog[data-ha-tools-placement] button:focus-visible,dialog[data-ha-tools-placement] select:focus-visible,dialog[data-ha-tools-placement] a:focus-visible{outline:3px solid var(--primary-color,#1565c0);outline-offset:2px}dialog[data-ha-tools-placement] [data-actions]{display:flex;gap:8px;flex-wrap:wrap}dialog[data-ha-tools-placement] [data-preview]{max-width:100%;overflow:hidden}dialog[data-ha-tools-placement] [data-meta]{font-size:12px;color:var(--secondary-text-color,#555)}dialog[data-ha-tools-placement] a{display:inline-flex;align-items:center;color:var(--primary-color,#1565c0)}dialog[data-ha-tools-placement] [hidden]{display:none!important}
      </style><h2 id="${titleId}"></h2>
      <label><span data-label-dashboard></span><select data-dashboard></select></label>
      <label><span data-label-view></span><select data-view></select></label>
      <label data-section-label hidden><span data-label-section></span><select data-section></select></label>
      <p data-preview-label></p><div data-preview></div><p role="status" aria-live="polite"></p>
      <p data-meta data-limit id="${titleId}-limit"></p><a data-native hidden></a>
      <div data-actions><button type="button" data-add></button><button type="button" data-undo></button><button type="button" data-reconcile hidden></button><button type="button" data-cancel></button></div>`;
    dialog.querySelector('[data-dashboard]').addEventListener('change', e => selectDashboard(e.target.value));
    dialog.querySelector('[data-view]').addEventListener('change', e => chooseView(e.target.value));
    dialog.querySelector('[data-section]').addEventListener('change', e => chooseSection(e.target.value));
    dialog.querySelector('[data-add]').addEventListener('click', () => write(false));
    dialog.querySelector('[data-undo]').addEventListener('click', () => write(true));
    dialog.querySelector('[data-reconcile]').addEventListener('click', reconcile);
    dialog.querySelector('[data-cancel]').addEventListener('click', close);
    dialog.addEventListener('cancel', e => {e.preventDefault(); close();});
    dialog.addEventListener('close', () => { if (dialog && !dialog.open) close(); });
    host.append(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.open = true;
  }
  function open() {
    if (destroyed) return false;
    if (session && current(session)) { dialog.querySelector('[data-dashboard]').focus(); return true; }
    let token;
    try { token = identity(); } catch (_) { return false; }
    if (!token) return false;
    returnFocus = host.ownerDocument.activeElement;
    while (returnFocus?.shadowRoot?.activeElement) returnFocus = returnFocus.shadowRoot.activeElement;
    const s = {...token,intent:0,dashboards:[],target:undefined,baseline:null,tx:null,view:0,section:0,writing:false,blocked:false,previewReady:false,status:'loading'};
    session = s; mount(); paint();
    dialog.querySelector('[data-cancel]').focus();
    enqueue(async () => {
      if (!current(s)) return;
      const intent = s.intent;
      try {
        const result = await call(s, intent, 'lovelace/dashboards/list');
        if (!current(s, intent)) return;
        if (!Array.isArray(result)) throw Error('invalid_dashboards');
        const mode = getHass()?.panels?.lovelace?.config?.mode;
        const list = mode === 'storage' || mode === 'yaml' ? [{url_path:null,title:text('Default dashboard','Domyślny dashboard'),mode}] : [];
        for (const d of result) if (object(d) && typeof d.url_path === 'string' && pathOK(d.url_path) && !list.some(v=>v.url_path===d.url_path)) {
          list.push({url_path:d.url_path,title:typeof d.title === 'string' ? d.title : d.url_path,mode:d.mode});
        }
        s.dashboards = list; s.status = list.length ? 'select' : 'readonly';
      } catch (_) { if (current(s, intent)) s.status = 'error'; }
    });
    return true;
  }
  function close() {
    const old = session; session = null; queued = null;
    // In-flight promise cannot be cancelled at HA. The lane remains occupied
    // until it settles; its continuation cannot render, read or write again.
    if (old) { if (old.writing && old.tx) cancelledWrite = true; old.intent++; old.baseline = null; old.tx = null; old.card = null; old.dashboards = []; }
    const node = dialog; dialog = null; node?.remove();
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    returnFocus = null;
    if (old) onClose();
  }
  function update() {
    if (!session || !current(session)) return;
    const card = dialog.querySelector('[data-preview]')?.firstElementChild;
    if (card) card.hass = getHass();
    paint();
  }
  function destroy() { close(); destroyed = true; }
  return {open,close,destroy,update,acceptsOwnRemount:() => !!session?.tx && current(session)};
}

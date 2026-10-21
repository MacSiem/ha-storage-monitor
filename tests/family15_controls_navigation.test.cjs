const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');
// ResizeObserver delivery is simulated only to specify threshold/lifecycle behavior.
// No layout API is mocked: real hitboxes, wrapping, zoom and native select geometry
// remain a separate Chrome acceptance check.
const tabs = ['overview', 'addons', 'backups', 'files', 'trend'];
async function setup(language = 'en', observerAvailable = true) {
  const dom = new JSDOM('', { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
  const observers = [], requests = [];
  if (observerAvailable) dom.window.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
    deliver(width) { this.callback([{ target: this.target, contentRect: { width } }]); }
  };
  dom.window.eval(readFileSync(join(__dirname, '..', 'ha-storage-monitor.js'), 'utf8'));
  const card = dom.window.document.createElement('ha-storage-monitor');
  card.setConfig({ show_support: false });
  dom.window.document.body.append(card);
  const hass = { language, user: { id: 'family-viewer', is_admin: false }, connection: { connected: true }, states: {},
    callWS: async message => { requests.push(message); return []; } };
  card.hass = hass;
  const root = card.shadowRoot;
  const render = () => { card._lastHtml = ''; card._render(); card._doUpdateContent(); };
  const activeTab = () => card._activeTab;
  const picker = () => root.querySelector('#ha-tools-tab-picker');
  const observer = () => observers.findLast(item => !item.disconnected && item.target === root.querySelector('.tabs').parentElement);
  const resize = width => {
    const style = dom.window.getComputedStyle(root.querySelector('.tabs'));
    // Delivery width is the observed parent's content box; threshold uses nav content.
    observer().deliver(width + (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0));
  };
  return { dom, card, hass, root, requests, observers, render, activeTab, picker, observer, resize };
}

for (const language of ['en', 'pl']) test(`all existing tabs share their original handlers in ${language}`, async () => {
  const f = await setup(language);
  try {
    assert.ok(f.picker(), 'A complete native select must exist for narrow cards');
    assert.equal(f.picker().labels[0].textContent, language === 'pl' ? 'Zakładka' : 'Tab');
    const options = () => Array.from(f.picker().options, option => option.value);
    assert.deepEqual(options(), tabs);
    f.resize(240);
    const before = f.requests.length;
    for (const tab of tabs) {
      f.picker().focus(); f.picker().value = tab;
      f.picker().dispatchEvent(new f.dom.window.Event('change', { bubbles: true }));
      assert.equal(f.activeTab(), tab);
      assert.equal(f.dom.window.location.hash, '#' + f.card._toolId + '/' + tab, 'Original navigation URL handler is retained');
      assert.equal(f.picker().value, tab);
      assert.deepEqual(options(), tabs, 'No arbitrary removal of less-used views');
      assert.equal(f.root.activeElement, f.picker());
      assert.equal(f.root.querySelector('.tabs').hidden, true);
      assert.equal(f.root.querySelector('.tabs button.active').dataset.tab, tab);
    }
    assert.equal(f.requests.length, before, 'Viewer navigation adds no scan, history read or write');
  } finally { f.dom.window.close(); }
});

test('container threshold transfers navigation focus without replacing content or changing selection', async () => {
  const f = await setup();
  try {
    const nav = f.root.querySelector('.tabs');
    const active = nav.querySelector('button.active'); active.focus();
    const before = f.requests.length, selection = f.activeTab();
    f.resize(280); assert.equal(nav.hidden, false); assert.equal(f.picker().parentElement.hidden, true);
    f.resize(279); assert.equal(nav.hidden, true); assert.equal(f.root.activeElement, f.picker());
    f.resize(900); assert.equal(nav.hidden, false); assert.equal(f.root.activeElement, active);
    assert.equal(f.activeTab(), selection); assert.equal(f.requests.length, before);
  } finally { f.dom.window.close(); }
});

test('ordinary render keeps narrow selection/focus and ignores obsolete observer delivery', async () => {
  const f = await setup();
  try {
    f.resize(240); f.picker().focus();
    const obsolete = f.observer(), selected = f.activeTab();
    f.render();
    assert.equal(obsolete.disconnected, true);
    assert.equal(f.picker().value, selected); assert.equal(f.root.activeElement, f.picker());
    assert.equal(f.root.querySelector('.tabs').hidden, true);
    obsolete.deliver(1200);
    assert.equal(f.root.querySelector('.tabs').hidden, true, 'Detached observed container cannot affect its replacement');
  } finally { f.dom.window.close(); }
});

test('effective disconnectedCallback cleans the observer and stale callbacks cannot affect a reattached card', async () => {
  const f = await setup();
  try {
    f.resize(240); const obsolete = f.observer();
    f.card.remove(); assert.equal(obsolete.disconnected, true);
    obsolete.deliver(900);
    assert.equal(f.root.querySelector('.tabs').hidden, true);
    f.dom.window.document.body.append(f.card);
    f.render(); f.resize(240);
    const current = f.observer(); assert.notEqual(current, obsolete);
    obsolete.deliver(900); assert.equal(f.root.querySelector('.tabs').hidden, true);
    f.resize(900); assert.equal(f.root.querySelector('.tabs').hidden, false);
  } finally { f.dom.window.close(); }
});

test('without ResizeObserver and without a measured width only the full tab row is exposed', async () => {
  const f = await setup('en', false);
  try {
    assert.equal(f.root.querySelector('.tabs').hidden, false);
    assert.equal(f.picker().parentElement.hidden, true);
    assert.deepEqual(Array.from(f.picker().options, item => item.value), tabs);
    f.root.querySelector('[data-tab=files]').click();
    assert.equal(f.activeTab(), 'files');
    assert.equal(f.picker().parentElement.hidden, true, 'Unknown width is not evidence of a narrow container');
  } finally { f.dom.window.close(); }
});

function nativeName(field) {
  return field.getAttribute('aria-label') || field.getAttribute('aria-labelledby') ||
    Array.from(field.labels || [], label => label.textContent.trim()).join(' ');
}

test('all currently served view controls have native names and checkboxes use real labels', async () => {
  const f = await setup();
  try {
    for (const tab of tabs) {
      f.root.querySelector(`.tabs button[data-tab="${tab}"]`).click();
      f.card._doUpdateContent();
      for (const field of f.root.querySelectorAll('input,select,textarea')) {
        assert.ok(nativeName(field), `Named control in ${tab}: ${field.outerHTML}`);
        if (field.type === 'checkbox') assert.ok(field.labels.length, 'Native label must forward pointer activation');
      }
    }
  } finally { f.dom.window.close(); }
});

test('real editor checkbox label toggles the small native indicator and emits the existing configuration contract', async () => {
  const f = await setup();
  try {
    const editor = f.dom.window.document.createElement('ha-storage-monitor-editor');
    editor.hass = { ...f.hass, user: { id: 'family-admin', is_admin: true }, states: {
      'sensor.family_used': { state: '2', attributes: { device_class: 'data_size', unit_of_measurement: 'GiB' } },
      'sensor.family_total': { state: '8', attributes: { device_class: 'data_size', unit_of_measurement: 'GiB' } },
    } };
    editor.setConfig({ title: 'Family', measured_history: { used_entity: 'sensor.family_used', total_entity: 'sensor.family_total', scope: 'disk', same_filesystem: false } });
    f.dom.window.document.body.append(editor);
    let config; editor.addEventListener('config-changed', event => { config = event.detail.config; });
    const checkbox = editor.shadowRoot.getElementById('cf_same_filesystem');
    assert.equal(checkbox.type, 'checkbox'); assert.ok(checkbox.labels.length);
    checkbox.labels[0].click(); assert.equal(config.measured_history.same_filesystem, true);
    assert.equal(config.measured_history.used_entity, 'sensor.family_used');
    for (const field of editor.shadowRoot.querySelectorAll('input,select')) assert.ok(nativeName(field));
  } finally { f.dom.window.close(); }
});


test('optional support dismiss stays named and removes only its own footer', async () => {
  const f = await setup();
  try {
    f.card._hass = { ...f.hass, user: { id: 'family-admin', is_admin: true } };
    f.card.setConfig({ show_support: true }); f.render();
    const dismiss = f.root.querySelector('.support-dismiss'); assert.ok(dismiss);
    assert.ok(dismiss.getAttribute('aria-label'));
    assert.ok(f.root.querySelector('.donate-section[data-source="own-card"] a[href]'));
    dismiss.click();
    assert.equal(f.root.querySelector('.donate-section[data-source="own-card"]'), null);
    assert.deepEqual(Array.from(f.picker().options, option => option.value), tabs);
    f.card._hass = f.hass; f.render();
    assert.equal(f.root.querySelector('.donate-section[data-source="own-card"]'), null);
  } finally { f.dom.window.close(); }
});


test('editor repaint retains committed input draft and caret without emitting another configuration change', async () => {
  const f = await setup();
  try {
    const editor = f.dom.window.document.createElement('ha-storage-monitor-editor');
    editor.hass = f.hass; editor.setConfig({ title: 'Family' }); f.dom.window.document.body.append(editor);
    let changes = 0; editor.addEventListener('config-changed', () => changes++);
    let input = editor.shadowRoot.getElementById('cf_title'); input.focus(); input.value = 'Family draft';
    input.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
    input.setSelectionRange(2, 6, 'backward'); editor._render();
    input = editor.shadowRoot.getElementById('cf_title');
    assert.equal(input.value, 'Family draft'); assert.equal(editor.shadowRoot.activeElement, input);
    assert.deepEqual([input.selectionStart, input.selectionEnd, input.selectionDirection], [2, 6, 'backward']);
    assert.equal(changes, 1);
  } finally { f.dom.window.close(); }
});


// NH-4 source regressions. Browser geometry, native dialog and keyboard QA remain owner work.
test('presentation editor preserves unknown YAML, false, zero, empty title and nested source options',async()=>{
 const f=await setup();try{
  const e=f.dom.window.document.createElement('ha-storage-monitor-editor');
  const config={title:'',variant:'full',show_support:false,limit:0,extension:{enabled:false,nested:{zero:0}},
   measured_history:{used_entity:'sensor.unavailable_used',total_entity:'sensor.unavailable_total',scope:'disk',same_filesystem:false,extension:{keep:0}}};
  e.hass={...f.hass,user:{id:'admin',is_admin:true}};
  e.setConfig(config);f.dom.window.document.body.append(e);
  let emitted;e.addEventListener('config-changed',event=>{emitted=event.detail.config;});
  const variant=e.shadowRoot.getElementById('cf_variant');variant.value='tile';variant.dispatchEvent(new f.dom.window.Event('change'));
  assert.equal(emitted.variant,'tile');assert.equal(emitted.title,'');assert.equal(emitted.show_support,false);assert.equal(emitted.limit,0);
  assert.equal(emitted.extension.nested.zero,0);assert.equal(emitted.extension.enabled,false);
  assert.equal(emitted.measured_history.extension.keep,0);assert.equal(emitted.measured_history.same_filesystem,false);
  assert.equal(e.shadowRoot.getElementById('cf_title').value,'');
  const tab=e.shadowRoot.getElementById('cf_default_tab');tab.value='trend';tab.dispatchEvent(new f.dom.window.Event('change'));
  assert.equal(emitted.default_tab,'trend');assert.equal(emitted.measured_history.used_entity,'sensor.unavailable_used');
 }finally{f.dom.window.close();}
});
test('editor retains unsupported values until explicitly changed and never adds variant to legacy YAML',async()=>{
 const f=await setup();try{
  const e=f.dom.window.document.createElement('ha-storage-monitor-editor');e.hass=f.hass;
  e.setConfig({title:'Legacy',unknown:{value:0}});
  assert.equal(Object.hasOwn(e._config,'variant'),false);
  assert.equal(e.shadowRoot.getElementById('cf_variant').value,'__legacy__');
  e.setConfig({title:'Future',variant:'future',default_tab:'cleanup',unknown:{value:0}});
  assert.equal(e.shadowRoot.getElementById('cf_variant').value,'future');
  assert.equal(e.shadowRoot.getElementById('cf_default_tab').value,'cleanup');
  const title=e.shadowRoot.getElementById('cf_title');title.value='New title';title.dispatchEvent(new f.dom.window.Event('input'));
  assert.equal(e._config.variant,'future');assert.equal(e._config.default_tab,'cleanup');assert.equal(e._config.unknown.value,0);
 }finally{f.dom.window.close();}
});
test('editor locale repaint retains an uncommitted text draft, focus and caret',async()=>{
 const f=await setup();try{
  const e=f.dom.window.document.createElement('ha-storage-monitor-editor');e.hass=f.hass;e.setConfig({title:'Saved'});f.dom.window.document.body.append(e);
  let changes=0;e.addEventListener('config-changed',()=>changes++);
  let input=e.shadowRoot.getElementById('cf_title');input.focus();input.value='Uncommitted draft';input.setSelectionRange(2,5,'backward');
  e.hass={...f.hass,locale:{language:'pl'}};
  input=e.shadowRoot.getElementById('cf_title');
  assert.equal(input.value,'Uncommitted draft');assert.equal(e.shadowRoot.activeElement,input);
  assert.deepEqual([input.selectionStart,input.selectionEnd,input.selectionDirection],[2,5,'backward']);
  assert.equal(changes,0);assert.equal(e._config.title,'Saved');
 }finally{f.dom.window.close();}
});
test('composition is not remounted by a hass repaint and the latest draft is retained',async()=>{
 const f=await setup();try{
  const e=f.dom.window.document.createElement('ha-storage-monitor-editor');e.hass=f.hass;e.setConfig({title:'Saved'});f.dom.window.document.body.append(e);
  const input=e.shadowRoot.getElementById('cf_title');input.focus();
  input.dispatchEvent(new f.dom.window.CompositionEvent('compositionstart'));input.value='Zażółć';
  input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
  e.hass={...f.hass,locale:{language:'pl'}};
  assert.equal(e.shadowRoot.getElementById('cf_title'),input);
  input.dispatchEvent(new f.dom.window.CompositionEvent('compositionend'));
  assert.equal(e.shadowRoot.getElementById('cf_title').value,'Zażółć');
  assert.equal(e.shadowRoot.activeElement.id,'cf_title');assert.equal(e._config.title,'Zażółć');
 }finally{f.dom.window.close();}
});
test('a small card opens its own full view, Escape closes it and focus returns to the current trigger',async()=>{
 const f=await setup();try{
  f.card.setConfig({variant:'compact',show_support:false});f.render();
  const trigger=f.root.getElementById('storage-open-full');trigger.focus();trigger.click();
  const view=f.card._fullView;assert.ok(view);assert.ok(view.shadowRoot.querySelector('dialog'));
  assert.equal(view.shadowRoot.activeElement.id,'storage-full-close');
  view.shadowRoot.querySelector('dialog').dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(f.card._fullView,null);assert.equal(f.root.activeElement.id,'storage-open-full');
  assert.equal(f.requests.length,0,'Viewer cannot obtain data by opening Full');
 }finally{f.dom.window.close();}
});
test('own full-view focus loop includes nested card controls and does not escape on Shift-Tab',async()=>{
 const f=await setup();try{
  f.card.setConfig({variant:'tile',show_support:false});f.card._openFullView();
  const view=f.card._fullView;const close=view.shadowRoot.getElementById('storage-full-close');close.focus();
  const event=new f.dom.window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true});
  close.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
  assert.ok(view._card.shadowRoot.activeElement,'Focus moves into this product card, not the dashboard');
  assert.equal(f.requests.length,0);
 }finally{f.dom.window.close();}
});

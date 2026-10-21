const assert = require('node:assert/strict');
const {test} = require('node:test');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {JSDOM} = require('jsdom');

function restoredCard(savedTab) {
  const dom = new JSDOM('', {runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/'});
  dom.window.localStorage.setItem('ha-storage-monitor-settings', JSON.stringify({_activeTab: savedTab}));
  dom.window.eval(readFileSync(join(__dirname, '..', 'ha-storage-monitor.js'), 'utf8'));
  const card = dom.window.document.createElement('ha-storage-monitor');
  card._hass = {user: {is_admin: true}};
  card.setConfig({type: 'custom:ha-storage-monitor'});
  return {dom, card};
}

for (const tab of ['overview', 'addons', 'backups', 'files', 'trend']) {
  test(`reload restores the visible and accessible ${tab} selection`, () => {
    const {dom, card} = restoredCard(tab);
    try {
      const active = [...card.shadowRoot.querySelectorAll('.tab-button.active')];
      assert.equal(active.length, 1);
      assert.equal(active[0].dataset.tab, tab);
      const selected = [...card.shadowRoot.querySelectorAll('[role="tab"][aria-selected="true"]')];
      assert.equal(selected.length, 1);
      assert.equal(selected[0].dataset.tab, tab);
    } finally {dom.window.close();}
  });
}

test('changing tabs keeps the accessible selection after focus leaves the tab', () => {
  const {dom, card} = restoredCard('overview');
  try {
    card.shadowRoot.querySelector('[data-tab="addons"]').click();
    card.shadowRoot.getElementById('refreshBtn').focus();
    assert.equal(card.shadowRoot.querySelector('[aria-selected="true"]').dataset.tab, 'addons');
    assert.equal(card.shadowRoot.querySelector('[data-tab="overview"]').getAttribute('aria-selected'), 'false');
  } finally {dom.window.close();}
});

test('an invalid persisted tab restores Overview instead of an empty view', () => {
  const {dom, card} = restoredCard('obsolete-tab');
  try {
    assert.equal(card._activeTab, 'overview');
    assert.equal(card.shadowRoot.querySelector('[aria-selected="true"]').dataset.tab, 'overview');
  } finally {dom.window.close();}
});

for (const tab of ['overview', 'addons', 'backups', 'files', 'trend']) {
  test(`sidebar panel restores ${tab} without Lovelace setConfig`, () => {
    const dom = new JSDOM('', {runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/ha-storage-monitor'});
    try {
      dom.window.localStorage.setItem('ha-storage-monitor-settings', JSON.stringify({_activeTab: tab}));
      dom.window.eval(readFileSync(join(__dirname, '..', 'ha-storage-monitor.js'), 'utf8'));
      const panel = dom.window.document.createElement('ha-storage-monitor');
      panel._hass = {user: {is_admin: false}};
      panel._render();
      assert.equal(panel.shadowRoot.querySelector('[aria-selected="true"]').dataset.tab, tab);
    } finally {dom.window.close();}
  });
}


// NH-4 migration specifications. No product test execution is claimed.
for(const [saved,expected] of [['top','files'],['cleanup','overview']])test('legacy '+saved+' remains reachable without invoking cleanup',()=>{
 const {dom,card}=restoredCard(saved);try{
  assert.equal(card._activeTab,expected);
  assert.equal(card.shadowRoot.querySelector('[aria-selected=true]').dataset.tab,expected);
  assert.equal(card._cleanupOpen,false);
  assert.equal(card.shadowRoot.querySelector('[data-tab=cleanup]'),null);
  assert.equal(card.shadowRoot.querySelector('[data-tab=top]'),null);
  assert.ok(card.shadowRoot.getElementById('cleanupBtn'));
  assert.equal(JSON.parse(dom.window.localStorage.getItem('ha-storage-monitor-settings'))._activeTab,saved,'Read is not a storage migration write');
  if(saved==='top')assert.equal(card._resourcesOpen,true);
  else assert.equal(card._legacyTab,'cleanup');
 }finally{dom.window.close();}
});
test('explicit default_tab wins initially and title edits preserve current navigation',()=>{
 const {dom,card}=restoredCard('addons');try{
  card.setConfig({default_tab:'trend'});assert.equal(card._activeTab,'trend');
  card.setActiveTab('files');card.setConfig({default_tab:'trend',title:'Edited'});
  assert.equal(card._activeTab,'files');
  card.setConfig({default_tab:'backups',title:'Edited'});assert.equal(card._activeTab,'backups');
 }finally{dom.window.close();}
});
test('writing a tab preserves unknown saved fields, false and zero',()=>{
 const {dom,card}=restoredCard('overview');try{
  dom.window.localStorage.setItem('ha-storage-monitor-settings',JSON.stringify({_activeTab:'overview',nested:{keep:0},flag:false}));
  card.shadowRoot.querySelector('[data-tab=files]').click();
  assert.deepEqual(JSON.parse(dom.window.localStorage.getItem('ha-storage-monitor-settings')),
   {_activeTab:'files',nested:{keep:0},flag:false});
 }finally{dom.window.close();}
});
test('saved cleanup shows its new location and only an explicit action opens read-only suggestions',()=>{
 const {dom,card}=restoredCard('cleanup');let calls=0,opens=0;
 try{
  card._hass={user:{is_admin:true,id:'qa'},callWS:async()=>{calls++;return {};}};
  card._loadStorageData=async()=>{};dom.window.document.body.append(card);
  card._storageData={source:'supervisor',diskTotal:100,diskUsed:90,diskFree:10,usedPercent:90,categories:[],addons:[],backups:[],hostname:'QA',osVersion:'QA'};
  card._loading=false;card._render();card._doUpdateContent();
  const original=card._openCleanup.bind(card);card._openCleanup=()=>{opens++;return original();};
  card._restoreTabState();card._doUpdateContent();
  assert.equal(opens,0);assert.equal(card._cleanupOpen,false);assert.equal(calls,0);
  assert.match(card.shadowRoot.getElementById('content').textContent,/saved Cleanup tab/);
  card.shadowRoot.getElementById('cleanupBtn').click();
  assert.equal(opens,1);assert.equal(card._cleanupOpen,true);assert.equal(calls,0);
  assert.match(card.shadowRoot.getElementById('content').textContent,/do not delete anything/);
  card.shadowRoot.getElementById('closeCleanup').click();
  assert.equal(card._cleanupOpen,false);assert.equal(card.shadowRoot.activeElement.id,'cleanupBtn');assert.equal(calls,0);
 }finally{dom.window.close();}
});
test('legacy aliases in public navigation do not execute cleanup or drop the ranking',()=>{
 const {dom,card}=restoredCard('overview');try{
  card.setActiveTab('top');assert.equal(card._activeTab,'files');assert.equal(card._resourcesOpen,true);
  card.setActiveTab('cleanup');assert.equal(card._activeTab,'overview');assert.equal(card._cleanupOpen,false);
 }finally{dom.window.close();}
});

const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {JSDOM}=require('jsdom');
function fixture(overrides={}) {
 const dom=new JSDOM('',{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
 dom.window.eval(readFileSync(require('node:path').join(__dirname,'../ha-storage-monitor.js'),'utf8'));
 const card=dom.window.document.createElement('ha-storage-monitor');card.setConfig({title:'QA'});
 card._hass={language:'en',user:{is_admin:true,id:'qa'},callWS:async m=>{
  if(Object.hasOwn(overrides,m.endpoint||m.type)){const v=overrides[m.endpoint||m.type];if(v instanceof Error)throw v;return v;}
  return {'/host/info':{disk_total:100,disk_used:40,disk_free:50},'/os/info':{version:'QA'},'/addons':{addons:[]},'/backups':{backups:[]},'config_entries/get':[]}[m.endpoint||m.type]||{};
 }};card._updateContent=()=>{};card._render();return {dom,card};
}
test('configuration edit retains loaded data and selected tab',async()=>{
 const {dom,card}=fixture();try{await card._loadStorageData();card._doUpdateContent();card.setConfig({title:'Changed'});assert.match(card.shadowRoot.querySelector('#content').textContent,/100.0 GB/);}finally{dom.window.close();}
});
test('unavailable inventories are never presented as empty',async()=>{
 const {dom,card}=fixture({'/addons':new Error('offline'),'/backups':new Error('offline')});try{await card._loadStorageData();assert.match(card._renderAddonsAndIntegrations(card._storageData),/Add-ons \(N\/A\)/);assert.match(card._renderBackups(card._storageData),/unavailable/i);assert.doesNotMatch(card._renderBackups(card._storageData),/No backups found/);}finally{dom.window.close();}
});
test('backup measurements never claim to measure local directories',async()=>{
 const {dom,card}=fixture({'/backups':{backups:[{name:'Remote',slug:'qa',size_bytes:10485760,locations:['network']} ]}});try{await card._loadStorageData();const doc=new JSDOM(card._renderFiles(card._storageData));for(const path of ['/backup/','/addons/']){const row=[...doc.window.document.querySelectorAll('tr')].find(r=>r.textContent.includes(path));assert.match(row.cells[1].textContent,/N\/A/);}doc.window.close();}finally{dom.window.close();}
});
test('Supervisor connection failure explains retry, not installation',async()=>{
 const {dom,card}=fixture({'/host/info':new Error('connection failed')});try{await card._loadStorageData();card._doUpdateContent();assert.doesNotMatch(card.shadowRoot.textContent,/Install HA OS/);assert.match(card.shadowRoot.textContent,/unavailable|retry/i);}finally{dom.window.close();}
});
test('invalid host measurements remain unavailable without NaN or invented free space',async()=>{
 const {dom,card}=fixture({'/host/info':{disk_total:'100',disk_used:-1}});try{await card._loadStorageData();assert.equal(card._storageData.diskTotal,null);assert.equal(card._storageData.diskUsed,null);assert.equal(card._storageData.diskFree,null);card._doUpdateContent();assert.doesNotMatch(card.shadowRoot.textContent,/NaN/);}finally{dom.window.close();}
});
test('Polish tabs, refresh, overview and backup headers use HA language',async()=>{
 const {dom,card}=fixture({'/backups':{backups:[{name:'Authored Backup',size_bytes:0,date:'2026-10-06',type:'full'}]}});try{await card._loadStorageData();card._lang='pl';card._render();card._doUpdateContent();assert.match(card.shadowRoot.textContent,/Przegląd/);assert.match(card.shadowRoot.textContent,/Odśwież/);assert.match(card._renderBackups(card._storageData),/Data/);assert.match(card._renderBackups(card._storageData),/Authored Backup/);assert.doesNotMatch(card._renderCleanup(card._storageData),/Supervisor reports|Disk capacity/);}finally{dom.window.close();}
});
test('detaching a card invalidates pending administrator work',async()=>{
 const {dom,card}=fixture();let resolveHost,calls=0;
 card._hass.callWS=async()=>{calls++;return calls===1 ? new Promise(r=>resolveHost=r) : {};};
 try{dom.window.document.body.append(card);const pending=card._loadStorageData();card.remove();resolveHost({disk_total:100,disk_used:40,disk_free:50});await pending;assert.equal(calls,1);assert.equal(card._storageData,null);}finally{dom.window.close();}
});
test('missing config entry source stays unavailable and successful read is dated',async()=>{
 const {dom,card}=fixture({'config_entries/get':[{title:'QA entry',domain:'qa_demo'}]});
 try{await card._loadStorageData();const doc=new JSDOM(card._renderAddonsAndIntegrations(card._storageData));const row=[...doc.window.document.querySelectorAll('tr')].find(r=>r.textContent.includes('QA entry'));assert.equal(row.cells[2].textContent,'N/A');doc.window.close();card._doUpdateContent();assert.match(card.shadowRoot.querySelector('#content').textContent,/Last successful read:/);}finally{dom.window.close();}
});
test('ordinary HA updates retain editor input focus and selection',()=>{
 const {dom}=fixture();try{const editor=dom.window.document.createElement('ha-storage-monitor-editor');dom.window.document.body.append(editor);editor.setConfig({title:'QA title'});editor.hass={language:'en'};const input=editor.shadowRoot.querySelector('input');input.focus();input.setSelectionRange(2,4);editor.hass={language:'en'};assert.equal(editor.shadowRoot.querySelector('input'),input);assert.equal(editor.shadowRoot.activeElement,input);assert.equal(input.selectionStart,2);assert.equal(input.selectionEnd,4);}finally{dom.window.close();}
});
test('installed add-ons with unknown state stay visible and counted',async()=>{
 const {dom,card}=fixture({'/addons':{addons:[{slug:'qa_unknown',name:'QA unknown-state add-on',state:'unknown'}]}});
 try{await card._loadStorageData();assert.equal(card._storageData.addonCount,1);assert.match(card._renderAddonsAndIntegrations(card._storageData),/QA unknown-state add-on/);assert.equal(card._storageData.addons[0].measured,false);}finally{dom.window.close();}
});

for(const language of ['en','pl']) {
 for(const [name,overrides,code] of [
  ['complete supported sources',{},'success'],
  ['missing free measurement',{'/host/info':{disk_total:100,disk_used:40}},'partial'],
  ['negative free measurement',{'/host/info':{disk_total:100,disk_used:40,disk_free:-1}},'partial'],
  ['string free measurement',{'/host/info':{disk_total:100,disk_used:40,disk_free:'60'}},'partial'],
  ['free exceeds total',{'/host/info':{disk_total:100,disk_used:40,disk_free:101}},'partial'],
  ['missing backup source',{'/backups':new Error('QA_RAW_BACKUPS')},'partial'],
  ['missing integration inventory',{'config_entries/get':null},'partial'],
  ['malformed addon entries',{'/addons':{addons:[null]}},'partial'],
  ['malformed backup entries',{'/backups':{backups:[null]}},'partial'],
  ['malformed config entries',{'config_entries/get':[null]},'partial'],
  ['no supported data',{'/host/info':{}},'no_data'],
  ['host transport error',{'/host/info':new Error('QA_RAW_HOST')},'error']
 ])test(`main refresh ${name} has truthful ${language} result`,async()=>{
  const {dom,card}=fixture(overrides);try{
   card._lang=language;await card._loadStorageData();card._doUpdateContent();
   const badge=card.shadowRoot.querySelector('[data-storage-result] [data-result-state]');assert.ok(badge);assert.equal(badge.dataset.resultState,code);
   const labels={en:{success:'Success',partial:'Partial',no_data:'No data',error:'Error'},pl:{success:'Sukces',partial:'Częściowo',no_data:'Brak danych',error:'Błąd'}};
   assert.match(badge.textContent,new RegExp(labels[language][code]));assert.doesNotMatch(card.shadowRoot.textContent,/QA_RAW_|TypeError|Cannot read/);
   if(code==='success'){assert.equal(card._storageData.categories.find(c=>c.name==='Database (Recorder)').measured,false);}
   if(name==='malformed addon entries'){assert.equal(card._storageData.addons.length,0);assert.equal(card._storageData.categories.find(c=>c.name==='Add-ons').measured,false);}
   if(name==='malformed backup entries'){assert.equal(card._storageData.backups.length,0);assert.equal(card._storageData.categories.find(c=>c.name==='Backups').measured,false);}
  }finally{dom.window.close();}
 });
 test(`main refresh pending clears previous success in ${language}`,async()=>{
  const {dom,card}=fixture();let release;try{
   card._lang=language;await card._loadStorageData();card._doUpdateContent();
   card._hass.callWS=async m=>m.endpoint==='/host/info'?new Promise(r=>release=r):{};
   const pending=card._loadStorageData();card._doUpdateContent();
   const badge=card.shadowRoot.querySelector('[data-storage-result] [data-result-state]');
   // Release before asserting so even a RED assertion cannot leave an unresolved test.
   release({});await pending;
   assert.ok(badge);assert.equal(badge.dataset.resultState,'not_checked');assert.equal(badge.textContent.includes(language==='pl'?'Nie sprawdzono':'Not checked'),true);
  }finally{release?.({});dom.window.close();}
 });
 test(`unexpected projection exception is localized and hides raw markers in ${language}`,async()=>{
  const badAddon={slug:'qa',name:'QA'};Object.defineProperty(badAddon,'disk_usage',{get(){throw new Error('QA_RAW_PROJECTION');}});
  const {dom,card}=fixture({'/addons':{addons:[badAddon]}});try{
   card._lang=language;await card._loadStorageData();card._doUpdateContent();
   assert.equal(card.shadowRoot.querySelector('[data-storage-result]').dataset.storageResult,'error');
   assert.doesNotMatch(card.shadowRoot.textContent,/QA_RAW_PROJECTION|Cannot read|TypeError/);
   assert.match(card.shadowRoot.textContent,language==='pl'?/Dane Supervisor niedostępne/:/Supervisor data unavailable/);
  }finally{dom.window.close();}
 });
}

const capacitySelection={used_entity:'sensor.qa_used',total_entity:'sensor.qa_total',scope:'QA data filesystem',same_filesystem:true};
const capacityState=(value,unit='GB')=>({state:String(value),attributes:{device_class:'data_size',unit_of_measurement:unit},last_updated:'2026-10-20T12:00:00Z'});
function selectCapacity(card,used=94,total=100,usedUnit='GB',totalUnit='GB') {
 card._hass.states={'sensor.qa_used':capacityState(used,usedUnit),'sensor.qa_total':capacityState(total,totalUnit)};
 card.setConfig({measured_history:{...capacitySelection}});
}
for(const language of ['en','pl'])test(`selected current capacity is independent of Supervisor and Recorder in ${language}`,async()=>{
 const {dom,card}=fixture();let calls=0;
 try{
  card._hass.callWS=async()=>{calls++;throw new Error('must not request another filesystem');};
  selectCapacity(card);card._hass.language=language;card._lang=language;await card._loadStorageData();card._doUpdateContent();
  const d=card._storageData;assert.equal(calls,0);assert.equal(d.diskUsed,94);assert.equal(d.diskTotal,100);assert.equal(d.diskFree,6);assert.equal(d.usedPercent,94);
  assert.equal(d.freeComputed,true);assert.equal(d.unit,'GB');assert.equal(d.source,'ha_entities');assert.equal(d.scope,capacitySelection.scope);
  assert.deepEqual(Array.from(d.sourceEntityIds),['sensor.qa_used','sensor.qa_total']);assert.equal(d.measuredAt,Date.parse('2026-10-20T12:00:00Z'));
  assert.equal(card._storageResult,'partial');assert.ok(d.categories.every(c=>c.measured===false));assert.equal(d.backupsAvailable,false);assert.equal(d.addonsAvailable,false);
  const content=card.shadowRoot.querySelector('#content');assert.match(content.textContent,/94%/);assert.match(content.textContent,/6.0 GB/);assert.match(content.textContent,/QA data filesystem/);assert.match(content.textContent,/sensor.qa_used/);
  assert.match(content.textContent,language==='pl'?/Wolne \(obliczone\)/:/Free \(calculated\)/);
  assert.match(content.textContent,language==='pl'?/Mało wolnego miejsca/:/Low free space/);
  assert.match(card._renderOverview(d),/stroke:#f44336/);assert.doesNotMatch(card._renderCleanup(d),/Supervisor (reports|podaje)|retention|retencj/);
  assert.doesNotMatch(card._renderBackups(d),/No backups found/);
  card._categoryView='data';assert.match(card._renderOverview(d),language==='pl'?/Niedostępne dla wybranego filesystemu/:/Unavailable for the selected filesystem/);
  // Spec 5.3: >=90 critical, >=80 warning. Each boundary uses real selected entities.
  for(const [used,color] of [[79,'var(--bento-primary)'],[80,'#ff9800'],[89,'#ff9800'],[90,'#f44336']]) {
   card._hass.states['sensor.qa_used']=capacityState(used);card.hass=card._hass;card._doUpdateContent();
   assert.equal(card._storageData.diskUsed,used);assert.ok(Math.abs(card._storageData.usedPercent-used)<1e-9);
   assert.ok(card._renderOverview(card._storageData).includes('stroke:'+color+';'),`capacity ${used}% uses ${color}`);
   const low=language==='pl'?'Mało wolnego miejsca':'Low free space';
   assert.equal(card.shadowRoot.querySelector('#content').textContent.includes(low),used>=90);
  }
 }finally{dom.window.close();}
});
for(const [used,total,unit,totalUnit] of [
 ['unavailable',100,'GB','GB'],['unknown',100,'GB','GB'],['',100,'GB','GB'],['NaN',100,'GB','GB'],[-1,100,'GB','GB'],
 [1,0,'GB','GB'],[101,100,'GB','GB'],[94,100,'%','GB'],[94,100,'GB','unknown'],['Infinity',100,'GB','GB']
])test(`selected invalid capacity ${used}/${total} ${unit}/${totalUnit} never falls back`,async()=>{
 const {dom,card}=fixture();let calls=0;try{
  card._hass.callWS=async()=>{calls++;return {disk_total:200,disk_used:1};};selectCapacity(card,used,total,unit,totalUnit);await card._loadStorageData();card._doUpdateContent();
  assert.equal(calls,0);assert.equal(card._storageResult,'no_data');for(const key of ['diskTotal','diskUsed','diskFree','usedPercent'])assert.equal(card._storageData[key],null);
  assert.doesNotMatch(card.shadowRoot.querySelector('#content').textContent,/NaN|Infinity|Install HA OS/);
 }finally{dom.window.close();}
});
test('current capacity reuses exact binary/decimal normalization and preserves measured zero',async()=>{
 const {dom,card}=fixture();try{
  selectCapacity(card,1,2,'GB','GiB');await card._loadStorageData();assert.equal(card._storageData.diskTotal,2*2**30/1e9);assert.equal(card._storageData.diskFree,(2*2**30-1e9)/1e9);assert.equal(card._storageData.usedPercent,47);
  card._hass.states['sensor.qa_used']=capacityState(0);card.hass=card._hass;assert.equal(card._storageData.diskUsed,0);assert.equal(card._storageData.usedPercent,0);
  delete card._hass.states['sensor.qa_total'];card.hass=card._hass;assert.equal(card._storageData.diskTotal,null);
 }finally{dom.window.close();}
});
test('scope, pair confirmation, identity, connection and authority invalidate selected capacity',async()=>{
 const {dom,card}=fixture();try{
  selectCapacity(card);card.hass=card._hass;assert.equal(card._storageData.usedPercent,94);
  card.setConfig({measured_history:{...capacitySelection,scope:'Second filesystem',same_filesystem:false}});assert.equal(card._storageData.diskTotal,null);assert.equal(card._storageData.scope,'Second filesystem');
  card.setConfig({measured_history:{...capacitySelection}});assert.equal(card._storageData.usedPercent,94);
  card._hass.user.id='second-admin';card._hass.states={};card.hass=card._hass;assert.equal(card._storageData.diskTotal,null);
  selectCapacity(card);card._hass.connection={connected:false};card.hass=card._hass;assert.equal(card._storageData,null);
  card._hass.connection={connected:true};card.hass=card._hass;assert.equal(card._storageData.usedPercent,94);
  card._hass.user.is_admin=false;card.hass=card._hass;assert.equal(card._storageData.permissionDenied,true);assert.doesNotMatch(card.shadowRoot.querySelector('#content').textContent,/94%/);
 }finally{dom.window.close();}
});
test('selecting a filesystem invalidates an in-flight Supervisor response',async()=>{
 const {dom,card}=fixture();let release,calls=0;try{
  card._hass.callWS=async()=>{calls++;return new Promise(r=>release=r);};const pending=card._loadStorageData();
  selectCapacity(card);assert.equal(card._storageData.usedPercent,94);release({disk_total:1,disk_used:1});await pending;
  assert.equal(calls,1);assert.equal(card._storageData.source,'ha_entities');assert.equal(card._storageData.diskTotal,100);
 }finally{release?.({});dom.window.close();}
});
test('missing source timestamps remain explicitly unavailable',async()=>{
 const {dom,card}=fixture();try{
  selectCapacity(card);delete card._hass.states['sensor.qa_used'].last_updated;await card._loadStorageData();card._doUpdateContent();
  assert.equal(card._storageData.measuredAt,null);assert.match(card.shadowRoot.querySelector('#content').textContent,/measurement time unavailable/);
 }finally{dom.window.close();}
});
for(const delta of [{total_entity:undefined},{total_entity:'sensor.qa_used'},{same_filesystem:false},{scope:''}])test(`unconfirmed/incomplete selected pair ${JSON.stringify(delta)} cannot read Supervisor`,async()=>{
 const {dom,card}=fixture();let calls=0;try{
  selectCapacity(card);card._hass.callWS=async()=>{calls++;return {};};card.setConfig({measured_history:{...capacitySelection,...delta}});await card._loadStorageData();
  assert.equal(calls,0);assert.equal(card._storageResult,'no_data');assert.equal(card._storageData.diskTotal,null);
 }finally{dom.window.close();}
});
test('removing the explicit pair returns to the original Supervisor source',async()=>{
 const {dom,card}=fixture();try{
  selectCapacity(card);await card._loadStorageData();card.setConfig({title:'Default host'});await card._loadStorageData();
  assert.equal(card._storageData.source,'supervisor');assert.equal(card._storageData.diskUsed,40);assert.equal(card._storageData.freeComputed,false);assert.equal(card._storageData.diskFree,50);
 }finally{dom.window.close();}
});

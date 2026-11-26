const assert=require('node:assert/strict');
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {JSDOM}=require('jsdom');
function response(m) {
 if(m.endpoint==='/host/info')return {disk_total:100,disk_used:40,hostname:'QA_CURRENT_HOST'};
 if(m.endpoint==='/os/info')return {version:'QA_OS'};
 if(m.endpoint==='/addons')return {addons:[{slug:'qa',name:'QA_CURRENT_ADDON',state:'started',version:'1'}]};
 if(m.endpoint==='/addons/qa/info')return {disk_usage:1048576};
 if(m.endpoint==='/backups')return {backups:[]};
 if(m.type==='config_entries/get')return [];
 return {};
}
function setup() {
 const dom=new JSDOM('',{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
 dom.window.console.debug=()=>{};dom.window.console.warn=()=>{};
 dom.window.eval(readFileSync(join(__dirname,'..','ha-storage-monitor.js'),'utf8'));
 const card=dom.window.document.createElement('ha-storage-monitor');
 card.setConfig({show_support:false});
 const calls=[];
 const hass=(language='en',is_admin=true,id='qa-admin',rpc)=>({language,user:is_admin===null?{}:{id,is_admin},states:{},themes:{darkMode:false},callWS:async m=>{calls.push(m);return rpc?rpc(m):response(m);}});
 const settle=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));card._doUpdateContent();};
 return {dom,card,calls,hass,settle};
}
for(const admin of [false,null])test(`unconfirmed administrator (${admin}) requests no storage data`,async()=>{
 const {dom,card,calls,hass,settle}=setup();try{card.hass=hass('pl',admin);await settle();assert.equal(calls.length,0);assert.match(card.shadowRoot.textContent,/Wymagane uprawnienia administratora/);}finally{dom.window.close();}
});
test('ordinary language changes update existing content without storage reads or losing tab/sort',async()=>{
 const {dom,card,calls,hass,settle}=setup();try{
  card.hass=hass();await settle();card.setActiveTab('files');card._sortBy='name';card._sortAsc=true;card._doUpdateContent();card._lastDataFetch=Date.now();
  const before=calls.length;assert.match(card.shadowRoot.getElementById('content').textContent,/Sort:/);
  card.hass=hass('pl');assert.match(card.shadowRoot.getElementById('content').textContent,/Sortuj:/);assert.equal(card._activeTab,'files');assert.equal(card._sortBy,'name');assert.equal(card._sortAsc,true);assert.equal(calls.length,before);
  card.hass=hass('en');assert.match(card.shadowRoot.getElementById('content').textContent,/Sort:/);assert.equal(calls.length,before);
 }finally{dom.window.close();}
});
test('cached administrator storage clears immediately on role loss and follows permission language',async()=>{
 const {dom,card,calls,hass,settle}=setup();try{
  card.hass=hass();await settle();card.setActiveTab('addons');await settle();card._lastDataFetch=Date.now();assert.match(card.shadowRoot.getElementById('content').textContent,/QA_CURRENT_ADDON/);const before=calls.length;
  card.hass=hass('pl',false);assert.doesNotMatch(card.shadowRoot.getElementById('content').textContent,/QA_CURRENT_ADDON/);assert.match(card.shadowRoot.getElementById('content').textContent,/Wymagane uprawnienia administratora/);assert.equal(calls.length,before);
  card.hass=hass('en',false);await settle();assert.match(card.shadowRoot.getElementById('content').textContent,/Administrator access required/);assert.equal(calls.length,before);
 }finally{dom.window.close();}
});
test('late host response after role loss cannot request further endpoints or restore cached data',async()=>{
 const {dom,card,calls,hass,settle}=setup();let release;const pending=new Promise(r=>release=r);try{
  card.hass=hass('en',true,'qa-admin',m=>m.endpoint==='/host/info'?pending:response(m));assert.equal(calls.length,1);
  card.hass=hass('pl',false);release(response({endpoint:'/host/info'}));await settle();assert.equal(calls.length,1);assert.match(card.shadowRoot.getElementById('content').textContent,/Wymagane uprawnienia administratora/);assert.doesNotMatch(card.shadowRoot.textContent,/QA_CURRENT_HOST|QA_CURRENT_ADDON/);
 }finally{dom.window.close();}
});
test('same administrator hass replacement keeps a pending read without duplication',async()=>{
 const {dom,card,calls,hass,settle}=setup();let release;const pending=new Promise(r=>release=r);try{
  card.hass=hass('en',true,'qa-admin',m=>m.endpoint==='/host/info'?pending:response(m));
  card.hass=hass('pl',true,'qa-admin');assert.equal(calls.length,1);release(response({endpoint:'/host/info'}));await settle();assert.equal(calls.length,7);assert.equal(card._storageData.hostname,'QA_CURRENT_HOST');
 }finally{dom.window.close();}
});
test('regained authority accepts fresh storage and ignores the older late response',async()=>{
 const {dom,card,calls,hass,settle}=setup();let release;const pending=new Promise(r=>release=r);try{
  card.hass=hass('en',true,'qa-admin',m=>m.endpoint==='/host/info'?pending:response(m));card.hass=hass('pl',false);card.hass=hass('pl',true);await settle();assert.equal(calls.length,8);assert.equal(card._storageData.hostname,'QA_CURRENT_HOST');
  release({disk_total:999,disk_used:888,hostname:'QA_OLD_HOST'});await settle();assert.equal(calls.length,8);assert.equal(card._storageData.hostname,'QA_CURRENT_HOST');assert.doesNotMatch(card.shadowRoot.textContent,/QA_OLD_HOST/);
 }finally{dom.window.close();}
});
test('reused mutable user object cannot retain another account cache while new data is pending',async()=>{
 const {dom,card,calls,hass,settle}=setup();let release;const pending=new Promise(r=>release=r);try{
  const first=hass();card.hass=first;await settle();card.setActiveTab('addons');await settle();assert.match(card.shadowRoot.getElementById('content').textContent,/QA_CURRENT_ADDON/);
  first.user.id='qa-next-admin';first.callWS=async m=>{calls.push(m);return m.endpoint==='/host/info'?pending:response(m);};card.hass=first;
  assert.doesNotMatch(card.shadowRoot.getElementById('content').textContent,/QA_CURRENT_ADDON/);release(response({endpoint:'/host/info'}));await settle();assert.equal(card._storageData.hostname,'QA_CURRENT_HOST');
 }finally{release?.({});dom.window.close();}
});

test('native dashboard reparenting starts a fresh read without replaying detached data',async()=>{
 const {dom,card,calls,hass,settle}=setup();try{
  dom.window.document.body.append(card);card.hass=hass();await settle();card.setActiveTab('addons');await settle();const before=calls.length;
  card.remove();assert.equal(card.shadowRoot.getElementById('content').textContent,'');assert.equal(card._storageData,null);
  dom.window.document.body.append(card);await settle();assert.match(card.shadowRoot.getElementById('content').textContent,/QA_CURRENT_ADDON/);assert.equal(calls.length,before+7);
 }finally{dom.window.close();}
});
test('authority revoked while detached cannot trigger reads on reconnection',async()=>{
 const {dom,card,calls,hass,settle}=setup();try{
  dom.window.document.body.append(card);const shared=hass();card.hass=shared;await settle();const before=calls.length;
  card.remove();shared.user.is_admin=false;dom.window.document.body.append(card);await settle();assert.equal(calls.length,before);assert.match(card.shadowRoot.getElementById('content').textContent,/Administrator access required/);assert.doesNotMatch(card.shadowRoot.textContent,/QA_CURRENT_ADDON/);
 }finally{dom.window.close();}
});

// Deferred tests always release responses and use bounded event turns; old code fails promptly.
for (const change of ['connection', 'instance', 'offline', 'inactive']) test(`main read rejects changed ${change} with the same administrator`,async()=>{
 const {dom,card,calls,hass,settle}=setup();let release;const pending=new Promise(r=>release=r);const oldEndpoints=[];
 try {
  const first=hass('en',true,'qa-admin',m=>{oldEndpoints.push(m.endpoint||m.type);return m.endpoint==='/host/info'?pending:response(m);});
  first.connection={connected:true};first.config={instance_id:'qa-old'};card.hass=first;
  const replacement=hass('pl',true,'qa-admin');replacement.connection=first.connection;replacement.config={...first.config};
  if(change==='connection')replacement.connection={connected:true};
  if(change==='instance')replacement.config.instance_id='qa-next';
  if(change==='offline')replacement.connection.connected=false;
  if(change==='inactive')replacement.user.is_active=false;
  card.hass=replacement;
  release({disk_total:999,disk_used:888,hostname:'QA_OLD_HOST'});await settle();
  assert.equal(calls.filter(m=>m.endpoint==='/os/info').length,change==='offline'||change==='inactive'?0:1);
  assert.deepEqual(oldEndpoints,['/host/info']);
  assert.doesNotMatch(card.shadowRoot.textContent,/QA_OLD_HOST/);
  if(change==='offline'||change==='inactive')assert.equal(card._storageData?.hostname,undefined);
  else assert.equal(card._storageData.hostname,'QA_CURRENT_HOST');
 }finally{release?.({});dom.window.close();}
});
test('same connection and instance preserve pending read across language and callWS replacement',async()=>{
 const {dom,card,calls,hass,settle}=setup();let release;const pending=new Promise(r=>release=r);
 try {
  const first=hass('en',true,'qa-admin',m=>m.endpoint==='/host/info'?pending:response(m));first.connection={connected:true};first.config={instance_id:'qa'};card.hass=first;
  const replacement=hass('pl');replacement.connection=first.connection;replacement.config={...first.config};card.hass=replacement;
  assert.equal(calls.length,1);release(response({endpoint:'/host/info'}));await settle();assert.equal(calls.length,7);assert.equal(card._storageData.hostname,'QA_CURRENT_HOST');
 }finally{release?.({});dom.window.close();}
});
test('cached data disappears immediately on same-admin connection replacement',async()=>{
 const {dom,card,hass,settle}=setup();let release;const pending=new Promise(r=>release=r);
 try {
  const first=hass();first.connection={connected:true};card.hass=first;await settle();card.setActiveTab('addons');await settle();
  const replacement=hass('en',true,'qa-admin',m=>m.endpoint==='/host/info'?pending:response(m));replacement.connection={connected:true};card.hass=replacement;
  assert.equal(card._storageData,null);assert.doesNotMatch(card.shadowRoot.getElementById('content').textContent,/QA_CURRENT_ADDON/);
  release(response({endpoint:'/host/info'}));await settle();assert.equal(card._storageData.hostname,'QA_CURRENT_HOST');
 }finally{release?.({});dom.window.close();}
});
test('connection disconnect event invalidates pending read without waiting for a hass setter',async()=>{
 const {dom,card,calls,hass,settle}=setup();let release;const pending=new Promise(r=>release=r);
 try {
  dom.window.document.body.append(card);const first=hass('en',true,'qa-admin',m=>m.endpoint==='/host/info'?pending:response(m));
  first.connection=new dom.window.EventTarget();first.connection.connected=true;card.hass=first;
  first.connection.dispatchEvent(new dom.window.Event('disconnected'));
  release(response({endpoint:'/host/info'}));await settle();assert.equal(calls.length,1);assert.equal(card._storageData,null);
 }finally{release?.({});dom.window.close();}
});

test('browser offline event clears loaded main data and prevents refresh transport',async()=>{
 const {dom,card,calls,hass,settle}=setup();try{
  dom.window.document.body.append(card);const first=hass();first.connection={connected:true};card.hass=first;await settle();
  const before=calls.length;dom.window.dispatchEvent(new dom.window.Event('offline'));
  assert.equal(card._storageData,null);await card._loadStorageData();assert.equal(calls.length,before);
  assert.equal(card.shadowRoot.querySelector('[data-storage-result]').dataset.storageResult,'not_checked');
  assert.match(card.shadowRoot.getElementById('content').textContent,/Connection unavailable/);
 }finally{dom.window.close();}
});


// NH-4 product-owned full-view session and locale source specifications, NOT RUN.
async function smallWithSelectedSource() {
 const f=setup();const {card,dom}=f;
 const selection={used_entity:'sensor.modal_used',total_entity:'sensor.modal_total',scope:'QA_PRIVATE_FILESYSTEM',same_filesystem:true};
 const sample=value=>({state:String(value),last_updated:'2026-10-20T12:00:00Z',attributes:{device_class:'data_size',unit_of_measurement:'GB'}});
 const listeners=new Map();
 const connection={connected:true,addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener(name,fn){listeners.get(name)?.delete(fn);}};
 const h={...f.hass(),connection,locale:{language:'en',time_zone:'server',time_format:'24'},
  config:{instance_id:'qa-instance',version:'2026.10.0',components:['history','recorder'],time_zone:'Europe/Warsaw'},
  states:{'sensor.modal_used':sample(94),'sensor.modal_total':sample(100)}};
 card.setConfig({variant:'compact',default_tab:'overview',show_support:false,measured_history:selection});
 dom.window.document.body.append(card);card.hass=h;await f.settle();
 return {...f,h,connection,sample};
}
test('owned full view shares the same snapshot and receives every current hass without extra storage reads',async()=>{
 const f=await smallWithSelectedSource();try{
  const trigger=f.card.shadowRoot.getElementById('storage-open-full');trigger.focus();trigger.click();
  const view=f.card._fullView,full=view._card;
  assert.ok(view);assert.equal(view.tagName,'HA-STORAGE-MONITOR-FULL-VIEW');
  assert.equal(full._hass,f.h);assert.equal(full._storageData,f.card._storageData);assert.equal(f.calls.length,0);
  const next={...f.h,states:{...f.h.states,'sensor.modal_used':{...f.sample(95),last_updated:'2026-10-20T12:05:00Z'}}};
  f.card.hass=next;
  assert.equal(f.card._fullView,view);assert.equal(full._hass,next);
  assert.equal(full._storageData,f.card._storageData);assert.equal(full._storageData.usedPercent,95);
  assert.deepEqual(Array.from(full._storageData.sourceMeasuredAt),Array.from(f.card._storageData.sourceMeasuredAt));
  assert.equal(f.calls.length,0);
  view.shadowRoot.getElementById('storage-full-close').click();
  assert.equal(f.card._fullView,null);assert.equal(view.isConnected,false);
  assert.equal(f.card.shadowRoot.activeElement.id,'storage-open-full');
 }finally{f.dom.window.close();}
});
for(const reason of ['role','inactive','identity','groups','instance','connection','offline','null-session'])test('open full view clears on '+reason,async()=>{
 const f=await smallWithSelectedSource();try{
  f.card._openFullView();const view=f.card._fullView,full=view._card;
  let next={...f.h};
  if(reason==='role')next.user={...f.h.user,is_admin:false};
  if(reason==='inactive')next.user={...f.h.user,is_active:false};
  if(reason==='identity')next.user={...f.h.user,id:'different-user'};
  if(reason==='groups')next.user={...f.h.user,group_ids:['changed']};
  if(reason==='instance')next.config={...f.h.config,instance_id:'different-instance'};
  if(reason==='connection')next.connection={connected:true};
  if(reason==='offline')next.connection={connected:false};
  if(reason==='null-session')next=null;
  f.card.hass=next;
  assert.equal(f.card._fullView,null);assert.equal(view.isConnected,false);
  assert.equal(full._hass,null);assert.equal(full._storageData,null);assert.equal(full._trendResult,null);
  assert.equal(f.calls.length,0);
  if(['role','inactive','null-session'].includes(reason))
   assert.doesNotMatch(f.card.shadowRoot.getElementById('storage-small-surface').textContent,/94%|QA_PRIVATE_FILESYSTEM/);
  if(reason==='offline') { const text=f.card.shadowRoot.getElementById('storage-small-surface').textContent; assert.doesNotMatch(text,/94%/); assert.match(text,/QA_PRIVATE_FILESYSTEM/); }
 }finally{f.dom.window.close();}
});
test('a late Recorder result cannot repopulate a full view closed after role loss',async()=>{
 const f=await smallWithSelectedSource();let release,requests=0;try{
  const current={...f.h,callWS:()=>{requests++;return new Promise(resolve=>{release=resolve;});}};
  f.card.hass=current;f.card._openFullView();const full=f.card._fullView._card;
  full.setActiveTab('trend');const pending=full._loadStorageHistory();await Promise.resolve();
  assert.equal(requests,1);
  f.card.hass={...current,user:{...current.user,is_admin:false}};
  release({'sensor.modal_used':[{s:'94',lu:Date.now()/1000-1,a:{device_class:'data_size',unit_of_measurement:'GB'}}]});
  await pending;
  assert.equal(f.card._fullView,null);assert.equal(full._trendResult,null);assert.equal(full._trendWire,null);
  assert.equal(requests,1);assert.equal(full._hass,null);
 }finally{release?.({});f.dom.window.close();}
});
test('full-view navigation does not overwrite the dashboard card saved tab or browser URL',async()=>{
 const f=await smallWithSelectedSource();try{
  f.dom.window.localStorage.setItem('ha-storage-monitor-settings',JSON.stringify({_activeTab:'files',keep:0}));
  const url=f.dom.window.location.href;
  f.card._openFullView();f.card._fullView._card.shadowRoot.querySelector('[data-tab=backups]').click();
  assert.deepEqual(JSON.parse(f.dom.window.localStorage.getItem('ha-storage-monitor-settings')),{_activeTab:'files',keep:0});
  assert.equal(f.dom.window.location.href,url);
 }finally{f.dom.window.close();}
});
test('profile locale updates the formatter and open full view without replacing the selected snapshot',async()=>{
 const f=await smallWithSelectedSource();try{
  f.card._openFullView();const view=f.card._fullView;
  const next={...f.h,language:'en',locale:{language:'pl',time_zone:'server',time_format:'12',date_format:'language'},themes:{darkMode:true}};
  f.card.hass=next;
  assert.equal(f.card._lang,'pl');assert.equal(view._card._lang,'pl');
  assert.equal(f.card._formatUi().timeZone,'Europe/Warsaw');assert.equal(f.card._formatUi().hourCycle,'h12');
  assert.equal(f.card.classList.contains('bento-dark'),true);
  assert.equal(view._card._storageData,f.card._storageData);assert.equal(f.calls.length,0);
  const exact=view._card._trendDate(Date.parse('2026-10-25T00:30:00Z'),true);
  const later=view._card._trendDate(Date.parse('2026-10-25T01:30:00Z'),true);
  assert.notEqual(exact,later,'Repeated local DST times retain their offsets in details');
 }finally{f.dom.window.close();}
});
test('removing a small card closes its own full view and discards its child session',async()=>{
 const f=await smallWithSelectedSource();try{
  f.card._openFullView();const view=f.card._fullView,full=view._card;
  f.card.remove();assert.equal(f.card._fullView,null);assert.equal(view.isConnected,false);
  assert.equal(full._hass,null);assert.equal(full._storageData,null);
 }finally{f.dom.window.close();}
});

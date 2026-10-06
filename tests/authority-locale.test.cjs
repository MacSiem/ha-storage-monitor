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

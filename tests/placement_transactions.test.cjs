// Reused Energy a1d333d transaction regression suite; adapted actual preview type to Storage.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('shared/ha-tools-dashboard-placement.js','utf8');
const copy=v=>JSON.parse(JSON.stringify(v));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function flush(){for(let i=0;i<8;i++)await tick();}
function setup(config={views:[{title:'Home',cards:[]}]},language='en'){
  const dom=new JSDOM('',{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'}),w=dom.window;
  let card={type:'custom:ha-storage-monitor',title:'Energy'},sourceKey='a',stored=copy(config),hook=null;
  const calls=[],connection={connected:true};
  let hass={user:{id:'admin',is_admin:true},connection,language,panels:{lovelace:{config:{mode:'storage'}}},callWS:async message=>{
    calls.push(copy(message));if(hook){const result=hook(message);if(result!==undefined)return result;}
    if(message.type==='lovelace/dashboards/list')return [{url_path:'other',title:'Other',mode:'storage'},{url_path:'yaml',title:'YAML',mode:'yaml'}];
    if(message.type==='lovelace/config')return copy(stored);
    if(message.type==='lovelace/config/save'){stored=copy(message.config);return null;}
    throw Error('Unexpected request');
  }};
  class Preview extends w.HTMLElement{setConfig(c){this.config=copy(c);this.textContent=c.title||'Energy';}}
  w.customElements.define('ha-storage-monitor',Preview);
  w.eval(source+'\nwindow.factory=createDashboardPlacementV53;');
  const host=w.document.createElement('div');w.document.body.append(host);
  const api=w.factory({host,getHass:()=>hass,getCardConfig:()=>card,getSourceKey:()=>sourceKey});
  const q=s=>host.querySelector(s),select=async(s,value)=>{q(s).value=String(value);q(s).dispatchEvent(new w.Event('change',{bubbles:true}));await flush();};
  const open=async()=>{api.open();await flush();await select('[data-dashboard]','0');};
  return {dom,w,host,api,q,calls,select,open,get stored(){return stored;},set stored(v){stored=v;},get hass(){return hass;},set hass(v){hass=v;},set card(v){card=v;},set sourceKey(v){sourceKey=v;},set hook(v){hook=v;},done(){api.destroy();w.close();}};
}
const saves=x=>x.calls.filter(c=>c.type==='lovelace/config/save');
test('closed factory performs no IO, mounts no preview, and non-admin open is refused',async()=>{
 const x=setup();try{assert.equal(x.calls.length,0);assert.equal(x.host.children.length,0);x.hass.user.is_admin=false;assert.equal(x.api.open(),false);await flush();assert.equal(x.calls.length,0);}finally{x.done();}
});
test('preview is the allowlisted real card; add once, readback, and exact undo preserve unknown fields',async()=>{
 const original={title:'Private',unknown:{preserve:[1,2]},views:[{title:'Home',cards:[{type:'tile',entity:'light.a'}]}]};
 const x=setup(original);try{await x.open();assert.equal(saves(x).length,0);assert.deepEqual(x.q('[data-preview] ha-storage-monitor').config,{type:'custom:ha-storage-monitor',title:'Energy'});assert.equal(x.q('[data-add]').disabled,false);
 x.q('[data-add]').click();x.q('[data-add]').click();await flush();assert.equal(saves(x).length,1);assert.equal(x.stored.views[0].cards.length,2);assert.equal(x.q('[data-undo]').disabled,false);assert.match(x.q('[role=status]').textContent,/confirmed/i);
 x.q('[data-undo]').click();await flush();assert.equal(saves(x).length,2);assert.deepEqual(x.stored,original);assert.equal(x.q('[data-undo]').disabled,true);assert.ok(x.calls.filter(c=>c.type==='lovelace/config').every(c=>c.force===true));assert.ok(saves(x).every(c=>!('expected_revision'in c)));}finally{x.done();}
});
test('changed dashboard between preview and explicit save is not overwritten',async()=>{
 const x=setup();try{await x.open();x.stored.views[0].title='Someone else';x.q('[data-add]').click();await flush();assert.equal(saves(x).length,0);assert.match(x.q('[role=status]').textContent,/changed/i);assert.equal(x.q('[data-add]').disabled,true);}finally{x.done();}
});
test('undo refuses foreign changes after confirmed save',async()=>{
 const x=setup();try{await x.open();x.q('[data-add]').click();await flush();x.stored.views.push({title:'Other',cards:[]});x.q('[data-undo]').click();await flush();assert.equal(saves(x).length,1);assert.equal(x.stored.views.length,2);assert.match(x.q('[role=status]').textContent,/changed/i);}finally{x.done();}
});
test('only selected existing grid section receives a card, panel occupied and strategy remain read-only',async()=>{
 const x=setup({views:[{title:'Sections',type:'sections',sections:[{type:'grid',cards:[]},{type:'grid',cards:[{type:'tile'}]}]},{title:'Panel',type:'panel',cards:[{type:'tile'}]},{title:'Strategy',strategy:{type:'original'}}]});
 try{await x.open();await x.select('[data-section]',1);x.q('[data-add]').click();await flush();assert.equal(x.stored.views[0].sections[0].cards.length,0);assert.equal(x.stored.views[0].sections[1].cards.length,2);
 await x.select('[data-view]',1);assert.equal(x.q('[data-add]').disabled,true);await x.select('[data-view]',2);assert.equal(x.q('[data-add]').disabled,true);assert.ok(x.q('[data-native]').getAttribute('href').startsWith('/'));}finally{x.done();}
});
test('empty panel accepts exactly one card; YAML does not load private config or allow writes',async()=>{
 const x=setup({views:[{type:'panel',cards:[]}]});try{await x.open();x.q('[data-add]').click();await flush();assert.equal(x.stored.views[0].cards.length,1);const before=x.calls.length;await x.select('[data-dashboard]',2);assert.equal(x.calls.length,before);assert.equal(x.q('[data-add]').disabled,true);assert.match(x.q('[role=status]').textContent,/read.only/i);}finally{x.done();}
});
for(const change of ['role','user','connection','source','card','detach'])test(`pending config discarded on ${change}`,async()=>{
 const x=setup(),d=deferred();try{x.hook=m=>m.type==='lovelace/config'?d.promise:undefined;x.api.open();await flush();const selecting=x.select('[data-dashboard]',0);await tick();
 if(change==='role')x.hass.user.is_admin=false;if(change==='user')x.hass.user.id='other';if(change==='connection')x.hass={...x.hass,connection:{connected:true}};if(change==='source')x.sourceKey='b';if(change==='card')x.card={type:'custom:ha-storage-monitor',title:'Changed'};if(change==='detach')x.host.remove();
 x.api.update();d.resolve({views:[{cards:[]}]});await selecting;assert.equal(saves(x).length,0);assert.equal(x.q('[data-preview]'),null);assert.equal(x.host.children.length,0);}finally{x.done();}
});
test('cancel pending load purges dialog and blocks late results and any new IO',async()=>{
 const x=setup(),d=deferred();try{x.hook=m=>m.type==='lovelace/config'?d.promise:undefined;x.api.open();await flush();void x.select('[data-dashboard]',0);await tick();x.api.close();const n=x.calls.length;d.resolve({views:[{cards:[]}]});await flush();assert.equal(x.calls.length,n);assert.equal(x.host.children.length,0);}finally{x.done();}
});
test('latest target intent wins while one config read is pending',async()=>{
 const x=setup(),d=deferred();try{let once=true;x.hook=m=>m.type==='lovelace/config'&&once?(once=false,d.promise):undefined;x.api.open();await flush();void x.select('[data-dashboard]',0);await tick();void x.select('[data-dashboard]',1);d.resolve({views:[{title:'Old response',cards:[]}]});await flush();assert.equal(x.calls.filter(c=>c.type==='lovelace/config').at(-1).url_path,'other');x.q('[data-add]').click();await flush();assert.equal(saves(x)[0].url_path,'other');}finally{x.done();}
});
test('save rejection is reconciled by readback without retry and can enable exact undo',async()=>{
 const x=setup();try{await x.open();x.hook=m=>{if(m.type==='lovelace/config/save'){x.stored=copy(m.config);return Promise.reject(Error('ack lost'));}};x.q('[data-add]').click();await flush();assert.equal(saves(x).length,1);assert.equal(x.q('[data-undo]').disabled,false);assert.match(x.q('[role=status]').textContent,/confirmed/i);}finally{x.done();}
});
test('unknown write with failed readback stays blocked until explicit read-only reconciliation',async()=>{
 const x=setup();try{await x.open();let written=false;x.hook=m=>{if(m.type==='lovelace/config/save'){written=true;x.stored=copy(m.config);return Promise.reject(Error('disconnect'));}if(written&&m.type==='lovelace/config')return Promise.reject(Error('offline'));};
 x.q('[data-add]').click();await flush();assert.equal(saves(x).length,1);assert.equal(x.q('[data-add]').disabled,true);assert.equal(x.q('[data-undo]').disabled,true);x.hook=null;x.q('[data-reconcile]').click();await flush();assert.equal(saves(x).length,1);assert.equal(x.q('[data-undo]').disabled,false);}finally{x.done();}
});
test('pending save holds single wire through cancel and reopen; no readback after cancelled session',async()=>{
 const x=setup(),d=deferred();try{await x.open();x.hook=m=>m.type==='lovelace/config/save'?d.promise:undefined;x.q('[data-add]').click();await flush();assert.equal(saves(x).length,1);x.api.close();const n=x.calls.length;x.api.open();await flush();assert.equal(x.calls.length,n);d.resolve(null);await flush();assert.equal(saves(x).length,1);assert.equal(x.calls.slice(n).filter(m=>m.type==='lovelace/config').length,0);}finally{x.done();}
});
test('readback normalization is unconfirmed, never grants undo or another save',async()=>{
 const x=setup();try{await x.open();x.hook=m=>{if(m.type==='lovelace/config/save'){x.stored={...copy(m.config),normalized:true};return Promise.resolve(null);}};x.q('[data-add]').click();await flush();assert.equal(saves(x).length,1);assert.equal(x.q('[data-undo]').disabled,true);assert.equal(x.q('[data-add]').disabled,true);assert.match(x.q('[role=status]').textContent,/unconfirmed/i);}finally{x.done();}
});
test('Polish accessible native dialog, keyboard cancellation, focus return, and no persistent storage',async()=>{
 const x=setup(undefined,'pl');try{const trigger=x.w.document.createElement('button');x.w.document.body.append(trigger);trigger.focus();await x.open();const dialog=x.q('dialog');assert.ok(dialog.getAttribute('aria-labelledby'));assert.equal(x.q('[data-add]').textContent,'Dodaj');assert.equal(x.q('[data-cancel]').textContent,'Anuluj');assert.match(x.q('style').textContent,/44px/);assert.match(x.q('style').textContent,/14px/);assert.match(x.q('style').textContent,/12px/);dialog.dispatchEvent(new x.w.Event('cancel',{cancelable:true}));assert.equal(x.host.children.length,0);assert.equal(x.w.document.activeElement,trigger);assert.equal(x.w.localStorage.length,0);}finally{x.done();}
});
test('unknown card type and caller allowlist widening cannot open or create previews',async()=>{
 const x=setup();try{x.card={type:'custom:unknown'};assert.equal(x.api.open(),false);await flush();assert.equal(x.calls.length,0);assert.equal(x.host.children.length,0);}finally{x.done();}
});

test('late role loss during final compare prevents save',async()=>{
 const x=setup(),d=deferred();try{await x.open();x.hook=m=>m.type==='lovelace/config'?d.promise:undefined;x.q('[data-add]').click();await tick();x.hass.user.is_admin=false;d.resolve({views:[{title:'Home',cards:[]}]});await flush();assert.equal(saves(x).length,0);assert.equal(x.host.children.length,0);}finally{x.done();}
});
test('native authorization denial purges the UI and does not attempt readback',async()=>{
 const x=setup();try{await x.open();x.hook=m=>m.type==='lovelace/config/save'?Promise.reject({code:'unauthorized'}):undefined;x.q('[data-add]').click();await flush();assert.equal(saves(x).length,1);assert.equal(x.calls.at(-1).type,'lovelace/config/save');assert.equal(x.host.children.length,0);}finally{x.done();}
});
test('visual preview is inert and cannot expose live card actions',async()=>{
 const x=setup();try{await x.open();assert.equal(x.q('[data-preview] ha-storage-monitor').hasAttribute('inert'),true);}finally{x.done();}
});

test('top-level strategy without views remains read-only with native dashboard link',async()=>{
 const x=setup({strategy:{type:'original'}});try{await x.open();assert.equal(x.q('[data-add]').disabled,true);assert.match(x.q('[role=status]').textContent,/read.only/i);assert.equal(x.q('[data-native]').hidden,false);assert.equal(saves(x).length,0);}finally{x.done();}
});

test('foreign JSON key reordering is conservatively protected before add and undo',async()=>{
 const original={title:'Home',unknown:1,views:[{title:'Home',cards:[]}]};
 const x=setup(original);try{await x.open();x.stored={unknown:1,title:'Home',views:copy(original.views)};x.q('[data-add]').click();await flush();assert.equal(saves(x).length,0);assert.match(x.q('[role=status]').textContent,/changed/i);}finally{x.done();}
 const y=setup(original);try{await y.open();y.q('[data-add]').click();await flush();const before=JSON.stringify(y.stored);y.q('[data-undo]').click();await flush();assert.equal(JSON.stringify(y.stored),JSON.stringify(original));assert.notEqual(before,JSON.stringify(original));}finally{y.done();}
 const z=setup(original);try{await z.open();z.q('[data-add]').click();await flush();const saved=z.stored;z.stored={unknown:saved.unknown,title:saved.title,views:saved.views};z.q('[data-undo]').click();await flush();assert.equal(saves(z).length,1);assert.match(z.q('[role=status]').textContent,/changed/i);}finally{z.done();}
});

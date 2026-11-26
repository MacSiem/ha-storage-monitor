const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const clone=x=>JSON.parse(JSON.stringify(x)),tick=()=>new Promise(r=>setImmediate(r));
async function setup(config={}){
 const dom=new JSDOM('',{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'}),w=dom.window;
 w.console.info=()=>{};w.eval(fs.readFileSync('ha-storage-monitor.js','utf8'));
 const ha=w.document.createElement('home-assistant'),card=w.document.createElement('ha-storage-monitor'),calls=[];
 let owner,hook=null,stored={title:'Existing',foreign:{keep:[0,false]},views:[{title:'Home',type:'sections',sections:[{type:'grid',cards:[]}]}]};
 const connection=Object.assign(new w.EventTarget(),{connected:true}),sample=value=>({state:String(value),last_updated:'2026-10-20T12:00:00Z',attributes:{device_class:'data_size',unit_of_measurement:'GB'}});
 const hass={language:'en',locale:{language:'en',time_zone:'server'},themes:{darkMode:false},user:{id:'admin',is_admin:true},connection,connected:true,config:{version:'2026.10.1',instance_id:'qa',components:['history','recorder'],time_zone:'Europe/Warsaw'},panels:{lovelace:{config:{mode:'storage'}}},states:{'sensor.used':sample(94),'sensor.total':sample(100)}};
 hass.callWS=async m=>{calls.push(clone(m));if(hook){const value=hook(m);if(value!==undefined)return value;}if(m.type==='lovelace/dashboards/list')return [];if(m.type==='lovelace/config')return clone(stored);if(m.type==='lovelace/config/save'){stored=clone(m.config);return null;}throw Error('Unexpected '+m.type);};
 ha.provideHass=e=>{e.hass=hass;};ha.addEventListener('show-dialog',event=>{owner=w.document.createElement(event.detail.dialogTag);ha.provideHass(owner);owner.showDialog(event.detail.dialogParams);ha.append(owner);});
 card.setConfig({title:'Storage',variant:'full',future:{keep:true},show_support:false,measured_history:{used_entity:'sensor.used',total_entity:'sensor.total',scope:'QA disk',same_filesystem:true},...config});ha.append(card);w.document.body.append(ha);card.hass=hass;
 const flush=async()=>{for(let i=0;i<12;i++)await tick();};await flush();
 return {w,ha,card,hass,calls,flush,get owner(){return owner;},get stored(){return stored;},set stored(v){stored=v;},set hook(v){hook=v;},q(selector){return owner?.querySelector(selector)||card.shadowRoot.querySelector(selector);},saves(){return calls.filter(m=>m.type==='lovelace/config/save');},async open(){const button=card.shadowRoot.querySelector('[data-storage-dashboard-add]');assert.ok(button);button.click();await flush();const select=owner.querySelector('[data-dashboard]');select.value='0';select.dispatchEvent(new w.Event('change',{bubbles:true}));await flush();},close(){owner?.closeDialog();card.remove();ha.remove();w.close();}};
}
test('admin Full exposes local placement configuration without reads or another backend',async()=>{
 const f=await setup();try{const footer=f.card.shadowRoot.querySelector('[data-storage-dashboard-footer]');assert.ok(footer);assert.equal(f.calls.length,0);const config=f.card._placementConfigV53();assert.equal(config.type,'custom:ha-storage-monitor');assert.equal(config.variant,'compact');assert.equal(config.measured_history.scope,'QA disk');config.future.keep=false;assert.equal(f.card._config.future.keep,true);f.card.hass={...f.hass,language:'pl',locale:{...f.hass.locale,language:'pl'}};assert.match(f.card.shadowRoot.querySelector('[data-storage-dashboard-add]').textContent,/dashboardu/);assert.equal(f.calls.length,0);}finally{f.close();}
});
test('native placement has Storage-only inert preview and exact Add/Undo preserving foreign fields',async()=>{
 const f=await setup();try{const before=clone(f.stored);await f.open();const preview=f.q('[data-preview] ha-storage-monitor');assert.ok(preview);assert.equal(preview.preview,true);assert.equal(preview.inert,true);assert.equal(preview._config.variant,'compact');assert.equal(preview._config.measured_history.scope,'QA disk');assert.equal(preview.shadowRoot.querySelector('[data-storage-dashboard-footer]'),null);f.q('[data-add]').click();await f.flush();assert.equal(f.saves().length,1);assert.equal(f.stored.views[0].sections[0].cards[0].type,'custom:ha-storage-monitor');f.q('[data-undo]').click();await f.flush();assert.equal(f.saves().length,2);assert.deepEqual(f.stored,before);}finally{f.close();}
});
test('own remount after sent Add and lost acknowledgement permits only current native readback/Undo',async()=>{
 const f=await setup();try{const before=clone(f.stored);await f.open();f.hook=m=>{if(m.type==='lovelace/config/save'){f.stored=clone(m.config);f.card.remove();return Promise.reject(Error('lost ACK'));}};f.q('[data-add]').click();await f.flush();assert.equal(f.saves().length,1);assert.ok(f.owner.querySelector('dialog[open]'));assert.equal(f.q('[data-undo]').disabled,false);f.hook=null;f.q('[data-undo]').click();await f.flush();assert.equal(f.saves().length,2);assert.deepEqual(f.stored,before);}finally{f.close();}
});
test('foreign dashboard edits block Undo, source detach before Add closes without writing',async()=>{
 const f=await setup();try{await f.open();f.q('[data-add]').click();await f.flush();f.stored.foreignEdit=true;f.q('[data-undo]').click();await f.flush();assert.equal(f.saves().length,1);assert.equal(f.stored.foreignEdit,true);}finally{f.close();}
 const g=await setup();try{await g.open();g.card.remove();await g.flush();assert.equal(g.owner.querySelector('dialog'),null);assert.equal(g.saves().length,0);}finally{g.close();}
});
test('household and preview cannot start placement; live authority loss clears its open session',async()=>{
 const f=await setup();try{await f.open();f.hass.user.is_admin=false;f.card.hass=f.hass;f.owner.hass=f.hass;await f.flush();assert.equal(f.card.shadowRoot.querySelector('[data-storage-dashboard-footer]'),null);assert.equal(f.owner.querySelector('dialog'),null);assert.equal(f.saves().length,0);}finally{f.close();}
 for(const config of [{variant:'tile'},{variant:'compact'}]){const g=await setup(config);try{assert.equal(g.card.shadowRoot.querySelector('[data-storage-dashboard-footer]'),null);assert.equal(g.calls.length,0);}finally{g.close();}}
 const h=await setup();try{h.card.preview=true;h.card.hass=h.hass;assert.equal(h.card.shadowRoot.querySelector('[data-storage-dashboard-footer]'),null);assert.equal(h.calls.length,0);}finally{h.close();}
});

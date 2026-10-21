// Written before implementation; intentionally NOT RUN in the patch-artifact worker.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {JSDOM}=require('jsdom');
const ids=['sensor.qa_used','sensor.qa_total'];
const config={title:'QA',measured_history:{used_entity:ids[0],total_entity:ids[1],scope:'QA filesystem',same_filesystem:true}};
const state=(s,lu,unit='GiB',device_class='data_size')=>({s:String(s),lu,a:{device_class,unit_of_measurement:unit}});
function setup({mounted=true,admin=true,version='2026.5.0',ws=async()=>({})}={}) {
 const dom=new JSDOM('',{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
 dom.window.eval(readFileSync(require('node:path').join(__dirname,'../ha-storage-monitor.js'),'utf8'));
 const listeners=new Map();
 const connection={connected:true,addEventListener(t,f){if(!listeners.has(t))listeners.set(t,new Set());listeners.get(t).add(f);},removeEventListener(t,f){listeners.get(t)?.delete(f);}};
 const hass={language:'en',locale:{time_zone:'server',time_format:'24'},user:{id:'qa-user',is_admin:admin},connection,config:{version,components:['history','recorder'],time_zone:'Europe/Warsaw'},states:Object.fromEntries(ids.map(id=>[id,{state:'10',attributes:{device_class:'data_size',unit_of_measurement:'GiB'}}])),callWS:ws};
 const card=dom.window.document.createElement('ha-storage-monitor');card.setConfig(config);card._hass=hass;
 // Isolate the existing Supervisor loader; tests below exercise the real new Recorder methods.
 card._loadStorageData=async()=>{};
 if(mounted)dom.window.document.body.append(card);
 card._syncTrendContext();
 return {dom,card,hass,connection,listeners,emit(t){for(const f of listeners.get(t)||[])f(connection);}};
}
const scope={start:Date.parse('2026-10-24T00:00:00Z'),end:Date.parse('2026-10-27T00:00:00Z'),entityIds:ids};
const time=scope.start/1000;
test('compressed WS units are historical, bytes are exact, zero differs from unavailable',()=>{
 const f=setup();try{
  const raw={[ids[0]]:[state(0,time),state(1,time+1,'GB'),state('unavailable',time+2),state(1,time+3,'MiB')],[ids[1]]:[state(100,time,'GiB')]};
  const result=f.card._trendProject(raw,scope);
  assert.deepEqual(Array.from(result.rows.filter(r=>r.kind==='used'),r=>r.bytes),[0,1e9,null,1048576]);
  assert.equal(result.retention,'unknown');assert.equal(result.coverage,'unknown');assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.rows));assert.ok(result.rows.every(Object.isFrozen));
  assert.equal(raw[ids[0]][0].s,'0');
 }finally{f.dom.window.close();}
});
test('malformed timestamps and out-of-source/out-of-range records never enter projected history',()=>{
 const f=setup();try{
  const r=f.card._trendProject({[ids[0]]:[state(1,time-1),state(2,time),state(3,scope.end/1000),state(4,'bad')],[ids[1]]:[], 'sensor.qa_unselected':[state(99,time)]},scope);
  assert.equal(r.rows.length,1);assert.equal(r.rows[0].bytes,2*2**30);assert.deepEqual(Array.from(r.missing),[ids[1]]);assert.ok(r.invalid>=3);
  assert.throws(()=>f.card._trendProject({[ids[0]]:{}},scope),/invalid_history_shape/);
 }finally{f.dom.window.close();}
});
test('incorrect historical units/classes/negative/blank/nonnumeric stay gaps, never current-unit fallback',()=>{
 const f=setup();try{
  const records=[state(1,time,'%'),state(1,time+1,'GiB','energy'),state(-1,time+2),state('',time+3),state('NaN',time+4),{s:'2',lu:time+5,a:{device_class:'data_size'}}];
  const r=f.card._trendProject({[ids[0]]:records},scope);assert.equal(r.rows.length,6);assert.ok(r.rows.every(row=>row.bytes===null));
  assert.equal(r.invalid,6);
 }finally{f.dom.window.close();}
});
test('capacity changes are actual total-source event dates and missing resets comparisons',()=>{
 const f=setup();try{
  const r=f.card._trendProject({[ids[0]]:[state(1,time+2)],[ids[1]]:[state(100,time),state(200,time+1),state('unknown',time+3),state(300,time+4)]},scope);
  const changes=r.rows.filter(row=>row.capacityChanged);assert.equal(changes.length,1);assert.equal(changes[0].utc,new Date((time+1)*1000).toISOString());assert.equal(changes[0].entityId,ids[1]);
 }finally{f.dom.window.close();}
});
test('all byte units use explicit factors, not mixed percent/currency scales',()=>{
 const f=setup();try{const units={B:1,kB:1000,KB:1000,MB:1e6,GB:1e9,TB:1e12,KiB:1024,MiB:2**20,GiB:2**30,TiB:2**40};
  const r=f.card._trendProject({[ids[0]]:Object.keys(units).map((u,i)=>state(1,time+i,u))},scope);assert.deepEqual(Array.from(r.rows,r=>r.bytes),Object.values(units));
 }finally{f.dom.window.close();}
});
test('source configuration rejects absent, same, unrelated or unconfirmed pair',()=>{
 const f=setup();try{
  assert.equal(f.card._trendConfig().valid,true);
  for(const delta of [{total_entity:ids[0]},{scope:''},{same_filesystem:false},{total_entity:'sensor.qa_absent'}]){f.card.setConfig({...config,measured_history:{...config.measured_history,...delta}});assert.equal(f.card._trendConfig().valid,false);}
  f.hass.states[ids[1]].attributes.device_class='monetary';f.card.setConfig(config);assert.equal(f.card._trendConfig().valid,false);
 }finally{f.dom.window.close();}
});
test('DST formatting uses HA timezone while records retain exact UTC instants',()=>{
 const f=setup();try{const r=f.card._trendProject({[ids[0]]:[state(1,Date.parse('2026-10-25T00:30:00Z')/1000),state(2,Date.parse('2026-10-25T01:30:00Z')/1000)]},scope);
  assert.notEqual(r.rows[0].utc,r.rows[1].utc);assert.match(f.card._trendDate(r.rows[0].time),/02:30/);assert.match(f.card._trendDate(r.rows[1].time),/02:30/);
 }finally{f.dom.window.close();}
});
test('client scan/display limits are partial and never claim server cap or full retention',()=>{
 const f=setup();try{const r=f.card._trendProject({[ids[0]]:Array.from({length:12001},(_,i)=>state(i,time+i))},scope);assert.equal(r.capped,true);assert.equal(r.rows.length,0);
  const p=f.card._trendProject({[ids[0]]:Array.from({length:2500},(_,i)=>state(i,time+i))},scope);assert.equal(p.rows.length,2400);assert.equal(p.capped,true);
 }finally{f.dom.window.close();}
});
test('household access never makes a Recorder request, old admin Core is unsupported',async()=>{
 let calls=0;const f=setup({admin:false,ws:async()=>{calls++;return {};}});try{await f.card._loadStorageHistory();assert.equal(calls,0);assert.equal(f.card._trendState,'denied');assert.match(f.card._renderStorageHistory(),/administrator/i);}finally{f.dom.window.close();}
 const g=setup({version:'2023.12.9'});try{assert.equal(g.card._trendSupportState(),'unsupported');}finally{g.dom.window.close();}
});
test('hass assigned before first mount binds actual ready/disconnected events and reopen rebinds',()=>{
 const f=setup({mounted:false});try{f.card.hass=f.hass;assert.equal(f.listeners.get('ready')?.size||0,0);f.dom.window.document.body.append(f.card);assert.equal(f.listeners.get('ready').size,1);
  f.emit('disconnected');assert.equal(f.card._trendReady,false);assert.equal(f.card._trendSupportState(),'offline');f.emit('ready');assert.equal(f.card._trendReady,true);
  f.card.remove();assert.equal(f.listeners.get('ready').size,0);f.dom.window.document.body.append(f.card);assert.equal(f.listeners.get('ready').size,1);
 }finally{f.dom.window.close();}
});
test('daily requests are coalesced, selected-only, compressed full attributes, explicit 7/30',async()=>{
 const calls=[];const f=setup({ws:async m=>{calls.push(m);return {};}});try{
  const one=f.card._loadStorageHistory(),two=f.card._loadStorageHistory();assert.equal(one,two);await one;assert.equal(calls.length,7);
  for(const m of calls){assert.equal(m.type,'history/history_during_period');assert.deepEqual(Array.from(m.entity_ids),ids);for(const key of ['include_start_time_state','significant_changes_only','minimal_response','no_attributes'])assert.equal(m[key],false);}
  calls.length=0;f.card._trendDays=30;f.card._syncTrendContext();await f.card._loadStorageHistory();assert.equal(calls.length,30);
 }finally{f.dom.window.close();}
});
test('late results after source/role/connection/range/offline/unmount changes are discarded',async()=>{
 for(const change of ['source','role','connection','range','offline','mount']){
  let resolve;const f=setup({ws:()=>new Promise(r=>resolve=r)});try{
   const pending=f.card._loadStorageHistory();await Promise.resolve();
   if(change==='source')f.card.setConfig({...config,measured_history:{...config.measured_history,scope:'other'}});
   if(change==='role')f.card.hass={...f.hass,user:{id:'qa-user',is_admin:false}};
   if(change==='connection')f.card.hass={...f.hass,connection:{...f.connection}};
   if(change==='range'){f.card._trendDays=30;f.card._syncTrendContext();}
   if(change==='offline')f.dom.window.dispatchEvent(new f.dom.window.Event('offline'));
   if(change==='mount')f.card.remove();
   resolve({[ids[0]]:[state(7,Date.now()/1000-1)]});await pending;assert.equal(f.card._trendResult,null,change);assert.equal(f.card._trendStale,false,change);
  }finally{f.dom.window.close();}
 }
});
test('deadline retains occupied wire, ignores late result, ready never automatically retries',async()=>{
 let resolve,calls=0;const f=setup({ws:()=>{calls++;return new Promise(r=>resolve=r);}});try{
  f.card._trendDeadlineMs=1;const p=f.card._loadStorageHistory();await new Promise(r=>setTimeout(r,8));assert.equal(f.card._trendState,'timeout');assert.equal(f.card._loadStorageHistory(),p);assert.equal(calls,1);
  f.emit('ready');assert.equal(calls,1);resolve({[ids[0]]:[state(8,Date.now()/1000-1)]});await p;assert.equal(f.card._trendResult,null);assert.equal(f.card._trendWire,null);
 }finally{f.dom.window.close();}
});
test('role/source change immediately clears rendered private history and stale label',()=>{
 const f=setup();try{f.card._trendResult=f.card._trendProject({[ids[0]]:[state(1,time)]},scope);f.card._trendState='loaded';f.card._activeTab='trend';f.card._render();f.card._doUpdateContent();assert.match(f.card.shadowRoot.textContent,/sensor.qa_used/);
  f.card._trendStale=true;f.card.hass={...f.hass,user:{id:'qa-other',is_admin:false}};assert.equal(f.card._trendResult,null);assert.equal(f.card._trendStale,false);assert.doesNotMatch(f.card.shadowRoot.textContent,/sensor.qa_used|QA filesystem/);
 }finally{f.dom.window.close();}
});
test('Chart/Data use identical bytes with no fabricated paths, 50-row pages and keyboard details',()=>{
 const f=setup();try{f.card._trendResult=f.card._trendProject({[ids[0]]:Array.from({length:53},(_,i)=>state(i,time+i))},scope);f.card._trendState='loaded';f.card._activeTab='trend';f.card._render();f.card._doUpdateContent();
  assert.equal(f.card.shadowRoot.querySelectorAll('path').length,0);assert.equal(f.card.shadowRoot.querySelectorAll('[data-trend-row]').length,53);
  f.card.shadowRoot.querySelector('[data-trend-view="data"]').click();assert.equal(f.card.shadowRoot.querySelectorAll('[data-trend-row]').length,50);assert.match(f.card.shadowRoot.textContent,/0 GiB/);
  f.card.shadowRoot.querySelector('.trend-next-page').click();assert.equal(f.card.shadowRoot.querySelectorAll('[data-trend-row]').length,3);
  f.card._trendSelected=0;f.card._trendView='chart';f.card._paintTrend();f.card.shadowRoot.querySelector('.storage-history').dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(f.card._trendSelected,1);
 }finally{f.dom.window.close();}
});
test('current category Data preserves measured zero, unavailable, units, partial coverage and source',()=>{
 const f=setup();try{const d={categories:[{name:'Backups',size:0,measured:true,partial:false},{name:'Add-ons',size:2,measured:true,partial:true},{name:'System & Other',size:0,measured:false}]};
  const html=f.card._renderCategoryData(d);assert.match(html,/0 B/);assert.match(html,/2097152 B/);assert.match(html,/partial/i);assert.match(html,/Not measured/);assert.match(html,/size_bytes/);assert.match(html,/disk_usage/);
 }finally{f.dom.window.close();}
});
test('editor source selection preserves unknown top-level/nested config and only existing typed sensors',()=>{
 const f=setup();try{const e=f.dom.window.document.createElement('ha-storage-monitor-editor');f.dom.window.document.body.append(e);e.setConfig({...config,extra:{keep:true},measured_history:{...config.measured_history,unknown:'keep'}});e.hass=f.hass;
  const used=e.shadowRoot.querySelector('#cf_used_entity');assert.ok(used);used.value=ids[1];used.dispatchEvent(new f.dom.window.Event('change'));
  assert.equal(e._config.measured_history.unknown,'keep');assert.equal(e._config.extra.keep,true);assert.equal(e._config.measured_history.used_entity,ids[1]);assert.equal(e._config.measured_history.total_entity,ids[1]);
  assert.equal(used.options.length,3);assert.match(e.shadowRoot.textContent,/same filesystem/i);
 }finally{f.dom.window.close();}
});

test('changing any selected source/scope requires a fresh same-filesystem confirmation',()=>{
 const f=setup();try{const e=f.dom.window.document.createElement('ha-storage-monitor-editor');e.setConfig(config);e.hass=f.hass;
  const input=e.shadowRoot.querySelector('#cf_scope');input.value='QA changed';input.dispatchEvent(new f.dom.window.Event('input'));
  assert.equal(e._config.measured_history.same_filesystem,false);assert.equal(e.shadowRoot.querySelector('#cf_same_filesystem').checked,false);
 }finally{f.dom.window.close();}
});
test('offline during detach and online before reopen uses the current browser state',()=>{
 const f=setup();try{f.dom.window.dispatchEvent(new f.dom.window.Event('offline'));assert.equal(f.card._trendOnline,false);f.card.remove();
  Object.defineProperty(f.dom.window.navigator,'onLine',{configurable:true,value:true});f.dom.window.document.body.append(f.card);assert.equal(f.card._trendOnline,true);
 }finally{f.dom.window.close();}
});
test('callWS identity change discards a pending result without additional requests',async()=>{
 let resolve,calls=0;const f=setup({ws:()=>{calls++;return new Promise(r=>resolve=r);}});try{
  const p=f.card._loadStorageHistory();await Promise.resolve();f.card.hass={...f.hass,callWS:async()=>({})};resolve({[ids[0]]:[state(1,Date.now()/1000-1)]});await p;
  assert.equal(calls,1);assert.equal(f.card._trendResult,null);
 }finally{f.dom.window.close();}
});
test('Polish rendering escapes source scope and state and reports retention unknown after reads',()=>{
 const f=setup();try{f.card._lang='pl';f.card._config.measured_history.scope='<img src=x onerror=1>';f.card._trendResult=f.card._trendProject({[ids[0]]:[state('<script>private</script>',time)]},scope);f.card._trendState='partial';
  const html=f.card._renderStorageHistory();assert.match(html,/Wykres/);assert.match(html,/Dane/);assert.match(html,/retencja nieznane/);assert.doesNotMatch(html,/<img|<script>/);
 }finally{f.dom.window.close();}
});
test('unexpected server errors never expose raw message, body or invented permission labels',async()=>{
 const f=setup({ws:async()=>{throw {code:'private_custom',message:'QA private detail'};}});try{await f.card._loadStorageHistory();assert.equal(f.card._trendState,'error');assert.doesNotMatch(f.card._renderStorageHistory(),/QA private detail|private_custom/);
 }finally{f.dom.window.close();}
});

test('editor role downgrade immediately removes private source configuration and offers an explanation',()=>{
 const f=setup();try{const e=f.dom.window.document.createElement('ha-storage-monitor-editor');e.setConfig(config);e.hass=f.hass;assert.match(e.shadowRoot.textContent,/sensor.qa_used/);
  e.hass={...f.hass,user:{id:'qa-user',is_admin:false}};assert.doesNotMatch(e.shadowRoot.textContent,/sensor.qa_used|QA filesystem/);assert.equal(e.shadowRoot.querySelector('#cf_used_entity'),null);assert.match(e.shadowRoot.textContent,/administrator/i);
  assert.equal(e._config.measured_history.used_entity,ids[0]);
 }finally{f.dom.window.close();}
});
test('missing measurements occupy a distinct gap lane, outside the numeric value axis',()=>{
 const f=setup();try{const r=f.card._trendProject({[ids[0]]:[state('unknown',time),state(0,time+1)]},scope);const doc=new JSDOM(f.card._renderTrendChart(r));
  assert.equal(doc.window.document.querySelector('[data-trend-row="0"]').style.top,'120%');assert.equal(doc.window.document.querySelector('[data-trend-row="1"]').style.top,'100%');assert.match(doc.window.document.querySelector('.trend-gap-label').textContent,/missing/i);doc.window.close();
 }finally{f.dom.window.close();}
});

test('current category Chart/Data both label binary-scaled byte measurements with correct IEC units',()=>{
 const f=setup();try{const d={diskTotal:10,diskUsed:2,diskFree:8,usedPercent:20,hostname:'QA',osVersion:'QA',categories:[{name:'Backups',size:2,measured:true,color:'#555'}]};
  const chart=f.card._renderOverview(d),data=f.card._renderCategoryData(d);assert.match(chart,/2\.0 MiB/);assert.match(data,/2\.0 MiB/);assert.match(data,/2097152 B/);assert.doesNotMatch(chart,/2\.0 MB/);
 }finally{f.dom.window.close();}
});

test('small positive byte values never render as measured zero GiB',()=>{
 const f=setup();try{assert.notEqual(f.card._trendValue({bytes:1}),f.card._trendValue({bytes:0}));assert.match(f.card._trendValue({bytes:1}),/GiB/);}
 finally{f.dom.window.close();}
});
test('server access denial is distinct from household role and admin can explicitly retry',async()=>{
 const f=setup({ws:async()=>{throw {code:'unauthorized',message:'QA hidden'};}});try{await f.card._loadStorageHistory();assert.equal(f.card._trendState,'access_denied');assert.equal(f.card._trendResult,null);
  const doc=new JSDOM(f.card._renderStorageHistory());assert.match(doc.window.document.body.textContent,/Home Assistant denied/);assert.equal(doc.window.document.querySelector('.trend-load').disabled,false);assert.doesNotMatch(doc.window.document.body.textContent,/QA hidden/);doc.window.close();
 }finally{f.dom.window.close();}
});

// Owner regressions: native Chrome retained private history for inactive admin.
test('inactive admin immediately clears history and cannot request or configure sources',async()=>{
 const f=setup();try{f.card._trendResult=f.card._trendProject({[ids[0]]:[state(1,time)]},scope);f.card._activeTab='trend';f.card._render();f.card._doUpdateContent();
  let calls=0;f.card.hass={...f.hass,user:{...f.hass.user,is_active:false},callWS:async()=>{calls++;return {};}};
  assert.equal(f.card._trendResult,null);await f.card._loadStorageHistory();assert.equal(calls,0);assert.doesNotMatch(f.card.shadowRoot.textContent,/sensor.qa_used|QA filesystem/);
  const e=f.dom.window.document.createElement('ha-storage-monitor-editor');e.setConfig(config);e.hass=f.card._hass;assert.equal(e.shadowRoot.querySelector('#cf_used_entity'),null);
 }finally{f.dom.window.close();}
});
test('group change cancels pending history and clears a previous result without new reads',async()=>{
 let resolve,calls=0;const f=setup({ws:()=>{calls++;return new Promise(r=>resolve=r);}});try{
  f.hass.user.group_ids=['qa-a'];f.card._syncTrendContext();f.card._trendResult=f.card._trendProject({[ids[0]]:[state(1,time)]},scope);
  const p=f.card._loadStorageHistory();await Promise.resolve();f.card.hass={...f.hass,user:{...f.hass.user,group_ids:['qa-b']}};assert.equal(f.card._trendResult,null);
  resolve({});await p;assert.equal(calls,1);assert.equal(f.card._trendResult,null);
 }finally{f.dom.window.close();}
});
test('Core support rejects malformed dates and prerelease below the supported stable floor',()=>{
 const f=setup();try{for(const version of ['2026.99.1','2026.0.1','2026.5.bad','2024.1.0b1','2026.5.0garbage']){
  f.card.hass={...f.hass,config:{...f.hass.config,version}};assert.equal(f.card._trendSupportState(),'unsupported',version);
 }f.card.hass={...f.hass,config:{...f.hass.config,version:'2026.5.0'}};assert.equal(f.card._trendSupportState(),null);
 }finally{f.dom.window.close();}
});

test('End/Home retain keyboard focus when stepping control becomes disabled',()=>{
 const f=setup();try{f.card._trendResult=f.card._trendProject({[ids[0]]:Array.from({length:53},(_,i)=>state(i,time+i))},scope);f.card._trendState='loaded';f.card._trendView='data';f.card._trendSelected=0;f.card._activeTab='trend';f.card._render();f.card._doUpdateContent();
  let b=f.card.shadowRoot.querySelector('.trend-next-record');b.focus();b.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal(f.card.shadowRoot.activeElement?.dataset.trendRow,'52');
  b=f.card.shadowRoot.querySelector('.trend-prev-record');b.focus();b.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(f.card.shadowRoot.activeElement?.dataset.trendRow,'0');
 }finally{f.dom.window.close();}
});

for (const field of ['instance_id','internal_url','external_url','location_name']) {
 test(`changing ${field} clears recorded history without a new request`,()=>{
  const f=setup();try{
   f.hass.config[field]='instance-A';f.card.hass=f.hass;f.card._activeTab='trend';
   f.card._trendResult=f.card._trendProject({[ids[0]]:[state(1,time)]},scope);f.card._trendState='loaded';f.card._render();f.card._doUpdateContent();
   assert.ok(f.card.shadowRoot.querySelector('[data-trend-row]'));
   f.card.hass={...f.hass,config:{...f.hass.config,[field]:'instance-B'}};f.card._doUpdateContent();
   assert.equal(f.card._trendResult,null);assert.equal(f.card._trendStale,false);assert.equal(f.card.shadowRoot.querySelector('[data-trend-row]'),null);
  }finally{f.dom.window.close();}
 });
 test(`pending Recorder reply from old ${field} is discarded`,async()=>{
  let resolve,calls=0;const f=setup({ws:()=>{calls++;return calls===1?new Promise(r=>resolve=r):Promise.resolve({});}});try{
   f.hass.config[field]='instance-A';f.card.hass=f.hass;
   const pending=f.card._loadStorageHistory();await Promise.resolve();
   f.card.hass={...f.hass,config:{...f.hass.config,[field]:'instance-B'}};
   resolve({[ids[0]]:[state(7,Date.now()/1000-1)]});await pending;
   assert.equal(f.card._trendResult,null);assert.equal(f.card._trendStale,false);assert.equal(calls,1);assert.equal(f.card._trendWire,null);
  }finally{resolve?.({});f.dom.window.close();}
 });
}


// NH-4 history and variants proposal. Source specifications only; NOT RUN.
function pairedRecords(values, {capacity=100, usedUnit='GB', totalUnit='GB', times}={}) {
 const instants=times||values.map((_,i)=>time+60*(i+1));
 return {
  [ids[0]]:values.map((value,i)=>state(value,instants[i],usedUnit)),
  [ids[1]]:values.map((_,i)=>state(Array.isArray(capacity)?capacity[i]:capacity,instants[i],totalUnit))
 };
}
for(const count of [1,2,3])test('measured comparison requires three pairs: '+count,()=>{
 const f=setup();try{
  const r=f.card._trendProject(pairedRecords(Array.from({length:count},(_,i)=>i)),scope);
  const c=f.card._trendComparison(r);
  assert.equal(c.available,count>=3);
  if(c.available){assert.equal(c.deltaBytes,2e9);assert.equal(c.count,3);assert.equal(c.period,'available_fragment');assert.equal(c.coverage,'unknown');}
 }finally{f.dom.window.close();}
});
for(const values of [[0,0,0],[3,2,1],[0,1,2]])test('comparison distinguishes measured zero and signed change '+values,()=>{
 const f=setup();try{
  const c=f.card._trendComparison(f.card._trendProject(pairedRecords(values),scope));
  assert.equal(c.available,true);assert.equal(c.deltaBytes,(values.at(-1)-values[0])*1e9);
 }finally{f.dom.window.close();}
});
test('mixed GB/GiB uses exact bytes, with stable units within each source',()=>{
 const f=setup();try{
  const c=f.card._trendComparison(f.card._trendProject(pairedRecords([0,1,2],{capacity:100,usedUnit:'GB',totalUnit:'GiB'}),scope));
  assert.equal(c.available,true);assert.equal(c.deltaBytes,2e9);assert.equal(c.capacityBytes,100*2**30);
 }finally{f.dom.window.close();}
});
for(const missing of ['unknown','unavailable'])test(missing+' breaks both the displayed evidence and comparison sequence',()=>{
 const f=setup();try{
  const raw=pairedRecords([0,1,2,missing,4,5]);
  let r=f.card._trendProject(raw,scope);assert.equal(f.card._trendComparison(r).available,false);
  assert.ok(r.rows.some(row=>row.bytes===null&&row.state===missing));
  raw[ids[0]].push(state(6,time+420,'GB'));raw[ids[1]].push(state(100,time+420,'GB'));
  r=f.card._trendProject(raw,scope);const c=f.card._trendComparison(r);
  assert.equal(c.available,true);assert.equal(c.count,3);assert.equal(c.deltaBytes,2e9);
  assert.equal(c.first.time,(time+300)*1000);
 }finally{f.dom.window.close();}
});
test('changed capacity starts a new comparable segment and is marked at its real time',()=>{
 const f=setup();try{
  const raw=pairedRecords([0,1,2,3,4],{capacity:[100,100,100,200,200]});
  let r=f.card._trendProject(raw,scope);assert.equal(f.card._trendComparison(r).available,false);
  assert.deepEqual(Array.from(r.rows.filter(row=>row.capacityChanged),row=>row.time),[(time+240)*1000]);
  raw[ids[0]].push(state(5,time+360,'GB'));raw[ids[1]].push(state(200,time+360,'GB'));
  r=f.card._trendProject(raw,scope);const c=f.card._trendComparison(r);
  assert.equal(c.available,true);assert.equal(c.count,3);assert.equal(c.capacityBytes,200e9);assert.equal(c.deltaBytes,2e9);
 }finally{f.dom.window.close();}
});
for(const mutation of ['units','metadata','scope','entity'])test('comparison rejects crossing '+mutation,()=>{
 const f=setup();try{
  const raw=pairedRecords([0,1,2]);
  if(mutation==='units')raw[ids[0]][2].a.unit_of_measurement='GiB';
  if(mutation==='metadata')raw[ids[0]][2].a.mount_point='/different-filesystem';
  const r=f.card._trendProject(raw,scope);
  if(mutation==='scope')f.card._config={...config,measured_history:{...config.measured_history,scope:'Other disk'}};
  if(mutation==='entity')f.card._config={...config,measured_history:{...config.measured_history,used_entity:'sensor.other'}};
  assert.equal(f.card._trendComparison(r).available,false);
  if(mutation==='metadata')assert.ok(r.rows.some(row=>row.sourceChanged));
 }finally{f.dom.window.close();}
});
test('asynchronous capacity is never carried forward to pair used measurements',()=>{
 const f=setup();try{
  const raw=pairedRecords([0,1,2]);
  raw[ids[1]]=raw[ids[1]].map(row=>({...row,lu:row.lu+1}));
  const r=f.card._trendProject(raw,scope);
  assert.equal(f.card._trendComparison(r).available,false);
  assert.equal(r.rows.length,6);
 }finally{f.dom.window.close();}
});
test('sub-millisecond timestamp differences do not become simultaneous pairs by rounding',()=>{
 const f=setup();try{
  const raw=pairedRecords([0,1,2]);
  raw[ids[0]]=raw[ids[0]].map(row=>({...row,lu:row.lu+0.0001}));
  raw[ids[1]]=raw[ids[1]].map(row=>({...row,lu:row.lu+0.0004}));
  assert.equal(f.card._trendComparison(f.card._trendProject(raw,scope)).available,false);
 }finally{f.dom.window.close();}
});
for(const mutation of ['reversed','duplicate-time','malformed'])test('ambiguous ordering cannot yield a delta: '+mutation,()=>{
 const f=setup();try{
  const raw=pairedRecords([0,1,2]);
  if(mutation==='reversed')raw[ids[0]].reverse();
  if(mutation==='duplicate-time')raw[ids[0]].push(state(99,time+180,'GB'));
  if(mutation==='malformed')raw[ids[0]].push(state(3,'invalid','GB'));
  const r=f.card._trendProject(raw,scope);assert.equal(f.card._trendComparison(r).available,false);
  assert.equal(r.rows.filter(row=>row.kind==='total').length,3);
 }finally{f.dom.window.close();}
});
test('Recorder projection has points and unknown intervals at every gap including range edges',()=>{
 const f=setup();try{
  const r=f.card._trendProject(pairedRecords([0,1,2],{times:[time+60,time+3600,time+86400]}),scope);
  assert.equal(r.continuity,'unknown');assert.equal(r.coverage,'unknown');
  for(const series of r.series){
   assert.equal(series.segments.length,3);assert.ok(series.segments.every(segment=>segment.points.length===1));
   assert.equal(series.gaps[0].from,scope.start);assert.equal(series.gaps.at(-1).to,scope.end);
   assert.ok(series.gaps.every(gap=>gap.to>gap.from));
  }
  const doc=new JSDOM(f.card._renderTrendChart(r));
  assert.equal(doc.window.document.querySelectorAll('[data-trend-row]').length,6);
  assert.equal(doc.window.document.querySelectorAll('path').length,0);
  assert.ok(doc.window.document.querySelectorAll('.trend-unknown').length>=8);
  assert.equal(doc.window.document.querySelectorAll('[data-trend-series]').length,2);
  doc.window.close();
  // End-point change remains observable even though continuity is unknown.
  assert.equal(f.card._trendComparison(r).available,true);
 }finally{f.dom.window.close();}
});
test('step renderer requires an explicit producer interval contract and never extrapolates',()=>{
 const f=setup();try{
  const rows=f.card._trendProject(pairedRecords([1,2,3]),scope).rows.filter(row=>row.kind==='used')
    .map(row=>({...row,capacityBytes:100e9}));
  const intervals=rows.slice(1).map((row,i)=>({from:rows[i].time,to:row.time,confirmed:true}));
  const segment={continuity:'confirmed_measurements',points:rows,intervals};
  const x=row=>(row.time-scope.start)/1000,y=row=>row.bytes/1e9;
  assert.equal(f.card._trendStepPath(segment,x,y),'M 60 1 H 120 V 2 H 180 V 3');
  assert.equal(f.card._trendStepPath({...segment,continuity:'unknown'},x,y),'');
  assert.equal(f.card._trendStepPath({...segment,intervals:[]},x,y),'');
  assert.equal(f.card._trendStepPath({...segment,points:rows.map((r,i)=>i===1?{...r,breakBefore:true}:r)},x,y),'');
  assert.equal(f.card._trendStepPath({...segment,points:rows.map((r,i)=>i===2?{...r,capacityBytes:200e9}:r)},x,y),'');
  assert.equal(f.card._trendStepPath({...segment,points:rows.map((r,i)=>i===1?{...r,bytes:null}:r)},x,y),'');
 }finally{f.dom.window.close();}
});
for(const days of [7,30])test('a shorter available fragment is not labelled a complete '+days+' day measurement',()=>{
 const f=setup();try{
  f.card._trendDays=days;
  const r=f.card._trendProject(pairedRecords([0,1,2]),scope);
  const doc=new JSDOM(f.card._renderTrendComparison(r));
  assert.equal(doc.window.document.querySelector('[data-comparison]').dataset.comparison,'available-fragment');
  assert.match(doc.window.document.body.textContent,/not a complete measurement/);
  assert.equal(doc.window.document.querySelectorAll('time').length,2);
  assert.equal(doc.window.document.querySelector('time').dateTime,new Date((time+60)*1000).toISOString());
  assert.match(doc.window.document.body.textContent,/2000000000 B/);
  doc.window.close();
 }finally{f.dom.window.close();}
});
test('history accepts a newer Core beta without treating the minimum prerelease as stable',()=>{
 const f=setup({version:'2026.10.0b2'}),g=setup({version:'2024.1.0b1'});
 try{assert.equal(f.card._trendSupportState(),null);assert.equal(g.card._trendSupportState(),'unsupported');}
 finally{f.dom.window.close();g.dom.window.close();}
});
test('measurement details keep exact time, original units, raw bytes and an open disclosure while selecting',()=>{
 const f=setup();try{
  f.card._trendResult=f.card._trendProject(pairedRecords([0,1,2]),scope);
  f.card._trendSelected=0;f.card._activeTab='trend';f.card._render();f.card._doUpdateContent();
  const details=f.card.shadowRoot.querySelector('[data-storage-details="measurement"]');details.open=true;
  f.card.shadowRoot.querySelector('.trend-next-record').click();
  const current=f.card.shadowRoot.querySelector('[data-storage-details="measurement"]');
  assert.equal(current.open,true);assert.match(current.textContent,/GB/);assert.match(current.textContent,/\d+ B/);
  assert.match(current.textContent,/2026-10-24T/);
 }finally{f.dom.window.close();}
});

test('attribute-only Recorder writes do not manufacture the third measured pair',()=>{
 const f=setup();try{
  const raw=pairedRecords([0,1,1]);
  for(const id of ids)raw[id][2].lc=raw[id][1].lu;
  const r=f.card._trendProject(raw,scope);assert.equal(f.card._trendComparison(r).available,false);
  assert.equal(r.rows.filter(row=>row.attributeOnly).length,2);
  assert.ok(r.rows.filter(row=>row.attributeOnly).every(row=>row.bytes!==null));
  const page=new JSDOM(f.card._renderTrendChart(r));assert.match(page.window.document.body.textContent,/Attribute update/);
  assert.equal(Array.from(page.window.document.querySelectorAll('[data-trend-row]')).filter(node=>node.textContent==='◇').length,2);
  page.window.close();
 }finally{f.dom.window.close();}
});
test('an explicit future or malformed last_changed timestamp prevents comparison',()=>{
 const f=setup();try{
  for(const lc of [time+1000,'bad']){
   const raw=pairedRecords([0,1,2]);raw[ids[0]][1].lc=lc;
   const r=f.card._trendProject(raw,scope);assert.ok(r.invalid>0);assert.equal(f.card._trendComparison(r).available,false);
  }
 }finally{f.dom.window.close();}
});

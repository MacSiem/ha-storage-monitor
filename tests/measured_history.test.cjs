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
 const hass={language:'en',user:{id:'qa-user',is_admin:admin},connection,config:{version,components:['history','recorder'],time_zone:'Europe/Warsaw'},states:Object.fromEntries(ids.map(id=>[id,{state:'10',attributes:{device_class:'data_size',unit_of_measurement:'GiB'}}])),callWS:ws};
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
  const html=f.card._renderCategoryData(d);assert.match(html,/0 B/);assert.match(html,/2097152 B/);assert.match(html,/partial/i);assert.match(html,/N\/A/);assert.match(html,/size_bytes/);assert.match(html,/disk_usage/);
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

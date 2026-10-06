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

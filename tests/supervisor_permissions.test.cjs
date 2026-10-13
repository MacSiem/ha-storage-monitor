const assert=require('node:assert/strict');
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {JSDOM}=require('jsdom');
function panel(language,errorCode){
 const dom=new JSDOM('',{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
 dom.window.eval(readFileSync(join(__dirname,'..','ha-storage-monitor.js'),'utf8'));
 const card=dom.window.document.createElement('ha-storage-monitor');card._lang=language;
 card._hass={user:{id:'qa-admin',is_admin:true},callWS:async()=>{throw {code:errorCode};}};
 card._updateContent=()=>{};card._render();return {dom,card};
}
for(const language of ['en','pl']){
 test(`Supervisor permission denial explains administrator access in ${language}`,async()=>{
  const {dom,card}=panel(language,'unauthorized');
  try {
   await card._loadStorageData();card._doUpdateContent();
   const text=card.shadowRoot.getElementById('content').textContent;
   assert.match(text,/administrator/i);
   assert.doesNotMatch(text,/Install HA OS|Zainstaluj HA OS/);
  }finally{dom.window.close();}
 });
}
test('missing Supervisor still explains installation requirement',async()=>{
 const {dom,card}=panel('en','unknown_command');
 try {
  await card._loadStorageData();card._doUpdateContent();
  assert.match(card.shadowRoot.getElementById('content').textContent,/Requires Home Assistant OS.*Install HA OS/s);
 }finally{dom.window.close();}
});

for(const language of ['en','pl'])for(const [errorCode,result] of [['unauthorized','error'],['unknown_command','no_data'],['QA_RAW_UNKNOWN','error']])test(`main Supervisor ${errorCode} has ${result} in ${language}`,async()=>{
 const {dom,card}=panel(language,errorCode);try{
  await card._loadStorageData();card._doUpdateContent();
  const badge=card.shadowRoot.querySelector('[data-storage-result] [data-result-state]');assert.ok(badge);assert.equal(badge.dataset.resultState,result);
  assert.doesNotMatch(card.shadowRoot.textContent,/QA_RAW_UNKNOWN/);
 }finally{dom.window.close();}
});

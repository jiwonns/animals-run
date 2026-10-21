const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
if (!process.env.ARENA_TEST_TOOLS) throw new Error('Set ARENA_TEST_TOOLS to temporary node_modules with playwright');
const { chromium } = require(path.join(process.env.ARENA_TEST_TOOLS,'playwright'));
const loaded = { exports: {} };
new Function('exports','module',ts.transpileModule(fs.readFileSync('src/components/walk-map-html.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(loaded.exports,loaded);
(async()=>{
  const [js,css]=await Promise.all(['https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'].map(async url=>{const r=await fetch(url);assert.ok(r.ok);return r.text();}));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    for(const native of [false,true]) {
      const page=await browser.newPage({viewport:{width:390,height:700}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
      const bridge=`<script>window.selected=[];${native?`window.ReactNativeWebView={postMessage(v){if(v.startsWith('{'))window.selected.push(JSON.parse(v));}};`:`window.addEventListener('message',e=>{if(e.data?.type==='walk-map:player')window.selected.push(e.data);});`}</script>`;
      const html=loaded.exports.mapHtml('#FF5A1F').replace('<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>',`<script>${js}</script>${bridge}`).replace('<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">',`<style>${css}</style>`);
      await page.setContent(html);
      await page.evaluate(()=>window.app.setPlayers([{id:'self',name:'나',avatar:null,me:true,lat:37.5665,lng:126.978},{id:'friend',name:'친구',avatar:null,me:false,lat:37.5673,lng:126.979}]));
      await page.locator('.me .face').click();await page.waitForFunction(()=>window.selected.some(m=>m.uid==='self'));
      await page.locator('.pin:not(.me) .face').click();await page.waitForFunction(()=>window.selected.some(m=>m.uid==='friend'));
      await page.evaluate(()=>{window.selected=[];window.app.setPlayers([{id:'self',name:'새 닉네임',avatar:'cat',me:true,lat:37.5666,lng:126.978}]);window.app.setFace('cat','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==');});
      await page.locator('.me .face').click();await page.waitForFunction(()=>window.selected.some(m=>m.uid==='self'));
      assert.deepEqual(errors,[]);
      console.log(`PASS real Leaflet ${native?'native bridge':'web bridge'}: self and friend taps, moved self, updated avatar/name`);
      await page.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

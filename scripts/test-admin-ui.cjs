const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),tools=path.join(root,'.expo/admin-ui-tools/node_modules');
const esbuild=require(path.join(tools,'esbuild')),{chromium}=require(path.join(tools,'playwright'));
const stubs={
 'expo-router':`export const Stack={Screen:()=>null};`,
 '@/hooks/use-colors':`export const useColors=()=>({background:'#fffaf5',surface:'#ffffff',border:'#ddd',text:'#222',secondary:'#666',primary:'#ed701e'});`,
 '@/providers/session-provider':`export const useSession=()=>({user:{uid:'admin'}});`,
 '@/providers/catalog-provider':`export const useCatalog=()=>({version:6,refresh:async()=>{}});`,
 '@/lib/admin-catalog':`export const useAdministrator=()=>({allowed:true,loading:false});export const uploadGachaImage=async()=>({uri:'https://example.com/image.png'});`,
 '@/lib/remote-catalog':`import seed from '${path.join(root,'shared/gacha/seed-catalog.json').replace(/\\/g,'/')}';import {validateCatalog,assertCompatible} from '${path.join(root,'shared/gacha/catalog.js').replace(/\\/g,'/')}';let live=structuredClone(seed);live.version=6;window.__saved=[];export const currentCatalog=()=>structuredClone(live);export const loadRemoteCatalog=async()=>structuredClone(live);export const publishCatalog=async(candidate)=>{validateCatalog(candidate);assertCompatible(live,candidate);if(candidate.version!==live.version)throw Error('버전 충돌');live=structuredClone({...candidate,version:live.version+1});window.__saved.push(structuredClone(live));return live.version;};`,
 '@/components/gacha-image':`import * as React from 'react';import {View} from 'react-native-web';export const Image=({style})=><View style={[style,{backgroundColor:'#f2e7d9'}]}/>;`,
 'react-native-safe-area-context':`export {View as SafeAreaView} from 'react-native-web';`,
};
(async()=>{
 const result=await esbuild.build({stdin:{contents:`import * as React from 'react';import {createRoot} from 'react-dom/client';import Admin from '@/app/admin';createRoot(document.getElementById('root')).render(<Admin/>);`,resolveDir:root,loader:'tsx'},absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',alias:{'react-native':'react-native-web'},define:{'process.env.NODE_ENV':'"production"',__DEV__:'false',global:'globalThis'},plugins:[{name:'mock-account',setup(build){build.onResolve({filter:/.*/},args=>args.path in stubs?{path:args.path,namespace:'mock'}:undefined);build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:stubs[args.path],loader:'tsx',resolveDir:root}));}}]});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html; charset=utf-8');res.end(req.url==='/app.js'?result.outputFiles[0].text:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}#root{display:flex}*{box-sizing:border-box}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'새 뽑기 만들기',exact:true}).waitFor();
  assert.equal(await page.getByText('컬렉션 선택',{exact:true}).count(),0);
  await page.getByRole('button',{name:'새 뽑기 만들기',exact:true}).click();
  await page.getByLabel('뽑기 이름',{exact:true}).fill('내 테스트 뽑기');
  await page.getByRole('checkbox',{name:'쥐',exact:true}).click();await page.getByRole('checkbox',{name:'소',exact:true}).click();
  await page.getByRole('button',{name:'레어',exact:true}).click();await page.getByLabel('동물 이름 검색',{exact:true}).fill('햄스터');
  await page.getByRole('checkbox',{name:'햄스터',exact:true}).click();
  await page.getByLabel('노말 확률 (%)',{exact:true}).fill('75');await page.getByLabel('레어 확률 (%)',{exact:true}).fill('25');
  await page.getByRole('button',{name:'저장하고 적용',exact:true}).click();await page.getByText('저장 완료 · 선택한 동물과 확률이 뽑기에 적용됐어요.',{exact:true}).waitFor();
  let saved=await page.evaluate(()=>window.__saved.at(-1));assert.equal(saved.banners[0].title,'내 테스트 뽑기');assert.deepEqual(saved.banners[0].characterIds,['mouse','cow','premium_mouse']);
  await page.getByRole('button',{name:'새 동물 등록',exact:true}).click();await page.getByRole('button',{name:'에픽',exact:true}).last().click();
  await page.getByLabel('새 동물 이름',{exact:true}).fill('새로운 여우');await page.getByLabel('이미지 주소 (선택)',{exact:true}).fill('https://example.com/fox.png');
  await page.getByRole('button',{name:'동물 저장',exact:true}).click();await page.getByRole('checkbox',{name:'새로운 여우',exact:true}).waitFor();
  saved=await page.evaluate(()=>window.__saved.at(-1));const animal=saved.collections.flatMap(c=>c.characters.map(ch=>({...ch,grade:c.grade}))).find(ch=>ch.name==='새로운 여우');assert.equal(animal.grade,'EP');assert.ok(!saved.banners[0].characterIds.includes(animal.id),'registration saves the server animal without prematurely publishing pending draw edits');
  await page.getByRole('button',{name:'저장하고 적용',exact:true}).click();await page.getByText('저장 완료 · 선택한 동물과 확률이 뽑기에 적용됐어요.',{exact:true}).waitFor();
  saved=await page.evaluate(()=>window.__saved.at(-1));assert.ok(saved.banners[0].characterIds.includes(animal.id));
  await page.getByRole('button',{name:'설정 접기',exact:true}).click();
  const lockedName=require('../shared/gacha/seed-catalog.json').collections.find(c=>c.grade==='L'&&c.acquisition==='evolution').characters[0].name;
  await page.getByRole('button',{name:'레전더리',exact:true}).click();await page.getByLabel('동물 이름 검색',{exact:true}).fill(lockedName);
  const locked=page.getByRole('checkbox',{name:lockedName,exact:true});await locked.waitFor();assert.equal(await locked.getAttribute('aria-disabled'),'true');
  await page.setViewportSize({width:320,height:740});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px horizontal overflow');
  fs.mkdirSync(path.join(root,'.test-artifacts'),{recursive:true});await page.screenshot({path:path.join(root,'.test-artifacts/admin-grades.png'),fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS 390px/320px admin: create draw, pick server animals by grade, edit odds, register/save animal, publish selection, no collection controls or runtime errors');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

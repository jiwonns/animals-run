const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http');
const tools=process.env.ARENA_TEST_TOOLS;
if(!tools)throw new Error('Set ARENA_TEST_TOOLS to temporary node_modules with esbuild/playwright');
const esbuild=require(path.join(tools,'esbuild')),{chromium}=require(path.join(tools,'playwright'));
const root=path.resolve(__dirname,'..');
const stubs={
 'react-native':`export {Alert,AppState,Platform} from 'react-native-web';export const PermissionsAndroid={};`,
 '@react-native-async-storage/async-storage':`export default {getItem:async k=>localStorage.getItem(k),setItem:async(k,v)=>localStorage.setItem(k,v),removeItem:async k=>localStorage.removeItem(k)};`,
 'expo-location':`export const Accuracy={High:4};export async function getForegroundPermissionsAsync(){throw Error('Native location API called on web');}export async function requestForegroundPermissionsAsync(){throw Error('Native location API called on web');}export async function getLastKnownPositionAsync(){throw Error('Native location API called on web');}export async function watchPositionAsync(){throw Error('Native location API called on web');}`,
 'expo-sensors':`export const Pedometer={};`,
 'firebase/firestore':`export const onSnapshot=()=>()=>{};`,
 '@/lib/map-sharing':`export const initializeMapSharing=()=>{},mapPreferencesRef=()=>{},saveMapSharing=()=>{};`,
 '@/lib/walk':`export const shareLocation=()=>Promise.resolve();`,
 '@/lib/step-progress':`export const creditStepProgress=()=>{},newStepEpoch=()=>'',stepDeviceId=()=>'';`,
 '../../modules/step-counter':`export const StepCounter=undefined;`,
 '@/providers/session-provider':`export const useSession=()=>({loading:false});`,
};
(async()=>{
 const bundle=await esbuild.build({stdin:{contents:`import * as React from 'react';import {createRoot} from 'react-dom/client';import {WalkProvider,useWalk} from '@/providers/walk-provider';function Probe(){const w=useWalk();return <><div id="status">{w.location}</div><div id="position">{w.position?JSON.stringify(w.position):'none'}</div><button onClick={()=>w.requestLocation()}>위치 허용</button></>;}createRoot(document.getElementById('root')).render(<WalkProvider><Probe/></WalkProvider>);`,resolveDir:root,loader:'tsx'},absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"',__DEV__:'false',global:'globalThis'},plugins:[{name:'isolated-location',setup(build){build.onResolve({filter:/.*/},args=>args.path in stubs?{path:args.path,namespace:'mock'}:undefined);build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:stubs[args.path],loader:'tsx',resolveDir:root}));}}]});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html; charset=utf-8');res.end(req.url==='/app.js'?bundle.outputFiles[0].text:'<!doctype html><div id="root"></div><script src="/app.js"></script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const context=await browser.newContext({permissions:['geolocation'],geolocation:{latitude:35.1796,longitude:129.0756}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='ready'&&JSON.parse(document.querySelector('#position').textContent).lat===35.1796);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('walk:lastPosition')).lng),129.0756);
  await context.setGeolocation({latitude:37.5665,longitude:126.978});await page.waitForFunction(()=>JSON.parse(document.querySelector('#position').textContent).lat===37.5665);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='ready'&&JSON.parse(document.querySelector('#position').textContent).lng===126.978);
  await context.clearPermissions();await page.reload();await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='denied');
  await context.grantPermissions(['geolocation']);await page.getByRole('button',{name:'위치 허용'}).click();await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='ready');
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS browser location: saved permission, current location, moving updates, recent position cache, denied/prompt state, permission button recovery, no native API or runtime errors');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

// Isolated browser presentation test: real screen and combat engine, mocked account/network.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const toolsPath = process.env.ARENA_TEST_TOOLS;
if (!toolsPath) throw new Error('Set ARENA_TEST_TOOLS to a temporary node_modules directory containing esbuild and playwright');
const esbuild = require(path.join(toolsPath,'esbuild'));
const { chromium } = require(path.join(toolsPath,'playwright'));
const root = path.resolve(__dirname,'..');
const stateModule = `
import * as React from 'react';
import { CHARACTERS, CHARACTER_BY_ID } from '@/constants/characters';
import { duelStart, duelStep, aiMove } from '@/lib/duel';
export const player = CHARACTERS.find(c=>c.grade==='L');
const rival = CHARACTERS.find(c=>c.grade==='U');
export const profile={username:'preview',nickname:'테스터',avatar:player.id,characters:{[player.id]:1,[rival.id]:1},coins:100};
let data={duels:[],previous:{},wallet:null,loading:false,failed:false}; const subscribers=new Set();
function update(next){data={...data,...next};subscribers.forEach(fn=>fn());}
export const useDuels=()=>React.useSyncExternalStore(fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);},()=>data);
export async function createDuel(uid,ch,difficulty,target){const id='test-match';const d={id,owner:uid,recipient:target||uid,members:target?[uid,target]:[uid],mode:target?'friend':'solo',playerId:ch,rivalId:rival.id,difficulty,status:target?'pending':'active',state:duelStart(CHARACTER_BY_ID[ch].grade,rival.grade),lastMove:null,claimed:[]};update({duels:[d]});return id;}
export async function makeDuelMove(uid,id,move){const d=data.duels.find(d=>d.id===id);if(d.status!=='active')throw new Error('종료');const selected=d.mode==='solo'&&d.state.turn%2?aiMove(d.state,d.difficulty):move;const next=duelStep(d.state,selected,CHARACTER_BY_ID[d.playerId].grade,CHARACTER_BY_ID[d.rivalId].grade);update({previous:{[id]:d.state},duels:[{...d,state:next,status:next.winner==='none'?'active':'finished',lastMove:selected}]});}
export async function claimDuelReward(uid,id){update({duels:data.duels.map(d=>({...d,claimed:[uid]}))});return 6;}
export async function cancelDuel(){update({duels:data.duels.map(d=>({...d,status:'cancelled'}))});}
export async function acceptDuel(){update({duels:data.duels.map(d=>({...d,status:'active'}))});}
`;
const stubs = {
  '@/providers/session-provider': `import {profile} from 'test:state';export const useSession=()=>({user:{uid:'test-user'},profile});`,
  '@/providers/catalog-provider': 'export const useCatalog=()=>({version:1});',
  '@/providers/friends-provider': `export const useFriends=()=>({friends:[],failed:false});`,
  '@/hooks/use-duels': `export {useDuels} from 'test:state';`,
  '@/hooks/use-home': `export const useNow=()=>1800000000000;`,
  '@/lib/duel-service': `export {createDuel,makeDuelMove,claimDuelReward,acceptDuel,cancelDuel} from 'test:state';`,
  '@/lib/friends': `export const friendIdentity=()=>({uid:'friend',name:'친구',avatar:null});`,
  'expo-router': `export const router={navigate(){}};`,
  'expo-symbols': `export const SymbolView=()=>null;`,
  'react-native-safe-area-context': `export {View as SafeAreaView} from 'react-native-web';`,
  './gacha-image': `import * as React from 'react';import {Image as RNImage} from 'react-native-web';export function Image({contentFit,...props}){return <RNImage {...props} resizeMode="contain"/>;}`,
  '@/components/gacha-image': `export {Image} from './gacha-image';`,
};
(async()=>{
  const bundle=await esbuild.build({stdin:{contents:`import * as React from 'react';import {createRoot} from 'react-dom/client';import {ArenaScreen} from '@/components/arena-screen';createRoot(document.getElementById('root')).render(<ArenaScreen/>);`,resolveDir:root,loader:'tsx'},absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',alias:{'react-native':'react-native-web'},define:{'process.env.NODE_ENV':'"production"',__DEV__:'false',global:'globalThis'},plugins:[{name:'isolated-test',setup(build){
    build.onResolve({filter:/.*/},args=>args.path==='test:state'?{path:args.path,namespace:'mock'}:args.path in stubs?{path:args.path,namespace:'mock'}:undefined);
    build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='test:state'?stateModule:stubs[args.path],loader:'tsx',resolveDir:root}));
  }}]});
  const server=http.createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);}else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;height:100%;background:#101321}#root{display:flex}*{box-sizing:border-box}</style><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,500,1,0&display=block"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const errors=[];const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});page.setDefaultTimeout(7000);page.on('pageerror',e=>{errors.push(e.message);console.log('Browser error:',e.message);});
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByText('본능을 깨우는',{exact:false}).waitFor();
    await page.waitForTimeout(1800);
    const out=path.join(root,'.test-artifacts');fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,'arena-lobby.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile lobby overflows horizontally');
    await page.getByRole('button',{name:'AI 도전 시작'}).click();
    try { await page.getByText('다음 행동을 선택하세요').waitFor({timeout:5000}); }
    catch(e) { console.log('Runtime errors:',errors);console.log((await page.locator('body').innerText()).slice(0,2000));await page.screenshot({path:path.join(out,'arena-failure.png'),fullPage:true,timeout:5000});throw e; }
    await page.getByRole('button',{name:'일반 공격'}).click();await page.getByText('다음 행동을 선택하세요').waitFor();
    await page.screenshot({path:path.join(out,'arena-battle.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile battle overflows horizontally');
    await page.getByRole('button',{name:'로비로',exact:true}).click();await page.getByRole('button',{name:'동물 변경'}).click();await page.getByText('출전 동물 선택',{exact:true}).waitFor();
    await page.getByRole('button',{name:'닫기',exact:true}).click();
    await page.setViewportSize({width:320,height:740});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'320px lobby overflows horizontally');
    assert.deepEqual(errors,[]);
    console.log('PASS browser: 390px lobby/battle, attack round trip, character picker, 320px layout, no runtime exceptions');
    console.log('Screenshots: .test-artifacts/arena-lobby.png and arena-battle.png');
  }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

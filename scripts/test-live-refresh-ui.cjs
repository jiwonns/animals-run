const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),toolRoot=path.join(root,'.expo/admin-ui-tools/node_modules');
const esbuild=require(path.join(toolRoot,'esbuild')),{chromium}=require(path.join(toolRoot,'playwright'));
const seedPath=path.join(root,'shared/gacha/seed-catalog.json').replace(/\\/g,'/');
const stubs={
 'firebase/firestore':`import seed from '${seedPath}';let server=structuredClone(seed);server.version=6;const observers=new Set();window.__forceReads=0;window.__mounts=0;window.__change=(title,emit=true)=>{server=structuredClone(server);server.version++;server.collections.find(c=>c.id==='normal').banner.title=title;if(emit)for(const cb of observers)cb(snapshot());};function snapshot(){return{exists:()=>true,data:()=>structuredClone(server),metadata:{hasPendingWrites:false,fromCache:false}};}export const doc=(_, ...parts)=>({path:parts.join('/')});export const getDoc=async()=>snapshot();export const getDocFromServer=async()=>{window.__forceReads++;return snapshot();};export const onSnapshot=(_,next)=>{observers.add(next);queueMicrotask(()=>{if(observers.has(next))next(snapshot());});return()=>observers.delete(next);};export const runTransaction=async()=>{throw Error('not used');};export const serverTimestamp=()=>null;`,
 '@/lib/firebase':`export const db={};`,
 './firebase':`export const db={};`,
 './medals':`export const rebuildCollectionMedals=()=>{};`,
 './session-provider':`const user={uid:'admin'};export const useSession=()=>({user});`,
 '@react-native-async-storage/async-storage':`export default{getItem:async()=>null,setItem:async()=>{}};`,
 '@/providers/session-provider':`const user={uid:'admin'};const profile={coins:999,tickets:30,characters:{mouse:1}};export const useSession=()=>({user,profile});`,
 '@/hooks/use-colors':`export const useColors=()=>({background:'#fffaf5',surface:'#ffffff',border:'#ddd',text:'#222',secondary:'#666',primary:'#ed701e'});`,
 '@/lib/admin-catalog':`export const useAdministrator=()=>({allowed:true,loading:false});export const uploadGachaImage=async()=>({uri:'https://example.com/image.png'});`,
 'expo-router':`export const Stack={Screen:()=>null};`,
 '@/hooks/use-confirm-exit':`export const useConfirmExit=()=>{};`,
 '@/lib/gacha':`export const acceptsTickets=b=>b.cost[1]<=10;export const drawCharacters=async()=>{throw Error('not used');};export class DrawError extends Error{}`,
 '@/components/gacha/draw-show':`export const DrawShow=()=>null;`,
 '@/components/banner-poster':`import * as React from 'react';import {Text,View} from 'react-native-web';export const BannerPoster=({banner,width,height})=><View style={{width,height,backgroundColor:'#ffe4ca'}}><Text>{banner.title}</Text></View>;`,
 '@/components/coin-badge':`export const CoinBadge=()=>null;export const CoinToken=()=>null;`,
 '@/components/ticket-badge':`export const TICKET_COLOR='#f90';export const TicketBadge=()=>null;export const TicketToken=()=>null;`,
 '@/components/odds-info':`export const OddsButton=()=>null;`,
 '@/components/gacha-image':`import * as React from 'react';import {View} from 'react-native-web';export const Image=({style})=><View style={style}/>;`,
 'react-native-safe-area-context':`import * as React from 'react';import {View} from 'react-native-web';export const SafeAreaView=({edges,...props})=><View {...props}/>;`,
 'react-native-reanimated':`import * as React from 'react';import {View,Text,FlatList} from 'react-native-web';export default{View,Text,FlatList};export const Extrapolation={CLAMP:'clamp'};export const interpolate=(_,__,v)=>v[1];export const interpolateColor=(_,__,v)=>v[0];export const withSpring=v=>v;export function useSharedValue(value){return React.useMemo(()=>({value,get(){return this.value;},set(v){this.value=v;}}),[]);}export const useAnimatedStyle=fn=>fn();export const useAnimatedScrollHandler=fn=>e=>fn({contentOffset:e.nativeEvent.contentOffset});`,
};
(async()=>{
 const entry=`import * as React from 'react';import{createRoot}from'react-dom/client';import{View,Pressable,Text,TextInput}from'react-native';import{CatalogProvider}from'@/providers/catalog-provider';import{GlobalPullRefresh}from'@/components/global-pull-refresh.web';import Gacha from'@/app/(tabs)/gacha';import Admin from'@/app/admin';function App(){const[tab,setTab]=React.useState('gacha'),[text,setText]=React.useState('');React.useEffect(()=>{window.__mounts++;},[]);return <View style={{flex:1}}><View style={{flexDirection:'row',height:44}}>{['gacha','admin'].map(t=><Pressable accessibilityRole="button" key={t} onPress={()=>setTab(t)} style={{padding:10}}><Text>{t==='gacha'?'뽑기 화면':'관리자 화면'}</Text></Pressable>)}</View><TextInput accessibilityLabel='유지할 입력' value={text} onChangeText={setText}/><View style={{flex:1,display:tab==='gacha'?'flex':'none'}}><Gacha/></View><View style={{flex:1,display:tab==='admin'?'flex':'none'}}><Admin/></View><GlobalPullRefresh/></View>;}createRoot(document.getElementById('root')).render(<CatalogProvider><App/></CatalogProvider>);`;
 const bundle=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',alias:{'react-native':'react-native-web'},define:{'process.env.NODE_ENV':'"production"',__DEV__:'false',global:'globalThis'},plugins:[{name:'network-fixture',setup(build){build.onResolve({filter:/.*/},args=>args.path in stubs?{path:args.path,namespace:'mock'}:undefined);build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:stubs[args.path],loader:'tsx',resolveDir:root}));}}]});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html; charset=utf-8');res.end(req.url==='/app.js'?bundle.outputFiles[0].text:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0;overflow:hidden}#root{display:flex}*{box-sizing:border-box}</style><div id="root"></div><script src="/app.js"></script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByText('노말 뽑기',{exact:true}).first().waitFor();await page.waitForFunction(()=>window.__forceReads>=1);
  await page.getByLabel('유지할 입력',{exact:true}).fill('새로고침해도 유지');const reads=await page.evaluate(()=>window.__forceReads);
  await page.evaluate(()=>window.__change('저장 즉시 보이는 뽑기'));await page.getByText('저장 즉시 보이는 뽑기',{exact:true}).first().waitFor();assert.equal(await page.evaluate(()=>window.__forceReads),reads,'snapshot update must not require polling');
  await page.getByRole('button',{name:'관리자 화면',exact:true}).click();await page.getByRole('button',{name:'이름·가격·확률 설정',exact:true}).click();await page.getByLabel('뽑기 이름',{exact:true}).fill('편집 중인 제목');
  await page.evaluate(()=>window.__change('다른 관리자가 바꾼 제목'));await page.getByText('새 게시 내용이 있어요.',{exact:false}).waitFor();assert.equal(await page.getByLabel('뽑기 이름',{exact:true}).inputValue(),'편집 중인 제목');
  await page.getByRole('button',{name:'뽑기 화면',exact:true}).click();await page.getByText('다른 관리자가 바꾼 제목',{exact:true}).first().waitFor();
  await page.evaluate(()=>window.__change('당겨서 받은 최신 제목',false));
  const cdp=await page.context().newCDPSession(page),heading=await page.getByText('뽑기',{exact:true}).first().boundingBox();const x=heading.x+20,y=heading.y+10;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+100}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.getByText('당겨서 받은 최신 제목',{exact:true}).first().waitFor();assert.ok(await page.evaluate(()=>window.__forceReads)>reads);
  assert.equal(await page.getByLabel('유지할 입력',{exact:true}).inputValue(),'새로고침해도 유지');assert.equal(await page.evaluate(()=>window.__mounts),1);
  const before=await page.evaluate(()=>window.__forceReads);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:y+180}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y:y+190}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__forceReads),before,'horizontal banner swipe is not refresh');
  assert.deepEqual(errors,[]);fs.mkdirSync(path.join(root,'.test-artifacts'),{recursive:true});await page.screenshot({path:path.join(root,'.test-artifacts/live-pull-refresh.png'),fullPage:true});
  console.log('PASS actual catalog provider and draw screen: live title update without polling, dirty administrator draft preserved, touch pull refresh, horizontal swipe ignored, no remount or input loss');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAppRefresh } from '@/lib/app-refresh';

/** Document-level web touch support, including empty pages and horizontal carousels. */
export function GlobalPullRefresh(){
  const {refresh,refreshing,error}=useAppRefresh();
  const [distance,setDistance]=useState(0);
  const refreshingRef=useRef(refreshing);
  useEffect(()=>{refreshingRef.current=refreshing;},[refreshing]);
  useEffect(()=>{
    const root=document.documentElement,body=document.body;
    const oldRoot=root.style.overscrollBehavior,oldBody=body.style.overscrollBehavior;
    root.style.overscrollBehavior='none';body.style.overscrollBehavior='none';
    let start:{x:number;y:number}|null=null,amount=0;
    function atTop(target:EventTarget|null){
      let node=target instanceof Element?target:null;
      if(node?.closest('input,textarea,select,iframe,[data-no-pull-refresh]'))return false;
      while(node){
        const style=getComputedStyle(node);
        if(/auto|scroll/.test(style.overflowY)&&node.scrollHeight>node.clientHeight+1)return node.scrollTop<=0;
        node=node.parentElement;
      }
      return (document.scrollingElement?.scrollTop??0)<=0;
    }
    const begin=(e:TouchEvent)=>{amount=0;const t=e.touches[0];start=e.touches.length===1&&!refreshingRef.current&&atTop(e.target)?{x:t.clientX,y:t.clientY}:null;};
    const move=(e:TouchEvent)=>{
      if(!start||e.touches.length!==1)return;
      if(!atTop(e.target)){start=null;amount=0;setDistance(0);return;}
      const t=e.touches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;
      if(Math.abs(dx)>20&&Math.abs(dx)>Math.abs(dy)){start=null;setDistance(0);return;}
      if(dy>12&&dy>Math.abs(dx)*1.3){if(e.cancelable)e.preventDefault();amount=Math.min(100,dy);setDistance(amount);}
    };
    const end=()=>{const shouldRefresh=!!start&&amount>=70;start=null;amount=0;setDistance(0);if(shouldRefresh)void refresh();};
    const cancel=()=>{start=null;amount=0;setDistance(0);};
    document.addEventListener('touchstart',begin,{passive:true});document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',end);document.addEventListener('touchcancel',cancel);
    return()=>{root.style.overscrollBehavior=oldRoot;body.style.overscrollBehavior=oldBody;document.removeEventListener('touchstart',begin);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);document.removeEventListener('touchcancel',cancel);};
  },[refresh]);
  if(!distance&&!refreshing&&!error)return null;
  return <View pointerEvents={error&&!refreshing?'auto':'none'} style={{position:'absolute',top:8,left:16,right:16,zIndex:99999,alignItems:'center'}}>
    <View style={{padding:12,borderRadius:16,backgroundColor:'#fff8f0',borderWidth:1,borderColor:'#f4cba4',gap:8,alignItems:'center'}}>
      {refreshing?<ActivityIndicator color="#FB7103"/>:null}<Text accessibilityRole="status" style={{color:'#5d3215',textAlign:'center'}}>{refreshing?'새로고침 중…':error??(distance>=70?'놓으면 새로고침해요':'아래로 당겨 새로고침')}</Text>
      {error&&!refreshing&&<Pressable accessibilityRole="button" onPress={()=>void refresh()} style={{padding:8}}><Text style={{color:'#d65d00'}}>다시 시도</Text></Pressable>}
    </View>
  </View>;
}

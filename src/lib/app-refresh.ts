import { useEffect, useSyncExternalStore } from 'react';

type Task=()=>unknown;
let state={revision:0,refreshing:false,error:null as string|null};
const listeners=new Set<()=>void>(),tasks=new Map<Task,number>();
let running:Promise<void>|null=null;
function update(next:Partial<typeof state>){state={...state,...next};for(const notify of listeners)notify();}
const subscribe=(notify:()=>void)=>{listeners.add(notify);return()=>{listeners.delete(notify);};};
export function registerRefreshTask(task:Task){tasks.set(task,(tasks.get(task)??0)+1);return()=>{const count=(tasks.get(task)??1)-1;if(count)tasks.set(task,count);else tasks.delete(task);};}
export function refreshApplication():Promise<void> {
  if(running)return running;
  const current=[...tasks.keys()];
  update({refreshing:true,error:null,revision:state.revision+1});
  running=(async()=>{
    try {const results=await Promise.allSettled(current.map(task=>Promise.resolve().then(task)));if(results.some(r=>r.status==='rejected'))update({error:'일부 정보를 새로고침하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.'});}
    finally {running=null;update({refreshing:false});}
  })();
  return running;
}
export function useAppRefresh(){const value=useSyncExternalStore(subscribe,()=>state,()=>state);return {...value,refresh:refreshApplication};}
export function useRefreshRevision(){return useSyncExternalStore(subscribe,()=>state.revision,()=>state.revision);}
export function useRefreshTask(task:Task|undefined){useEffect(()=>task?registerRefreshTask(task):undefined,[task]);}

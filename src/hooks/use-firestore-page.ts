import { getDocs, limit, query, startAfter, type DocumentData, type Query, type QueryDocumentSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
const PAGE_SIZE=24;
export function useFirestorePage(source:Query<DocumentData> | null, key:string) {
  const [state,setState]=useState<{key:string;docs:QueryDocumentSnapshot<DocumentData>[];hasMore:boolean;busy:boolean;error:boolean}>({key:'',docs:[],hasMore:true,busy:false,error:false});
  const request=useRef(0), busy=useRef(false), cursor=useRef<QueryDocumentSnapshot<DocumentData> | null>(null), more=useRef(true);
  const load=useCallback(async(reset=false)=>{
    if (!source || (!reset && (busy.current || !more.current))) return;
    const generation=reset?++request.current:request.current;
    busy.current=true;
    if(reset){cursor.current=null;more.current=true;}
    setState(s=>({key,docs:reset?[]:s.docs,hasMore:true,busy:true,error:false}));
    try {
      const page=await getDocs(query(source,...(cursor.current?[startAfter(cursor.current)]:[]),limit(PAGE_SIZE)));
      if(generation!==request.current)return;
      cursor.current=page.docs.at(-1)??cursor.current;more.current=page.size===PAGE_SIZE;
      setState(s=>({key,docs:reset?page.docs:[...s.docs,...page.docs.filter(d=>!s.docs.some(old=>old.id===d.id))],hasMore:more.current,busy:false,error:false}));
    }catch{if(generation===request.current)setState(s=>({...s,key,busy:false,error:true}));}
    finally{if(generation===request.current)busy.current=false;}
  },[source,key]);
  useEffect(()=>{const generation=request;const timer=setTimeout(()=>void load(true),0);return()=>{clearTimeout(timer);generation.current++;busy.current=false;};},[load]);
  return {docs:state.key===key?state.docs:[],loading:state.key!==key||state.busy,failed:state.key===key&&state.error,hasMore:state.key!==key||state.hasMore,loadMore:()=>void load(),refresh:()=>void load(true)};
}

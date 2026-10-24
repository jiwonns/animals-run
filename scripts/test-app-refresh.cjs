const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const result={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/lib/app-refresh.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id==='react'?{useEffect(){},useSyncExternalStore:(_,read)=>read()}:require(id),result,result.exports);
(async()=>{
 const api=result.exports;let calls=0,finish;
 const task=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
 const off1=api.registerRefreshTask(task),off2=api.registerRefreshTask(task);off1();
 const first=api.refreshApplication(),second=api.refreshApplication();assert.equal(first,second);
 await Promise.resolve();assert.equal(calls,1);assert.equal(api.useAppRefresh().refreshing,true);
 finish();await first;assert.equal(api.useAppRefresh().refreshing,false);off2();
 const before=api.useAppRefresh().revision;const fail=api.registerRefreshTask(()=>Promise.reject(Error('offline')));
 let healthy=0;const good=api.registerRefreshTask(()=>{healthy++;});
 await api.refreshApplication();assert.equal(healthy,1);assert.equal(api.useAppRefresh().refreshing,false);assert.ok(api.useAppRefresh().error);fail();
 await api.refreshApplication();assert.equal(healthy,2);assert.equal(api.useAppRefresh().error,null);assert.equal(api.useAppRefresh().revision,before+2);good();
 console.log('PASS shared refresh: deduplicated concurrent pulls, reference-counted tasks, awaited completion, independent failure isolation, retry recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});

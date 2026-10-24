import { FlatList, ScrollView } from '@/components/refreshable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Image } from '@/components/gacha-image';
import { PagedListSheet } from '@/components/paged-list-sheet';
import { useColors } from '@/hooks/use-colors';
import { COLLECTION_DATA } from '@/constants/gacha.generated';
import type { CatalogBanner, GachaImage, Grade } from '@/constants/gacha-types';
import { GRADES } from '@/constants/characters';
import { useAdministrator, uploadGachaImage } from '@/lib/admin-catalog';
import { currentCatalog, loadRemoteCatalog, publishCatalog } from '@/lib/remote-catalog';
import { useSession } from '@/providers/session-provider';
import { useCatalog } from '@/providers/catalog-provider';
import { assertCompatible, catalogBanners, validateCatalog, type Catalog } from '../../shared/gacha/catalog';
import { DRAW_GRADES } from '../../shared/gacha/draw-pools';
import { bannerWeights, newBanner, putBanner, registerAnimal, selectAnimals, selectedAnimalIds, setGradeWeight, storedAnimals } from '@/lib/admin-catalog-editor';

function Field({label,value,onChange,numeric=false,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;numeric?:boolean;disabled?:boolean}) {
  const c=useColors();
  const [editing,setEditing]=useState<string|null>(null);
  return <View style={{gap:5}}><Text style={{color:c.secondary,fontSize:13}}>{label}</Text><TextInput accessibilityLabel={label} value={editing??value} editable={!disabled}
    onChangeText={text=>{setEditing(text);onChange(numeric?text.replace(',','.'):text);}} onBlur={()=>setEditing(null)}
    keyboardType={numeric?'decimal-pad':'default'} autoCapitalize="none" style={{minHeight:46,padding:12,borderRadius:12,borderWidth:1,borderColor:c.border,color:c.text,backgroundColor:c.surface}}/></View>;
}
function Grades({value,onChange,disabled=false}:{value:Grade;onChange:(grade:Grade)=>void;disabled?:boolean}) {
  const c=useColors();
  return <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{DRAW_GRADES.map(g=><Pressable key={g} accessibilityRole="button" accessibilityState={{selected:value===g}} disabled={disabled} onPress={()=>onChange(g)} style={{minHeight:44,paddingHorizontal:12,justifyContent:'center',borderRadius:12,backgroundColor:value===g?c.primary:c.surface}}><Text style={{fontWeight:'700',color:value===g?'#fff':c.text}}>{GRADES[g].label}</Text></Pressable>)}</View>;
}
const identifier=(prefix:string)=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const clone=(value:Catalog):Catalog=>JSON.parse(JSON.stringify(value));
export default function AdminScreen() {
  const c=useColors(),role=useAdministrator();
  const {user}=useSession();const {version:catalogVersion,refresh}=useCatalog();
  const [draft,setDraft]=useState<Catalog|null>(null),[baseline,setBaseline]=useState<Catalog|null>(null);
  const [selected,setSelected]=useState(''),[grade,setGrade]=useState<Grade>('N'),[search,setSearch]=useState('');
  const [picker,setPicker]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [settings,setSettings]=useState(false);
  const [form,setForm]=useState<{name:string;grade:Grade;image:GachaImage|null}|null>(null);
  const reload=useCallback(async(snapshot?:Catalog)=>{
    const live=snapshot??await loadRemoteCatalog();const next=live??{schema:1 as const,version:0,collections:COLLECTION_DATA};
    setBaseline(clone(next));setDraft(clone(next));
    const list=catalogBanners(next);setSelected(prev=>list.some(b=>b.id===prev)?prev:(list.find(b=>b.enabled!==false)??list[0])?.id??'');
  },[]);
  useEffect(()=>{if(!role.allowed)return;const timer=setTimeout(()=>void reload().catch(e=>setNotice(e.message)),0);return()=>clearTimeout(timer);},[role.allowed,reload]);
  useEffect(()=>{
    if(!baseline||!draft||catalogVersion<=baseline.version||busy||form)return;
    if(JSON.stringify(draft)!==JSON.stringify(baseline))return;
    const timer=setTimeout(()=>void reload(currentCatalog()??undefined).catch(e=>setNotice(e.message)),0);
    return()=>clearTimeout(timer);
  },[catalogVersion,baseline,draft,busy,form,reload]);
  const refreshEditor=useCallback(async()=>{
    if(busy||form||(baseline&&draft&&JSON.stringify(baseline)!==JSON.stringify(draft))){setNotice('서버 정보는 새로고침하고 편집 중인 내용은 유지했어요.');return;}
    await reload();
  },[busy,form,baseline,draft,reload]);
  const banners=draft?catalogBanners(draft):[];
  const banner=banners.find(b=>b.id===selected);
  const animals=useMemo(()=>draft?storedAnimals(draft):[],[draft]);
  const selectedIds=draft&&banner?selectedAnimalIds(draft,banner):[];
  const selectedSet=new Set(selectedIds);
  const visible=animals.filter(ch=>ch.grade===grade && ch.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const eligible=visible.filter(ch=>ch.eligible);
  const weights=draft&&banner?bannerWeights(draft,banner):{};
  const chosenGrades=DRAW_GRADES.filter(g=>animals.some(ch=>ch.grade===g&&selectedSet.has(ch.id)));
  function patch(update:Partial<CatalogBanner>) {if(draft&&banner){setDraft(putBanner(draft,{...banner,...update}));setNotice('');}}
  function choose(ids:string[]) {if(draft&&banner){setDraft(putBanner(draft,selectAnimals(draft,banner,ids)));setNotice('');}}
  async function save() {
    if(!draft||!baseline||!user||busy)return;
    setBusy(true);setNotice('');
    try {validateCatalog(draft);assertCompatible(baseline,draft);await publishCatalog(draft,user.uid);await refresh();await reload(currentCatalog()??undefined);setNotice('저장 완료 · 선택한 동물과 확률이 뽑기에 적용됐어요.');}
    catch(e){setNotice(e instanceof Error?e.message:'저장하지 못했어요. 다시 시도해주세요.');}finally{setBusy(false);}
  }
  async function upload(target:'animal'|'poster') {
    setBusy(true);setNotice('');
    try {const image=await uploadGachaImage();if(image){if(target==='animal')setForm(prev=>prev?{...prev,image}:prev);else patch({poster:image});}}
    catch(e){setNotice(e instanceof Error?e.message:'이미지를 올리지 못했어요.');}finally{setBusy(false);}
  }
  async function saveAnimal() {
    if(!form||!form.image||!draft||!baseline||!user||busy)return;
    setBusy(true);setNotice('');
    try {
      const input={id:identifier('animal'),name:form.name,grade:form.grade,image:form.image};
      const nextBase=registerAnimal(baseline,input),nextDraft=registerAnimal(draft,input);
      validateCatalog(nextBase);assertCompatible(baseline,nextBase);
      const version=await publishCatalog(nextBase,user.uid);
      const active=catalogBanners(nextDraft).find(b=>b.id===selected);
      const edited=active?putBanner(nextDraft,selectAnimals(nextDraft,active,[...selectedAnimalIds(nextDraft,active),input.id])):nextDraft;
      setBaseline({...nextBase,version});setDraft({...edited,version});setGrade(form.grade);setSearch(input.name);setForm(null);await refresh();
      setNotice('동물을 서버에 저장했어요. 아래 저장하고 적용을 누르면 이 뽑기에 추가돼요.');
    } catch(e){setNotice(e instanceof Error?e.message:'동물을 저장하지 못했어요.');}finally{setBusy(false);}
  }
  const button=(label:string,onPress:()=>void,primary=false,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={busy||disabled} style={{minHeight:46,justifyContent:'center',alignItems:'center',paddingHorizontal:14,borderRadius:12,backgroundColor:primary?c.primary:c.surface,opacity:busy||disabled?0.45:1}}><Text style={{color:primary?'#fff':c.primary,fontWeight:'800'}}>{label}</Text></Pressable>;
  const field=(label:string,value:string,onChange:(value:string)=>void,numeric=false)=><Field key={`${selected}:${label}`} label={label} value={value} onChange={onChange} numeric={numeric} disabled={busy}/>;
  const staleDraft=baseline&&draft&&catalogVersion>baseline.version&&JSON.stringify(draft)!==JSON.stringify(baseline);
  const actualNotice=staleDraft?'새 게시 내용이 있어요. 편집 중인 내용은 유지했어요. 최신 내용으로 바꾸려면 편집을 취소하고 다시 불러오세요.':notice;
  const noticeView=actualNotice?<Text accessibilityRole="alert" style={{color:c.primary,lineHeight:22}}>{actualNotice}</Text>:null;
  const header=<View style={{gap:16,paddingBottom:16}}>
    <Text style={{fontSize:24,fontWeight:'900',color:c.text}}>뽑기 관리</Text>
    <Text style={{color:c.secondary,lineHeight:22}}>뽑기와 등급을 고른 뒤 서버에 저장된 동물을 선택하세요. 없는 동물은 바로 등록할 수 있어요.</Text>
    {noticeView}
    {actualNotice.includes('편집')&&button('편집 취소하고 최신 내용 불러오기',()=>{setForm(null);void reload().then(()=>setNotice('최신 내용을 불러왔어요.')).catch(e=>setNotice(e.message));})}
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{button(banner?.title??'뽑기 선택',()=>setPicker(true))}{button('새 뽑기 만들기',()=>{if(!draft)return;const next=newBanner(draft,identifier('draw'));setDraft(putBanner(draft,next));setSelected(next.id);setSettings(true);setNotice('동물을 선택하고 저장하면 새 뽑기가 만들어져요.');})}</View>
    {banner&&<>
      {button(settings?'설정 접기':'이름·가격·확률 설정',()=>setSettings(prev=>!prev))}
      {settings&&<View style={{gap:14,padding:12,borderWidth:1,borderColor:c.border,borderRadius:12}}>
      {field('뽑기 이름',banner.title,title=>patch({title}))}
      {field('소개',banner.tagline,tagline=>patch({tagline}))}
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:c.text,fontWeight:'700'}}>판매 중</Text><Switch accessibilityLabel="판매 중" value={banner.enabled!==false} disabled={busy} onValueChange={enabled=>patch({enabled})}/></View>
      {field('1회 가격',String(banner.cost[1]),value=>patch({cost:{...banner.cost,1:Number(value)}}),true)}
      {field('10회 가격',String(banner.cost[10]),value=>patch({cost:{...banner.cost,10:Number(value)}}),true)}
      {banner.poster&&<Image source={banner.poster} style={{width:'100%',height:150}} contentFit="contain"/>}
      {button('뽑기 포스터 변경',()=>void upload('poster'))}
      <Text style={{fontSize:19,fontWeight:'800',color:c.text}}>등급별 확률</Text>
      <Text style={{color:c.primary}}>합계 {(banner.rates.reduce((n,r)=>n+r.rate,0)*100).toFixed(4)}% · 같은 등급 안에서는 선택한 동물이 균등하게 나와요.</Text>
      {chosenGrades.map(g=>field(`${GRADES[g].label} 확률 (%)`,String(Number(((weights[g]??0)*100).toFixed(6))),value=>{if(draft)setDraft(putBanner(draft,setGradeWeight(draft,banner,g,Number(value)/100)));},true))}
      </View>}
      <Text style={{fontSize:19,fontWeight:'800',color:c.text}}>1. 등급 선택</Text>
      <Grades value={grade} onChange={g=>{setGrade(g);setSearch('');}} disabled={busy}/>
      <Text style={{fontSize:19,fontWeight:'800',color:c.text}}>2. 서버 동물 선택</Text>
      {field('동물 이름 검색',search,setSearch)}
      <Text style={{color:c.secondary,lineHeight:22}}>선택 {selectedIds.length}종 · 진화 전용·아기 동물은 뽑기에 넣을 수 없어요.</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        {button('이 등급 전체 선택',()=>choose([...selectedIds,...eligible.map(ch=>ch.id)]),false,!eligible.length)}
        {button('이 등급 선택 해제',()=>choose(selectedIds.filter(id=>!animals.some(ch=>ch.id===id&&ch.grade===grade))))}
        {button('새 동물 등록',()=>setForm({name:'',grade,image:null}))}
      </View>
    </>}
    {!draft&&button('서버 동물 다시 불러오기',()=>void reload().catch(e=>setNotice(e.message)))}
  </View>;
  return <View style={{flex:1,backgroundColor:c.background}}>
    <Stack.Screen options={{title:'뽑기 관리',headerShown:true,headerTintColor:c.text,headerStyle:{backgroundColor:c.background}}}/>
    {!role.allowed?<Text style={{padding:24,color:c.secondary}}>{role.loading?'관리자 권한을 확인하고 있어요…':'관리자 계정만 접근할 수 있어요.'}</Text>:<>
      <FlatList onRefresh={refreshEditor} data={banner?visible:[]} keyExtractor={ch=>ch.id} numColumns={2} extraData={selectedIds.join(',')} contentContainerStyle={{padding:16,gap:12,maxWidth:900,width:'100%',alignSelf:'center',paddingBottom:24}} columnWrapperStyle={{gap:12}} initialNumToRender={12} maxToRenderPerBatch={12} windowSize={5} keyboardShouldPersistTaps="handled" ListHeaderComponent={header}
        ListEmptyComponent={<Text style={{padding:20,color:c.secondary}}>{draft?'이 등급에는 동물이 없어요. 새 동물을 등록해보세요.':'서버 동물을 불러오는 중이에요.'}</Text>}
        renderItem={({item})=><Pressable accessibilityRole="checkbox" accessibilityLabel={item.name} accessibilityState={{checked:selectedSet.has(item.id),disabled:!item.eligible||busy}} disabled={!item.eligible||busy} onPress={()=>choose(selectedSet.has(item.id)?selectedIds.filter(id=>id!==item.id):[...selectedIds,item.id])} style={{flex:1,maxWidth:'50%',minHeight:145,padding:12,borderRadius:14,borderWidth:2,borderColor:selectedSet.has(item.id)?c.primary:c.border,backgroundColor:c.surface,alignItems:'center',gap:7,opacity:item.eligible?1:0.5}}>
          <Image source={item.thumb} style={{width:75,height:75}} contentFit="contain"/><Text style={{color:c.text,fontWeight:'700'}} numberOfLines={2}>{item.name}</Text><Text style={{color:c.secondary,fontSize:12}}>{!item.eligible?'진화·교배 전용':selectedSet.has(item.id)?'✓ 선택됨':'선택하기'}</Text>
        </Pressable>}/>
      <View style={{padding:12,borderTopWidth:1,borderColor:c.border,gap:8}}><Text style={{color:c.secondary}}>선택 {selectedIds.length}종 · 확률 합계 {((banner?.rates.reduce((n,r)=>n+r.rate,0)??0)*100).toFixed(2)}%</Text>{button(busy?'저장 중…':'저장하고 적용',()=>void save(),true,!draft)}</View>
    </>}
    {picker&&draft&&<PagedListSheet title="뽑기 선택" data={banners} keyExtractor={b=>b.id} onClose={()=>setPicker(false)} renderItem={({item})=><Pressable accessibilityRole="button" onPress={()=>{setSelected(item.id);setPicker(false);}} style={{minHeight:52,justifyContent:'center'}}><Text style={{color:c.text}}>{item.title} · {item.enabled===false?'판매 중지':'판매 중'}</Text></Pressable>}/>}
    {form&&<Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>{if(!busy)setForm(null);}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,paddingTop:48,gap:18,maxWidth:700,width:'100%',alignSelf:'center'}} style={{backgroundColor:c.background}}>
      <Text style={{fontSize:23,fontWeight:'800',color:c.text}}>새 동물 등록</Text>{noticeView}
      <Grades value={form.grade} onChange={g=>setForm({...form,grade:g})} disabled={busy}/>
      <Field label="새 동물 이름" value={form.name} onChange={name=>setForm({...form,name})} disabled={busy}/>
      {form.image&&<Image source={form.image} style={{width:160,height:160,alignSelf:'center'}} contentFit="contain"/>}
      {button('동물 이미지 올리기',()=>void upload('animal'))}
      <Field label="이미지 주소 (선택)" value={form.image&&typeof form.image==='object'&&!form.image.uri.startsWith('gacha-image:')?form.image.uri:''} onChange={uri=>setForm({...form,image:uri?{uri}:null})} disabled={busy}/>
      <Text style={{color:c.secondary,lineHeight:22}}>이름·등급·이미지를 서버에 저장해요. 저장한 동물은 다음에도 등급 목록에서 고를 수 있어요.</Text>
      {button('동물 저장',()=>void saveAnimal(),true,!form.image||!form.name.trim())}{button('닫기',()=>setForm(null))}
    </ScrollView></Modal>}
  </View>;
}

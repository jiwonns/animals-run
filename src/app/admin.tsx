import { Image } from '@/components/gacha-image';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { PagedListSheet } from '@/components/paged-list-sheet';
import { useColors } from '@/hooks/use-colors';
import { COLLECTION_DATA } from '@/constants/gacha.generated';
import type { CollectionData } from '@/constants/gacha-types';
import { GRADES } from '@/constants/characters';
import { useAdministrator, uploadGachaImage } from '@/lib/admin-catalog';
import { publishCatalog, loadRemoteCatalog } from '@/lib/remote-catalog';
import { useSession } from '@/providers/session-provider';
import { useCatalog } from '@/providers/catalog-provider';
import { assertCompatible, validateCatalog, type Catalog } from '../../shared/gacha/catalog';

const clone = <T,>(v:T):T => JSON.parse(JSON.stringify(v));
function AdminField({label,value,onChange,numeric,disabled}:{label:string;value:string;onChange:(text:string)=>void;numeric:boolean;disabled:boolean}) {
  const c=useColors();
  const [editing,setEditing]=useState<string|null>(null);
  return <View style={{gap:6}}><Text style={{color:c.secondary,fontSize:12}}>{label}</Text><TextInput accessibilityLabel={label} value={editing??value} onChangeText={text=>{setEditing(text);onChange(numeric?text.replace(',','.'):text);}} onBlur={()=>setEditing(null)} editable={!disabled} keyboardType={numeric?'decimal-pad':'default'} autoCapitalize="none" style={{color:c.text,backgroundColor:c.surface,borderColor:c.border,borderWidth:1,borderRadius:12,padding:12,minHeight:46}}/></View>;
}
export default function AdminScreen() {
  const c = useColors();
  const role = useAdministrator();
  const { user } = useSession();
  const { refresh } = useCatalog();
  const [draft, setDraft] = useState<Catalog | null>(null);
  const [baseline, setBaseline] = useState<Catalog | null>(null);
  const [selected, setSelected] = useState('');
  const [picker, setPicker] = useState(false);
  const [animalPicker,setAnimalPicker] = useState(false);
  const [animalId,setAnimalId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState(false);
  async function reload() {
    const live = await loadRemoteCatalog();
    const next:Catalog = live ?? { schema:1,version:0,collections:COLLECTION_DATA };
    setBaseline(clone(next)); setDraft(clone(next)); setSelected(next.collections[0].id); setNotice(''); setReview(false);
  }
  useEffect(() => { if (!role.allowed) return; const timer = setTimeout(() => void reload().catch(e => setNotice(e.message)), 0); return () => clearTimeout(timer); }, [role.allowed]);
  const collection = draft?.collections.find(v => v.id === selected);
  const editingAnimal = collection?.characters.find(ch=>ch.id===animalId) ?? collection?.characters[0];
  function patchCollection(update:Partial<CollectionData>) {
    setReview(false);
    setDraft(prev => prev && ({ ...prev, collections:prev.collections.map(v => v.id === selected ? { ...v,...update } : v) }));
  }
  function patchBanner(update:Partial<NonNullable<CollectionData['banner']>>) { if (collection?.banner) patchCollection({ banner:{ ...collection.banner,...update } }); }
  async function upload(target:'poster' | 'animal', id?:string) {
    if (busy || !collection) return;
    setBusy(true);
    try {
      const image = await uploadGachaImage(); if (!image) return;
      if (target === 'poster') patchBanner({ poster:image });
      else patchCollection({ characters:collection.characters.map(ch => ch.id === id ? { ...ch,image,thumb:image } : ch) });
    } catch (e) { setNotice((e as Error).message); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!draft || busy) return;
    setBusy(true); setNotice('');
    try {
      validateCatalog(draft); assertCompatible(baseline,draft);
      if (!user) return;
      const version = await publishCatalog(draft, user.uid);
      await refresh(); await reload(); setNotice(`버전 ${version} 게시 완료 · 앱을 다시 열면 적용돼요.`);
    } catch (e) { setNotice((e as Error).message); }
    finally { setBusy(false); }
  }
  const button = (label:string, onPress:()=>void, primary=false) => <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={{ minHeight:46, justifyContent:'center', alignItems:'center', paddingHorizontal:16, borderRadius:14, backgroundColor:primary?c.primary:c.surface, opacity:busy?0.5:1 }}><Text style={{ color:primary?'#fff':c.primary,fontWeight:'800' }}>{label}</Text></Pressable>;
  const field = (label:string, value:string, change:(v:string)=>void, numeric=false) => <AdminField key={`${selected}:${editingAnimal?.id}:${label}`} label={label} value={value} onChange={change} disabled={busy} numeric={numeric}/>;
  function addCollection() {
    if (!draft) return;
    const id = `event_${draft.collections.length + 1}`;
    const first = draft.collections[0].characters[0];
    const next:CollectionData = { id,name:'새 컬렉션',grade:'E',base:false,hidden:false,characters:[{ ...first,id:`${id}_animal`,name:'새 동물' }],banner:{ title:'새로운 뽑기',tagline:'새 친구를 만나보세요',enabled:false,cost:{ 1:100,10:900 },rates:[{ collection:id,rate:1,hidden:false }],hero:`${id}_animal`,colors:{ background:'#FFF0E9',accent:'#FF5A1F',text:'#3A1A0A' },poster:null } };
    setDraft({ ...draft,collections:[...draft.collections,next] });setSelected(id);setReview(false);
  }
  return <View style={{ flex:1,backgroundColor:c.background }}>
    <Stack.Screen options={{ title:'뽑기 관리',headerShown:true,headerTintColor:c.text,headerStyle:{ backgroundColor:c.background } }} />
    {!role.allowed ? <Text style={{ color:c.secondary,padding:24 }}>{role.loading?'관리자 권한을 확인하고 있어요…':'관리자 계정만 접근할 수 있어요.'}</Text> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding:20,gap:18,maxWidth:900,width:'100%',alignSelf:'center',paddingBottom:50 }}>
      <Text style={{ color:c.text,fontSize:24,fontWeight:'900' }}>뽑기 운영</Text>
      <Text style={{ color:c.secondary,lineHeight:21 }}>이미지·가격·확률을 수정하고 검토 후 게시하세요. 게시 전에는 이용자에게 반영되지 않아요. 컬렉션 안의 동물은 동일한 확률로 추첨돼요.</Text>
      <Text style={{ color:c.secondary }}>현재 게시 버전 {draft?.version ?? 0}</Text>
      {notice !== '' && <Text accessibilityRole="alert" style={{ color:c.primary,lineHeight:22 }}>{notice}</Text>}
      <View style={{ flexDirection:'row',gap:10 }}>{button('컬렉션 선택',()=>setPicker(true))}{button('뽑기 추가',addCollection)}</View>
      {picker && draft && <PagedListSheet title="컬렉션 선택" data={draft.collections} keyExtractor={v=>v.id} onClose={()=>setPicker(false)} renderItem={({ item })=><Pressable accessibilityRole="button" onPress={()=>{setSelected(item.id);setPicker(false);}} style={{ minHeight:52,justifyContent:'center' }}><Text style={{ color:c.text }}>{item.name} · {item.characters.length}종</Text></Pressable>} />}
      {collection && <>
        <Text style={{ color:c.text,fontSize:20,fontWeight:'800' }}>{collection.name}</Text>
        <Text style={{ color:c.secondary,fontSize:12 }}>고정 ID: {collection.id}</Text>
        {field('컬렉션 이름',collection.name,name=>patchCollection({name}))}
        {!baseline?.collections.some(v=>v.id===collection.id) && <View style={{ flexDirection:'row',gap:8,flexWrap:'wrap' }}>{Object.entries(GRADES).map(([grade,v])=><Pressable key={grade} onPress={()=>patchCollection({grade:grade as CollectionData['grade']})} style={{ padding:10,borderRadius:10,backgroundColor:collection.grade===grade?c.primary:c.surface }}><Text style={{ color:collection.grade===grade?'#fff':c.text }}>{v.label}</Text></Pressable>)}</View>}
        {collection.banner ? <>
          <View style={{ flexDirection:'row',alignItems:'center',justifyContent:'space-between' }}><Text style={{ color:c.text,fontWeight:'800' }}>판매 중</Text><Switch value={collection.banner.enabled!==false} onValueChange={enabled=>patchBanner({enabled})} disabled={busy} /></View>
          {field('뽑기 제목',collection.banner.title,title=>patchBanner({title}))}
          {field('소개 문구',collection.banner.tagline,tagline=>patchBanner({tagline}))}
          {field('1회 가격 (코인)',String(collection.banner.cost[1]),v=>patchBanner({cost:{...collection.banner!.cost,1:Number(v)}}),true)}
          {field('10회 가격 (코인)',String(collection.banner.cost[10]),v=>patchBanner({cost:{...collection.banner!.cost,10:Number(v)}}),true)}
          {collection.banner.poster && <Image source={collection.banner.poster} style={{ height:180,width:'100%' }} contentFit="contain" />}
          {button('포스터 이미지 올리기',()=>void upload('poster'))}
          <Text style={{ color:c.text,fontWeight:'800',fontSize:18 }}>컬렉션별 확률</Text>
          <Text style={{ color:c.primary }}>합계 {(collection.banner.rates.reduce((n,r)=>n+r.rate,0)*100).toFixed(4)}%</Text>
          {collection.banner.rates.map((r,index)=><View key={r.collection} style={{ gap:6 }}>{field(`${draft?.collections.find(v=>v.id===r.collection)?.name ?? r.collection} 확률 (%)`,String(Number((r.rate*100).toFixed(6))),v=>patchBanner({rates:collection.banner!.rates.map((rate,i)=>i===index?{...rate,rate:Number(v)/100}:rate)}),true)}{button('확률 항목 제거',()=>patchBanner({rates:collection.banner!.rates.filter((_,i)=>i!==index)}))}</View>)}
          <View style={{ flexDirection:'row',flexWrap:'wrap',gap:8 }}>{draft?.collections.filter(v=>!collection.banner!.rates.some(r=>r.collection===v.id)).map(v=><Pressable key={v.id} onPress={()=>patchBanner({rates:[...collection.banner!.rates,{collection:v.id,rate:0.01,hidden:v.hidden}]})} style={{ padding:10,borderRadius:10,backgroundColor:c.surface }}><Text style={{ color:c.primary }}>+ {v.name}</Text></Pressable>)}</View>
        </> : <Text style={{ color:c.secondary }}>이 컬렉션은 단독 뽑기가 없는 획득 풀입니다.</Text>}
        <Text style={{ color:c.text,fontWeight:'800',fontSize:18 }}>동물 {collection.characters.length}종</Text>
        {button('편집할 동물 선택',()=>setAnimalPicker(true))}
        {animalPicker && <PagedListSheet title="편집할 동물" data={collection.characters} keyExtractor={ch=>ch.id} onClose={()=>setAnimalPicker(false)} renderItem={({item})=><Pressable accessibilityRole="button" onPress={()=>{setAnimalId(item.id);setAnimalPicker(false);}} style={{flexDirection:'row',gap:12,alignItems:'center',minHeight:64}}><Image source={item.thumb} style={{width:52,height:52}} contentFit="contain"/><Text style={{color:c.text}}>{item.name}</Text></Pressable>}/>}
        {editingAnimal && [editingAnimal].map(ch=><View key={ch.id} style={{ gap:8,borderWidth:1,borderColor:c.border,padding:12,borderRadius:16 }}>
          <Image source={ch.thumb} style={{ width:88,height:88 }} contentFit="contain" />
          <Text style={{ color:c.secondary,fontSize:11 }}>{ch.id}</Text>
          {field('동물 이름',ch.name,name=>patchCollection({characters:collection.characters.map(v=>v.id===ch.id?{...v,name}:v)}))}
          {button('동물 이미지 올리기',()=>void upload('animal',ch.id))}
          {field('이미지 주소 (HTTPS 또는 업로드한 이미지)',typeof ch.image==='number'?'':ch.image.uri,uri=>patchCollection({characters:collection.characters.map(v=>v.id===ch.id?{...v,image:{uri},thumb:{uri}}:v)}))}
        </View>)}
        {button('동물 추가',()=>{ const id=`${collection.id}_animal_${collection.characters.length+1}`;patchCollection({characters:[...collection.characters,{...collection.characters[0],id,name:'새 동물'}]}); })}
      </>}
      {button('변경 내용 검토',()=>{try{validateCatalog(draft);assertCompatible(baseline,draft!);setReview(true);setNotice('확률·비용·이미지 주소·기존 데이터 호환성 검사 통과');}catch(e){setNotice((e as Error).message);}})}
      {review && <View style={{ padding:16,borderRadius:16,backgroundColor:c.surface,gap:12 }}><Text style={{ color:c.text,lineHeight:22 }}>게시하면 버전 {(draft?.version??0)+1}로 반영됩니다. 활성 뽑기 {draft?.collections.filter(v=>v.banner&&v.banner.enabled!==false).length}개 · 전체 동물 {draft?.collections.reduce((n,v)=>n+v.characters.length,0)}종</Text>{button(busy?'게시 중…':'검토한 변경 게시',()=>void publish(),true)}</View>}
      {button('게시된 내용으로 다시 불러오기',()=>Alert.alert('변경 내용 되돌리기','저장하지 않은 편집 내용을 버리고 최신 게시본을 불러올까요?',[{text:'취소',style:'cancel'},{text:'다시 불러오기',onPress:()=>void reload().catch(e=>setNotice(e.message))}]))}
    </ScrollView>}
  </View>;
}

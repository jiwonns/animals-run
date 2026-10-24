import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { COLLECTION_DATA } from '@/constants/gacha.generated';
import { rebuildCharacters } from '@/constants/characters';
import { rebuildBanners } from '@/constants/banners';
import { rebuildCollectionMedals } from './medals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { assertCompatible, validateCatalog, type Catalog } from '../../shared/gacha/catalog';

let current: Catalog | null = null;
const CACHE_KEY='gacha:catalog:v1';
export const currentCatalog = () => current;
function install(catalog:Catalog) {
  validateCatalog(catalog);
  COLLECTION_DATA.splice(0,COLLECTION_DATA.length,...catalog.collections);
  rebuildCharacters();rebuildBanners(catalog.banners ?? []);rebuildCollectionMedals();current=catalog;
}
export async function loadRemoteCatalog() {
  if (!current) {
    const cached=await AsyncStorage.getItem(CACHE_KEY).catch(()=>null);
    if(cached)try{install(JSON.parse(cached));}catch{/* Ignore stale/invalid cache. */}
  }
  const snap = await getDoc(doc(db, 'gachaCatalog', 'live'));
  if (!snap.exists()) return current;
  const catalog = snap.data() as Catalog;
  if (!current || catalog.version > current.version) {
    install(catalog);
    await AsyncStorage.setItem(CACHE_KEY,JSON.stringify(catalog)).catch(()=>{});
  }
  return current;
}
export async function publishCatalog(catalog: Catalog, uid: string) {
  validateCatalog(catalog);
  const { compileCatalog } = await import('../../shared/gacha/catalog');
  return runTransaction(db, async tx => {
    const ref = doc(db, 'gachaCatalog', 'live');
    const snap = await tx.get(ref);
    const before = snap.exists() ? snap.data() as Catalog : null;
    const version = before?.version ?? 0;
    if (catalog.version !== version) throw new Error('다른 변경이 먼저 게시됐어요. 최신 내용을 다시 불러와주세요.');
    assertCompatible(before, catalog);
    const compiled = compileCatalog(catalog);
    const previous = before ? compileCatalog(before) : null;
    let writes = 2;
    for (const c of compiled.characters) {
      if (JSON.stringify(previous?.characters.find(p => p.id === c.id)) !== JSON.stringify(c)) { tx.set(doc(db,'gachaCharacters',c.id),c); writes++; }
    }
    for (const c of compiled.collections) { tx.set(doc(db,'gachaCollections',c.id),c); writes++; }
    for (const b of compiled.banners) { tx.set(doc(db,'gachaBanners',b.id),{ ...b,version:version+1 }); writes++; }
    if (writes > 450) throw new Error('한 번에 추가하는 항목이 너무 많아요. 나눠서 추가해주세요.');
    const gradeIds=Object.fromEntries(['N','R','EP','U','L','E','H'].map(grade=>[grade,catalog.collections.filter(c=>c.grade===grade).flatMap(c=>c.characters.map(ch=>ch.id))]));
    const next = { schema:1,editorVersion:2,version:version+1,collections:catalog.collections,banners:catalog.banners ?? [],gradeIds,updatedBy:uid,updatedAt:serverTimestamp() };
    tx.set(ref,next);
    tx.set(doc(db,'gachaCatalogVersions',String(version+1)),next);
    return version+1;
  });
}

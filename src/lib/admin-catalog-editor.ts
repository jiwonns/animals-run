import type { Catalog } from '../../shared/gacha/catalog';
import { catalogBanners } from '../../shared/gacha/catalog';
import { DRAW_GRADES, gradeRates } from '../../shared/gacha/draw-pools';
import type { CatalogBanner, CollectionData, GachaImage, Grade } from '@/constants/gacha-types';

export type StoredAnimal = CollectionData['characters'][number] & {grade:Grade;eligible:boolean};
export function storedAnimals(catalog:Catalog): StoredAnimal[] {
  return catalog.collections.flatMap(c=>c.characters.map(ch=>({...ch,grade:c.grade,
    eligible:c.id!=='baby' && (!c.acquisition || c.acquisition==='draw')})));
}
export function selectedAnimalIds(catalog:Catalog,banner:CatalogBanner): string[] {
  return banner.characterIds ?? catalog.collections.filter(c=>banner.rates.some(r=>r.collection===c.id)).flatMap(c=>c.characters.map(ch=>ch.id));
}
export function bannerWeights(catalog:Catalog,banner:CatalogBanner): Partial<Record<Grade,number>> {
  return Object.fromEntries(DRAW_GRADES.map(g=>[g,banner.rates.filter(r=>catalog.collections.find(c=>c.id===r.collection)?.grade===g).reduce((n,r)=>n+r.rate,0)]));
}
export function putBanner(catalog:Catalog,banner:CatalogBanner): Catalog {
  const {id,...data}=banner;
  if(catalog.collections.some(c=>c.id===id && c.banner))return {...catalog,collections:catalog.collections.map(c=>c.id===id?{...c,banner:data}:c)};
  return {...catalog,banners:[...(catalog.banners??[]).filter(b=>b.id!==id),banner]};
}
export function selectAnimals(catalog:Catalog,banner:CatalogBanner,ids:string[]): CatalogBanner {
  const animals=storedAnimals(catalog);
  const selected=[...new Set(ids)].filter(id=>animals.some(ch=>ch.id===id && ch.eligible));
  const weights=bannerWeights(catalog,banner);
  const grades=new Set(animals.filter(ch=>selected.includes(ch.id)).map(ch=>ch.grade));
  const total=[...grades].reduce((n,g)=>n+(weights[g] || 1),0);
  const normalized=Object.fromEntries([...grades].map(g=>[g,(weights[g] || 1)/total]));
  return {...banner,characterIds:selected,hero:selected.includes(banner.hero)?banner.hero:selected[0]??banner.hero,
    rates:gradeRates(catalog.collections,normalized,undefined,selected)};
}
export function setGradeWeight(catalog:Catalog,banner:CatalogBanner,grade:Grade,weight:number): CatalogBanner {
  const ids=selectedAnimalIds(catalog,banner);
  return {...banner,characterIds:ids,rates:gradeRates(catalog.collections,{...bannerWeights(catalog,banner),[grade]:weight},undefined,ids)};
}
export function newBanner(catalog:Catalog,id:string): CatalogBanner {
  const first=storedAnimals(catalog).find(ch=>ch.eligible);
  if(!first)throw new Error('먼저 동물을 등록해주세요.');
  if(catalogBanners(catalog).some(b=>b.id===id))throw new Error('뽑기가 이미 있어요.');
  return {id,title:'새 뽑기',tagline:'',enabled:true,cost:{1:5,10:45},hero:first.id,characterIds:[],rates:[],
    colors:{background:'#FFF3E7',accent:'#FB7103',text:'#3A1A0A'},poster:null};
}
export function registerAnimal(catalog:Catalog,input:{id:string;name:string;grade:Grade;image:GachaImage}): Catalog {
  if(!input.name.trim())throw new Error('동물 이름을 입력해주세요.');
  if(storedAnimals(catalog).some(ch=>ch.id===input.id))throw new Error('이미 등록된 동물이에요.');
  const prefix=`admin_${input.grade.toLowerCase()}`;
  const group=catalog.collections.find(c=>c.id.startsWith(prefix+'_') && c.grade===input.grade && c.acquisition==='draw' && !c.banner && c.characters.length<100);
  let id=group?.id ?? `${prefix}_${catalog.collections.length}`;
  while(!group && catalog.collections.some(c=>c.id===id))id+='_new';
  const animal={id:input.id,name:input.name.trim(),species:input.id,image:input.image,thumb:input.image};
  return {...catalog,collections:group?catalog.collections.map(c=>c.id===id?{...c,characters:[...c.characters,animal]}:c):
    [...catalog.collections,{id,name:'등록 동물',grade:input.grade,acquisition:'draw',base:false,hidden:false,banner:null,characters:[animal]}]};
}

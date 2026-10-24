import { CHARACTER_BY_ID, type Character } from './characters';
import { COLLECTION_DATA } from './gacha.generated';
import type { CatalogBanner, GachaImage } from './gacha-types';
import { pickByGrade } from '../../shared/gacha/draw-pools';
import { catalogBanners } from '../../shared/gacha/catalog';
export type DrawCount = 1 | 10;
export type Banner = {
  id: string; title: string; tagline: string; cost: Record<DrawCount,number>;
  rates: {collection:string;rate:number;hidden:boolean}[]; characterIds?: string[];
  hero: Character; poster: {background:string;accent:string;text:string;image:GachaImage|null};
};
let additionalBanners: CatalogBanner[] = [];
function listBanners(): Banner[] {
  return catalogBanners({schema:1,version:0,collections:COLLECTION_DATA,banners:additionalBanners})
    .filter(b=>b.enabled!==false).map(b=>({id:b.id,title:b.title,tagline:b.tagline,cost:b.cost,rates:b.rates,
      ...(b.characterIds ? {characterIds:b.characterIds} : {}),hero:CHARACTER_BY_ID[b.hero],poster:{...b.colors,image:b.poster}}));
}
export const BANNERS: Banner[] = listBanners();
export function rebuildBanners(extra?: CatalogBanner[]) {
  if (extra) additionalBanners = extra;
  BANNERS.splice(0,BANNERS.length,...listBanners());
}
export function pickFromBanner(banner: Banner): Character {
  return CHARACTER_BY_ID[pickByGrade(COLLECTION_DATA,banner.rates,Math.random,banner.characterIds).id];
}

import type { CollectionData, Grade } from '../../src/constants/gacha-types';
export const DRAW_GRADES: Grade[];
export function drawGrade(grade: Grade): Grade;
export function gradeRates(collections: CollectionData[], weights: Partial<Record<Grade,number>>, collectionIds?: string[], characterIds?: string[]): {collection:string;rate:number;hidden:boolean}[];
export function pickByGrade(collections: CollectionData[], rates: {collection:string;rate:number}[], random?:()=>number, characterIds?: string[]): CollectionData['characters'][number];

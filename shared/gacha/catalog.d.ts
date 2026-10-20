import type { CollectionData } from '../../src/constants/gacha-types';
export type Catalog = { schema: 1; version: number; collections: CollectionData[] };
export function validateCatalog(value: unknown): { collections: Map<string, CollectionData>; characters: Map<string, CollectionData['characters'][number] & { collection: string; grade: import('../../src/constants/gacha-types').Grade }> };
export function assertCompatible(before: Catalog | null, after: Catalog): void;
export function compileCatalog(value: Catalog): { characters: {id:string;grade:string;collection:string}[]; collections: {id:string;characterIds:string[]}[]; banners: {id:string;cost1:number;cost10:number;poolRegex:string;enabled:boolean;ticketable:boolean}[] };

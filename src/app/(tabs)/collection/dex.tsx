import { useListWindow } from '@/hooks/use-list-window';
import { useCatalog } from '@/providers/catalog-provider';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { CharacterCard } from '@/components/character-card';
import { MedalClaim } from '@/components/medal-claim';
import { useMedals } from '@/hooks/use-medals';
import { COLLECTION_MEDALS } from '@/lib/medals';
import { GradeBadge } from '@/components/grade-badge';
import { RunningLoader } from '@/components/running-loader';
import { CHARACTERS, charactersIn, COLLECTIONS, GRADE_ORDER, GRADES } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import { useGridCellWidth } from '@/hooks/use-grid-cell-width';
import { useSession } from '@/providers/session-provider';

const COLUMNS = 3;
const PADDING = 20;
const GAP = 12;

export default function DexScreen() {
  useCatalog();
  const colors = useColors();
  const cellWidth = useGridCellWidth(COLUMNS, PADDING, GAP);
  const { user, profile } = useSession();
  const { claimed, failed } = useMedals(user?.uid);
  const owned = profile?.characters ?? {};
  const isOwned = (id: keyof typeof owned) => (owned[id] ?? 0) > 0;
  const progress = (list: typeof CHARACTERS) => `${list.filter((c) => isOwned(c.id)).length} / ${list.length}`;

  type Row = { key:string; render:()=>React.ReactElement };
  const rows:Row[]=[];
  for(const grade of GRADE_ORDER){
    const members=CHARACTERS.filter(c=>c.grade===grade);
    rows.push({key:'grade:'+grade,render:()=> <View style={[styles.gradeHeader,{borderColor:GRADES[grade].color}]}><GradeBadge grade={grade}/><Text style={[styles.gradeTitle,{color:colors.text}]}>{GRADES[grade].label}</Text><Text style={{color:colors.secondary}}>{progress(members)}</Text></View>});
    for(const collection of COLLECTIONS.filter(c=>c.grade===grade)){
      const characters=charactersIn(collection.id);
      rows.push({key:'collection:'+collection.id,render:()=> <View style={styles.collectionHeader}><Text style={[styles.collectionTitle,{color:colors.text}]}>{collection.name}</Text><Text style={{color:colors.secondary}}>{progress(characters)}</Text></View>});
      for(let i=0;i<characters.length;i+=COLUMNS){
        const group=characters.slice(i,i+COLUMNS);
        rows.push({key:collection.id+':'+i,render:()=> <View style={{flexDirection:'row',gap:GAP}}>{group.map(character=><CharacterCard key={character.id} character={character} width={cellWidth} owned={isOwned(character.id)}/>)}</View>});
      }
      const medal=COLLECTION_MEDALS.find(m=>m.id==='collection_complete:'+collection.id);
      if(medal)rows.push({key:'medal:'+collection.id,render:()=> <MedalClaim medal={medal} claimed={claimed}/>});
    }
  }
  const page=useListWindow(rows,user?.uid??'');
  if (!profile) return <RunningLoader label="??? ??? ?" style={styles.loading}/>;
  return <FlatList style={{backgroundColor:colors.background}} data={page.data} keyExtractor={r=>r.key} renderItem={({item})=>item.render()}
    contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{padding:PADDING,gap:14,paddingBottom:32}}
    initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} onEndReachedThreshold={0.4} onEndReached={page.loadMore}
    ListHeaderComponent={<View style={{gap:10}}><Text style={[styles.total,{color:colors.secondary}]}>?? {progress(CHARACTERS)}</Text>{failed&&<Text style={{color:colors.secondary}}>??? ???? ????. ??? ??????.</Text>}</View>}/>;
}

const styles = StyleSheet.create({
  loading: {
    marginTop: 48,
  },
  content: {
    paddingHorizontal: PADDING,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 32,
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: -16,
  },
  gradeSection: {
    gap: 20,
  },
  gradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 2,
    paddingBottom: 8,
  },
  gradeTitle: {
    fontSize: 22,
    fontWeight: '900',
    flex: 1,
  },
  collection: {
    gap: 12,
  },
  collectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  collectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  progress: {
    fontSize: 14,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
});

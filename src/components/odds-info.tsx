import { ScrollView } from '@/components/refreshable';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLLECTIONS, GRADES } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';
import type { Odds } from '@/lib/craft';

export type OddsRow = { key: string; label: string; chance: number; color?: string };

export const formatChance = (n: number) => `${Number((n * 100).toFixed(2))}%`;

/** One row per collection, in collection order, so the popup says "레어 컬렉션 12종" rather than naming animals. */
export function rowsByCollection(odds: Odds): OddsRow[] {
  return COLLECTIONS.flatMap((collection) => {
    const inCollection = odds.filter((o) => o.character.collection === collection.id);
    if (!inCollection.length) return [];
    return [
      {
        key: collection.id,
        label: `${collection.name} ${inCollection.length}종`,
        chance: inCollection.reduce((sum, o) => sum + o.chance, 0),
        color: GRADES[collection.grade].color,
      },
    ];
  });
}

/** A small "확률 정보" pill that opens the odds in a popup. */
export function OddsButton({ title, rows, notes = [] }: { title: string; rows: OddsRow[]; notes?: string[] }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.pill, { borderColor: colors.border }, pressed && styles.pressed]}>
        <View style={[styles.info, { borderColor: colors.secondary }]}>
          <Text style={[styles.infoMark, { color: colors.secondary }]}>i</Text>
        </View>
        <Text style={[styles.pillLabel, { color: colors.secondary }]}>확률 정보</Text>
      </Pressable>

      <Modal visible={open} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.card, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
              {rows.filter(row=>row.chance>0).map((row) => (
                <View key={row.key} style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: row.color ?? colors.border }]} />
                  <Text style={[styles.label, { color: colors.text }]}>{row.label}</Text>
                  <Text style={[styles.chance, { color: colors.text }]}>{formatChance(row.chance)}</Text>
                </View>
              ))}
              {notes.map((note) => (
                <Text key={note} style={[styles.note, { color: colors.secondary }]}>
                  {note}
                </Text>
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={({ pressed }) => [styles.close, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
              <Text style={[styles.closeLabel, { color: colors.text }]}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  info: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoMark: {
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    borderRadius: 20,
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  scroll: {
    flexGrow: 0,
  },
  body: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  chance: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
  },
  close: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});

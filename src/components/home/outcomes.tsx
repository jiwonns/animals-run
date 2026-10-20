import { Image, type ImageStyle } from '@/components/gacha-image';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp } from 'react-native';

import type { Character, CharacterId } from '@/constants/characters';
import { useColors } from '@/hooks/use-colors';

/** A character's picture, or only its silhouette until the player owns one, so results stay a surprise. */
export function MysteryImage({ character, revealed, style, small = false }: {
  character: Character;
  revealed: boolean;
  style: StyleProp<ImageStyle>;
  /** Uses the thumbnail, for small sizes. */
  small?: boolean;
}) {
  const colors = useColors();
  return (
    <Image
      source={small ? character.thumb : character.image}
      style={style}
      contentFit="contain"
      tintColor={revealed ? undefined : colors.secondary}
      accessibilityLabel={revealed ? character.name : '아직 모르는 동물'}
    />
  );
}

type OutcomesProps = {
  characters: Character[];
  owned: Partial<Record<CharacterId, number>>;
};

/** The animals a craft can produce, as a wrapping row of small pictures or silhouettes. */
export const Outcomes = memo(
  function Outcomes({ characters, owned }: OutcomesProps) {
    return (
      <View style={styles.row}>
        {characters.map((c) => (
          <MysteryImage key={c.id} character={c} revealed={(owned[c.id] ?? 0) > 0} style={styles.image} small />
        ))}
      </View>
    );
  },
  // Picking another input often leaves the possible results unchanged; skip redrawing them then.
  (a: OutcomesProps, b: OutcomesProps) =>
    a.owned === b.owned
    && a.characters.length === b.characters.length
    && a.characters.every((c, i) => c.id === b.characters[i].id),
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  image: {
    width: 36,
    height: 36,
  },
});

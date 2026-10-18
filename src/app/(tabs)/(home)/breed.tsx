import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GradeBadge } from '@/components/grade-badge';
import { Outcomes } from '@/components/home/outcomes';
import { Icon, ICONS } from '@/components/icon';
import { formatChance, OddsButton, rowsByCollection } from '@/components/odds-info';
import { CHARACTER_BY_ID, CHARACTERS, GRADE_ORDER, GRADES, type CharacterId } from '@/constants/characters';
import { REWARDS } from '@/constants/gacha.generated';
import { useColors } from '@/hooks/use-colors';
import { useGridCellWidth } from '@/hooks/use-grid-cell-width';
import { useEggs } from '@/hooks/use-home';
import { breedOdds } from '@/lib/craft';
import { canBreed, EGG_SLOTS, hatchMinutes, layEgg } from '@/lib/home';
import { useSession } from '@/providers/session-provider';

const COLUMNS = 4;
const PADDING = 20;
const GAP = 10;
const breedableLabel = GRADE_ORDER.filter(canBreed)
  .map((g) => GRADES[g].label)
  .join('·');
const babyRate = REWARDS.breeding.baby?.rate ?? 0;

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

export default function BreedScreen() {
  const colors = useColors();
  const cellWidth = useGridCellWidth(COLUMNS, PADDING, GAP);
  const { user, profile } = useSession();
  const eggs = useEggs();
  const [picked, setPicked] = useState<CharacterId[]>([]);
  const [saving, setSaving] = useState(false);

  const [highFirst, setHighFirst] = useState(false);
  const owned = CHARACTERS.filter((c) => (profile?.characters[c.id] ?? 0) > 0).sort(
    (a, b) =>
      Number(canBreed(b.grade)) - Number(canBreed(a.grade)) ||
      (GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade)) * (highFirst ? -1 : 1),
  );
  const freeSlot = eggs ? EGG_SLOTS.find((slot) => !eggs[slot]) : undefined;
  const odds = picked.length === 2 ? breedOdds([picked[0], picked[1]]) : null;

  function toggle(id: CharacterId) {
    if (picked.includes(id)) {
      setPicked(picked.filter((p) => p !== id));
    } else if (picked.length < 2 && canBreed(CHARACTER_BY_ID[id].grade)) {
      setPicked([...picked, id]);
    }
  }

  async function breed() {
    if (!user || picked.length !== 2 || !freeSlot || saving) return;
    setSaving(true);
    try {
      await layEgg(user.uid, freeSlot, [picked[0], picked[1]]);
      router.back();
    } catch {
      Alert.alert('교배하지 못했어요', '잠시 후 다시 시도해주세요.');
      setSaving(false);
    }
  }

  const disabled = picked.length !== 2 || !freeSlot || saving;
  const buttonLabel = eggs && !freeSlot ? '교배장이 가득 찼어요' : picked.length < 2 ? `동물 ${2 - picked.length}마리를 골라주세요` : '교배하기';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={[styles.pair, { backgroundColor: colors.surface }]}>
          {[0, 1].map((i) => {
            const id = picked[i];
            const character = id ? CHARACTER_BY_ID[id] : undefined;
            return (
              <View key={i} style={styles.parentWrap}>
                {i === 1 && (
                  <View style={styles.heart}>
                    <Icon name={ICONS.heart} size={18} color="#F472B6" />
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={character ? `${character.name} 빼기` : '빈 자리'}
                  disabled={!id}
                  onPress={() => id && toggle(id)}
                  style={[styles.parent, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  {character ? (
                    <>
                      <Image source={character.thumb} style={styles.parentImage} contentFit="contain" />
                      <Text style={[styles.parentName, { color: colors.text }]} numberOfLines={1}>
                        {character.name}
                      </Text>
                    </>
                  ) : (
                    <Icon name={ICONS.plus} size={24} color={colors.secondary} />
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={[styles.preview, { borderColor: colors.border }]}>
          <View style={styles.previewHeader}>
            <Text style={[styles.previewTitle, { color: colors.text }]}>태어날 수 있는 동물</Text>
            <OddsButton
              title="교배 확률"
              rows={odds ? rowsByCollection(odds) : []}
              notes={[
                ...(odds ? [] : ['두 마리를 고르면 그 조합의 확률을 보여드려요.']),
                ...(babyRate ? [`${formatChance(babyRate)} 확률로 부모 중 1마리를 닮은 아기 동물이 태어나요.`] : []),
                '나머지는 부모 중 1마리를 랜덤으로 골라, 그 동물의 등급 이하인 동물 중에서 태어나요.',
                `부모와 같은 등급은 ${formatChance(REWARDS.breeding.sameTier)}이고, 낮은 등급일수록 더 잘 나와요.`,
                '같은 컬렉션 안의 동물은 모두 같은 확률이에요.',
              ]}
            />
          </View>
          {!odds ? (
            <Text style={[styles.previewHint, { color: colors.secondary }]}>
              두 마리를 고르면 나올 수 있는 동물을 보여드려요. 부모는 사라지지 않고, {breedableLabel} 등급만 교배할 수
              있어요. 가끔 부모를 닮은 아기 동물이 태어나요.
            </Text>
          ) : (
            <>
              <Outcomes characters={odds.map((o) => o.character)} owned={profile?.characters ?? {}} />
              <Text style={[styles.previewHint, { color: colors.secondary }]}>
                부화{' '}
                {GRADE_ORDER.filter((g) => odds.some((o) => o.character.grade === g))
                  .map((g) => `${GRADES[g].label} ${formatMinutes(hatchMinutes(g))}`)
                  .join(' · ')}
              </Text>
            </>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>내 동물</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setHighFirst((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [styles.sort, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
            <Icon name={ICONS.sort} size={14} color={colors.secondary} />
            <Text style={[styles.sortLabel, { color: colors.secondary }]}>
              {highFirst ? '높은 등급순' : '낮은 등급순'}
            </Text>
          </Pressable>
        </View>
        {owned.length === 0 ? (
          <Text style={[styles.previewHint, { color: colors.secondary }]}>
            아직 가진 동물이 없어요.
          </Text>
        ) : (
          <View style={styles.grid}>
            {owned.map((character) => {
              const have = profile?.characters[character.id] ?? 0;
              const selected = picked.includes(character.id);
              const blocked = !canBreed(character.grade);
              return (
                <Pressable
                  key={character.id}
                  accessibilityRole="button"
                  accessibilityLabel={blocked ? `${character.name}, 교배 불가` : character.name}
                  accessibilityState={{ selected, disabled: blocked }}
                  disabled={blocked}
                  onPress={() => toggle(character.id)}
                  style={({ pressed }) => [
                    styles.cell,
                    {
                      width: cellWidth,
                      height: cellWidth / 0.8,
                      backgroundColor: colors.surface,
                      borderColor: selected ? colors.primary : 'transparent',
                    },
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.cellBody, blocked && styles.blocked]}>
                    <Image source={character.thumb} style={styles.cellImage} contentFit="contain" />
                    <Text style={[styles.cellName, { color: colors.text }]} numberOfLines={1}>
                      {character.name}
                    </Text>
                    <View style={styles.badge}>
                      <GradeBadge grade={character.grade} />
                    </View>
                  </View>
                  {blocked ? (
                    <View style={[styles.blockedTag, { backgroundColor: colors.background }]}>
                      <Text style={[styles.blockedLabel, { color: colors.secondary }]}>교배 불가</Text>
                    </View>
                  ) : selected ? (
                    <View style={[styles.check, { backgroundColor: colors.primary }]}>
                      <Text style={styles.checkLabel}>✓</Text>
                    </View>
                  ) : (
                    <Text style={[styles.have, { color: colors.secondary }]}>×{have}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={breed}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: disabled ? colors.border : colors.primary },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.buttonLabel, disabled && { color: colors.secondary }]}>
            {saving ? '알을 받는 중…' : buttonLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: PADDING,
    gap: 16,
  },
  pair: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderRadius: 20,
    padding: 16,
    gap: 28,
  },
  parentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    position: 'absolute',
    left: -24,
  },
  parent: {
    width: 104,
    height: 120,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  parentImage: {
    width: 76,
    height: 76,
  },
  parentName: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  preview: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  previewHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
  },
  cellBody: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  blocked: {
    opacity: 0.35,
  },
  blockedTag: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  blockedLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  cellImage: {
    width: '78%',
    aspectRatio: 1,
  },
  cellName: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: 4,
    left: 4,
    transform: [{ scale: 0.8 }],
  },
  have: {
    position: 'absolute',
    top: 5,
    right: 7,
    fontSize: 10,
    fontWeight: '700',
  },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  footer: {
    paddingHorizontal: PADDING,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});

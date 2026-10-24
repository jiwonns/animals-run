import { ScrollView } from '@/components/refreshable';
import { Image } from '@/components/gacha-image';
import { router, type Href } from 'expo-router';
import { useRef, useState } from "react";
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GRADES, type Character } from "@/constants/characters";
import { useColors } from "@/hooks/use-colors";
import { HomeError } from "@/lib/home";
import { availableCopies, SALE_PRICES } from "@/lib/inventory";
import { sellCharacters } from "@/lib/sell";
import { useSession } from "@/providers/session-provider";

export function SellSheet({
  character,
  onClose,
}: {
  character: Character;
  onClose: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useSession();
  const [selected, setSelected] = useState(1);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const maximum = availableCopies(profile, character.id);
  const quantity = Math.min(selected, maximum);
  const price = SALE_PRICES[character.grade];
  const total = price * quantity;
  const reserved = profile?.avatar === character.id;
  const close = () => {
    if (!lock.current) onClose();
  };
  async function sell() {
    if (!user || lock.current || !quantity) return;
    lock.current = true;
    setBusy(true);
    try {
      const earned = await sellCharacters(user.uid, character.id, quantity);
      onClose();
      Alert.alert(
        price === 0 ? "정리 완료" : "판매 완료",
        `${character.name} ${quantity}마리${price === 0 ? "를 정리했어요. 지급 코인은 0코인이에요." : `를 판매하고 ${earned}코인을 받았어요.`}`,
      );
    } catch (error) {
      Alert.alert(
        "판매하지 못했어요",
        error instanceof HomeError
          ? error.message
          : "연결 상태를 확인하고 다시 시도해주세요.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function confirm() {
    if (!quantity || busy) return;
    Alert.alert(
      price === 0 ? "0코인으로 정리할까요?" : `${total}코인에 판매할까요?`,
      `${character.name} ${quantity}마리가 보관함에서 사라져요.${price === 0 ? "\n노말 등급은 코인이 지급되지 않아요." : ""}`,
      [
        { text: "취소", style: "cancel" },
        { text: price === 0 ? "정리하기" : "판매하기", onPress: sell },
      ],
    );
  }
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "#0006",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="판매 창 닫기"
          onPress={close}
          style={{ flex: 1 }}
        />
        <View
          style={{
            backgroundColor: c.background,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            maxHeight: "85%",
            paddingBottom: Math.max(20, insets.bottom),
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: c.text, fontSize: 22, fontWeight: "900" }}>
                동물 판매
              </Text>
              <Pressable
                onPress={close}
                disabled={busy}
                style={{ padding: 10 }}
              >
                <Text style={{ color: c.secondary }}>닫기</Text>
              </Pressable>
            </View>
            <View
              style={{
                alignItems: "center",
                gap: 8,
                backgroundColor: c.surface,
                borderRadius: 24,
                padding: 20,
              }}
            >
              <Image
                source={character.thumb}
                style={{ width: 115, height: 115 }}
                contentFit="contain"
              />
              <Text style={{ color: c.text, fontSize: 19, fontWeight: "800" }}>
                {character.name}
              </Text>
              <Text
                style={{
                  color: GRADES[character.grade].color,
                  fontWeight: "700",
                }}
              >
                {GRADES[character.grade].label} · 1마리당 {price}코인
              </Text>
            </View>
            <Text style={{ color: c.secondary, lineHeight: 21 }}>
              보유 {profile?.characters[character.id] ?? 0}마리 · 판매 가능{" "}
              {maximum}마리
              {reserved ? "\n대표 동물 1마리는 함께 걸어야 해서 남겨둬요." : ""}
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="판매 수량 줄이기"
                disabled={busy || quantity <= 1}
                onPress={() => setSelected(Math.max(1, quantity - 1))}
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: c.surface,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: quantity <= 1 ? 0.4 : 1,
                }}
              >
                <Text style={{ color: c.text, fontSize: 25 }}>−</Text>
              </Pressable>
              <Text
                style={{
                  flex: 1,
                  textAlign: "center",
                  color: c.text,
                  fontSize: 23,
                  fontWeight: "900",
                }}
              >
                {quantity}마리
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="판매 수량 늘리기"
                disabled={busy || quantity >= maximum}
                onPress={() => setSelected(Math.min(maximum, quantity + 1))}
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: c.surface,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: quantity >= maximum ? 0.4 : 1,
                }}
              >
                <Text style={{ color: c.text, fontSize: 25 }}>+</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy || !maximum}
                onPress={() => setSelected(maximum)}
                style={{
                  padding: 13,
                  backgroundColor: c.surface,
                  borderRadius: 15,
                }}
              >
                <Text style={{ color: c.primary, fontWeight: "800" }}>
                  최대
                </Text>
              </Pressable>
            </View>
            {price === 0 && (
              <Text
                style={{ color: c.primary, fontWeight: "700", lineHeight: 21 }}
              >
                노말 동물은 0코인이에요. 수량 정리만 진행됩니다.
              </Text>
            )}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !quantity}
            onPress={() => {
              onClose();
              router.push(`/auction/${character.id}?offer=sell` as Href);
            }}
            style={{
              marginHorizontal: 24,
              marginBottom: 10,
              backgroundColor: c.surface,
              borderRadius: 18,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: c.text, fontWeight: '800' }}>경매장에 올리기</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !quantity || !user}
            onPress={confirm}
            style={{
              marginHorizontal: 24,
              backgroundColor: quantity && !busy ? c.primary : c.surface,
              borderRadius: 18,
              minHeight: 54,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: quantity && !busy ? "#fff" : c.secondary,
                fontWeight: "800",
                fontSize: 16,
              }}
            >
              {busy
                ? "처리 중…"
                : !quantity
                  ? "판매할 수 있는 동물이 없어요"
                  : price === 0
                    ? `${quantity}마리 정리 · 0코인`
                    : `${quantity}마리 판매 · ${total.toLocaleString()}코인 받기`}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

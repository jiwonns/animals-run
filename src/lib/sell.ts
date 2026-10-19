import { runTransaction } from "firebase/firestore";
import { CHARACTER_BY_ID, type CharacterId } from "@/constants/characters";
import { db } from "./firebase";
import { HomeError } from "./home";
import { availableCopies, SALE_PRICES } from "./inventory";
import { profileRef, type Profile } from "./profile";

export function sellCharacters(uid: string, id: CharacterId, quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || !CHARACTER_BY_ID[id])
    throw new HomeError("판매 수량을 확인해주세요.");
  return runTransaction(db, async (tx) => {
    const ref = profileRef(uid);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new HomeError("프로필을 찾을 수 없어요.");
    const profile = snapshot.data() as Profile;
    if (quantity > availableCopies(profile, id))
      throw new HomeError(
        "보유 수량이 바뀌었어요. 대표 동물 1마리는 남겨두고 판매 수량을 다시 골라주세요.",
      );
    const characters = { ...profile.characters };
    const remaining = (characters[id] ?? 0) - quantity;
    if (remaining) characters[id] = remaining;
    else delete characters[id];
    const coins = SALE_PRICES[CHARACTER_BY_ID[id].grade] * quantity;
    tx.update(ref, {
      characters,
      coins: profile.coins + coins,
      lastSale: { character: id, quantity },
    });
    return coins;
  });
}

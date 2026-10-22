import { CHARACTER_BY_ID, type CharacterId } from '@/constants/characters';
import { loadGachaImage } from './gacha-images';

// The browser can display the cached thumbnail URL directly, without decoding and re-encoding a PNG.
export async function avatarDataUri(id: CharacterId): Promise<string> {
  const image = CHARACTER_BY_ID[id]?.thumb;
  if (!image || typeof image === 'number') throw new Error('지도 동물 이미지를 찾을 수 없어요.');
  return loadGachaImage(image.uri);
}

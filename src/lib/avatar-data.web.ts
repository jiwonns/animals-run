import { Asset } from 'expo-asset';

import { FACE_CROP } from '@/components/avatar-face';
import { CHARACTER_BY_ID, type CharacterId } from '@/constants/characters';

const FACE_SIZE = 128;
const cache = new Map<CharacterId, Promise<string>>();

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

/** A character's face cut out as a small PNG data: URI for the map iframe, cropped on a canvas. */
export function avatarDataUri(id: CharacterId): Promise<string> {
  let uri = cache.get(id);
  if (!uri) {
    uri = (async () => {
      const character = CHARACTER_BY_ID[id];
      if (!character) throw new Error(`Unknown character ${id}`);
      const image = await loadImage(Asset.fromModule(character.thumb).uri);
      const side = image.naturalWidth * FACE_CROP.size;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = FACE_SIZE;
      canvas
        .getContext('2d')
        ?.drawImage(
          image,
          image.naturalWidth * FACE_CROP.x,
          image.naturalHeight * FACE_CROP.y,
          side,
          side,
          0,
          0,
          FACE_SIZE,
          FACE_SIZE,
        );
      return canvas.toDataURL('image/png');
    })();
    uri.catch(() => cache.delete(id));
    cache.set(id, uri);
  }
  return uri;
}

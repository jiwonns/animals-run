import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { FACE_CROP } from '@/components/avatar-face';
import { CHARACTER_BY_ID, type CharacterId } from '@/constants/characters';

const FACE_SIZE = 128;
const cache = new Map<CharacterId, Promise<string>>();

/**
 * A character's face cut out as a small PNG data: URI, for web content (the map) that can't load bundled
 * assets. Loads through expo-image, since release Android builds keep images as resources, not files.
 */
export function avatarDataUri(id: CharacterId): Promise<string> {
  let uri = cache.get(id);
  if (!uri) {
    uri = (async () => {
      const character = CHARACTER_BY_ID[id];
      if (!character) throw new Error(`Unknown character ${id}`);
      const source = await Image.loadAsync(character.thumb);
      const side = Math.floor(source.width * FACE_CROP.size);
      const face = await ImageManipulator.manipulate(source)
        .crop({
          originX: Math.floor(source.width * FACE_CROP.x),
          originY: Math.floor(source.height * FACE_CROP.y),
          width: side,
          height: side,
        })
        .resize({ width: FACE_SIZE, height: FACE_SIZE })
        .renderAsync();
      const { base64 } = await face.saveAsync({ base64: true, format: SaveFormat.PNG });
      if (!base64) throw new Error(`No image data for ${id}`);
      return `data:image/png;base64,${base64}`;
    })();
    uri.catch(() => cache.delete(id));
    cache.set(id, uri);
  }
  return uri;
}

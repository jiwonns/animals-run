import type { ImagePickerAsset } from "expo-image-picker";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export type DraftPhoto = {
  uri: string;
  data: string;
  width: number;
  height: number;
};
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_DATA = 350_000;
export const photoRef = (postId: string, photoId: string) =>
  doc(db, "communityPosts", postId, "photos", photoId);

export async function preparePhoto(
  asset: ImagePickerAsset,
): Promise<DraftPhoto> {
  const { ImageManipulator, SaveFormat } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Keep loading within the photo error handler.
    require("expo-image-manipulator") as typeof import("expo-image-manipulator");
  for (const edge of [1200, 960, 720, 480]) {
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > edge)
      context.resize(
        asset.width >= asset.height ? { width: edge } : { height: edge },
      );
    const image = await context.renderAsync();
    const result = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.65,
      base64: true,
    });
    context.release();
    image.release();
    const data = result.base64 ? `data:image/jpeg;base64,${result.base64}` : "";
    if (data && data.length <= MAX_PHOTO_DATA)
      return {
        uri: result.uri,
        data,
        width: result.width,
        height: result.height,
      };
  }
  throw new Error("이 사진은 용량을 줄이지 못했어요. 다른 사진을 골라주세요.");
}

const cache = new Map<string, Promise<string>>();
export function loadPostPhoto(postId: string, photoId: string) {
  const key = `${postId}/${photoId}`;
  let promise = cache.get(key);
  if (!promise) {
    promise = getDoc(photoRef(postId, photoId)).then((snapshot) => {
      if (!snapshot.exists() || typeof snapshot.data().data !== "string")
        throw new Error("사진을 찾을 수 없어요.");
      return snapshot.data().data as string;
    });
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
    if (cache.size > 24) cache.delete(cache.keys().next().value!);
  }
  return promise;
}

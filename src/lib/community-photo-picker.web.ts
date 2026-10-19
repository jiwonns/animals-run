import { launchImageLibraryAsync } from "expo-image-picker";

export async function pickCommunityPhotos(maximum: number) {
  const result = await launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: maximum,
    quality: 1,
    exif: false,
  });
  return result.canceled ? [] : result.assets.slice(0, maximum);
}

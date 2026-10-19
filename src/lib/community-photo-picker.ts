export async function pickCommunityPhotos(maximum: number) {
  // Keep native loading on demand without a development-server chunk request.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Native module errors must be caught when selecting photos.
  const picker = require("expo-image-picker") as typeof import("expo-image-picker");
  const result = await picker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: maximum,
    orderedSelection: true,
    quality: 1,
    exif: false,
  });
  return result.canceled ? [] : result.assets.slice(0, maximum);
}

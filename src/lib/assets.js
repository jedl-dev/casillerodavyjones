export const IMAGE_EXTS = ['webp', 'png', 'svg', 'jpg'];

export const assetCandidates = (folder, key) =>
  IMAGE_EXTS.map((ext) => `/assets/${folder}/${key}.${ext}`);

const probe = (src) => new Promise((resolve) => {
  const image = new Image();
  image.onload = () => resolve(true);
  image.onerror = () => resolve(false);
  image.src = src;
});

export async function findAsset(folder, key) {
  for (const src of assetCandidates(folder, key)) {
    if (await probe(src)) return src;
  }
  return null;
}

export async function discoverAssets(folder, slots) {
  const results = await Promise.all(
    slots.map(async (key) => ((await findAsset(folder, key)) ? key : null))
  );
  return results.filter(Boolean);
}

export const avatarSlots = Array.from(
  { length: 12 },
  (_, index) => `avatar_${String(index + 1).padStart(2, '0')}`
);

export const frameSlots = Array.from(
  { length: 8 },
  (_, index) => `frame_${String(index + 1).padStart(2, '0')}`
);

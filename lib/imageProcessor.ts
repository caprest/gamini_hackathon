import { removeBackground } from "@imgly/background-removal";

export async function removeBg(blob: Blob): Promise<Blob> {
    const result = await removeBackground(blob, {
        output: { format: "image/png" },
    });
    return result;
}

export async function resizeToGameSprite(
    blob: Blob,
    maxSize = 48
): Promise<string> {
    const img = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = maxSize;
    canvas.height = maxSize;
    const ctx = canvas.getContext("2d")!;

    // Fit image within maxSize while preserving aspect ratio
    const scale = Math.min(maxSize / img.width, maxSize / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (maxSize - w) / 2, (maxSize - h) / 2, w, h);

    return canvas.toDataURL("image/png");
}

export async function processWeaponImage(blob: Blob): Promise<string> {
    const bgRemoved = await removeBg(blob);
    return resizeToGameSprite(bgRemoved, 48);
}

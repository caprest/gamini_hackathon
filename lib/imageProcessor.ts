/**
 * Simple Canvas-based background removal.
 * Makes near-white and near-transparent pixels fully transparent.
 */
export async function removeBg(blob: Blob): Promise<Blob> {
    const img = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Sample corners to detect background color
    const corners = [
        0, // top-left
        (canvas.width - 1) * 4, // top-right
        (canvas.height - 1) * canvas.width * 4, // bottom-left
        ((canvas.height - 1) * canvas.width + (canvas.width - 1)) * 4, // bottom-right
    ];

    let bgR = 0, bgG = 0, bgB = 0, count = 0;
    for (const i of corners) {
        if (data[i + 3] > 200) { // only opaque corners
            bgR += data[i];
            bgG += data[i + 1];
            bgB += data[i + 2];
            count++;
        }
    }

    if (count > 0) {
        bgR = Math.round(bgR / count);
        bgG = Math.round(bgG / count);
        bgB = Math.round(bgB / count);

        const threshold = 60;
        for (let i = 0; i < data.length; i += 4) {
            const dr = Math.abs(data[i] - bgR);
            const dg = Math.abs(data[i + 1] - bgG);
            const db = Math.abs(data[i + 2] - bgB);
            if (dr < threshold && dg < threshold && db < threshold) {
                data[i + 3] = 0; // make transparent
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);

    return new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png");
    });
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

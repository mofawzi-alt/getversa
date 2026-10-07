// Shrinks AI-generated poll pictures before saving: max 1080px wide, JPEG q80.
// Keeps phone loading fast (~150-300KB instead of 1.5MB PNG).
import { Image, decode } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

export async function compressToJpeg(bytes: Uint8Array, maxWidth = 1080, quality = 80): Promise<Uint8Array | null> {
  try {
    const img = await decode(bytes);
    if (!(img instanceof Image)) return null;
    if (img.width > maxWidth) img.resize(maxWidth, Image.RESIZE_AUTO);
    return await img.encodeJPEG(quality);
  } catch (e) {
    console.error("compressToJpeg failed", e);
    return null;
  }
}

// Client-side image helpers for capture: downscale a photo and hand back both a
// JPEG blob (persisted) and the base64 payload (sent to the vision model).

export interface PreparedImage {
  blob: Blob;
  /** Bare base64 (no data: prefix) — what llm.visionParse expects. */
  base64: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
}

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.85;

/** Load a File/Blob into an HTMLImageElement. */
function loadImage(src: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(src);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not encode the image."));
    reader.readAsDataURL(blob);
  });
}

/** Downscale (longest edge <= 1280px) and re-encode to JPEG. */
export async function prepareImage(source: Blob): Promise<PreparedImage> {
  const img = await loadImage(source);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser.");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode the image."))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  const base64 = await blobToBase64(blob);
  return { blob, base64, mimeType: "image/jpeg", width, height };
}

/** Turn a stored/generated blob into an object URL, tracked by the caller. */
export function blobUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

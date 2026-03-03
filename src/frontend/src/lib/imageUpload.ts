import { uploadBytesToBlob } from "./blobUpload";

/**
 * Resize an image file to a maximum width, returning JPEG bytes.
 */
export async function resizeImageToMaxWidth(
  file: File,
  maxWidth: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob failed"));
            return;
          }
          blob
            .arrayBuffer()
            .then((buf) => resolve(new Uint8Array(buf)))
            .catch(reject);
        },
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

/**
 * Upload image bytes to blob storage and return the direct URL.
 */
export async function uploadImageToBlob(
  bytes: Uint8Array,
  _identity?: unknown,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return uploadBytesToBlob(bytes, undefined, onProgress);
}

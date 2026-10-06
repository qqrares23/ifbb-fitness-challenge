/** An image ready to embed: a data URL plus its width / height ratio. */
export interface LoadedImage {
  dataUrl: string;
  aspect: number;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("The image couldn't be read."));
    reader.readAsDataURL(file);
  });
}

function decode(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That file isn't an image this app can read (use PNG or JPEG)."));
    image.src = dataUrl;
  });
}

/** A logo as picked, re-encoded as PNG up to 1000 px (keeps transparency; jsPDF reads PNG and JPEG only). */
export async function loadLogo(file: File): Promise<LoadedImage> {
  const image = await decode(await readAsDataUrl(file));
  return { dataUrl: toDataUrl(image, 1000, "image/png"), aspect: image.naturalWidth / image.naturalHeight };
}

/** A photo scaled down to fit `maxSize` px and saved as JPEG, so it stays small in the database. */
export async function loadPhoto(file: File, maxSize = 900): Promise<string> {
  return toDataUrl(await decode(await readAsDataUrl(file)), maxSize, "image/jpeg");
}

function toDataUrl(image: HTMLImageElement, maxSize: number, type: "image/png" | "image/jpeg"): string {
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d")!;
  if (type === "image/jpeg") {
    // JPEG has no transparency: put transparent areas on white instead of black.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type, 0.85);
}

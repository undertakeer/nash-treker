/** Сжимает выбранное фото до квадрата size×size и отдаёт JPEG-Blob */
export function squareThumb(file, size = 320, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Не удалось обработать фото"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать фото"));
    };
    img.src = url;
  });
}

/** Сжимает фото, вписывая в квадрат maxSide, пропорции сохраняются */
export function fitThumb(file, maxSide = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Не удалось обработать фото"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать фото"));
    };
    img.src = url;
  });
}

let webpOk = null;

/** Умеет ли браузер сохранять в WebP — Safari научился не сразу */
export function supportsWebP() {
  if (webpOk !== null) return webpOk;
  const c = document.createElement("canvas");
  c.width = 1;
  c.height = 1;
  webpOk = c.toDataURL("image/webp").startsWith("data:image/webp");
  return webpOk;
}

function draw(img, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function encode(canvas, type, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Не удалось сжать фото"))),
      type,
      quality
    )
  );
}

/**
 * Готовит два файла: полный снимок и миниатюру для сетки галереи.
 * WebP экономит около трети веса, где поддерживается.
 */
export function photoVariants(file, { maxSide = 1280, thumbSide = 400 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      try {
        const webp = supportsWebP();
        const type = webp ? "image/webp" : "image/jpeg";
        const ext = webp ? "webp" : "jpg";
        const full = await encode(draw(img, maxSide), type, webp ? 0.78 : 0.82);
        const thumb = await encode(draw(img, thumbSide), type, webp ? 0.7 : 0.75);
        resolve({ full, thumb, type, ext });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать фото"));
    };
    img.src = url;
  });
}

/** Путь объекта внутри бакета по его публичной ссылке */
export function pathFromPublicUrl(url, bucket) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

import { getAuthorizedAdmin } from "../../../admin-auth";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const user = await getAuthorizedAdmin();
  if (!user)
    return Response.json({ error: "Требуется вход администратора." }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File))
      throw new Error("Выберите фотографию блюда.");
    const extension = extensions[file.type];
    if (!extension)
      throw new Error("Поддерживаются JPG, PNG и WebP.");
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES)
      throw new Error("Фотография должна быть меньше 8 МБ.");

    const { env } = await import("cloudflare:workers");
    if (!env.BUCKET)
      throw new Error("Хранилище изображений временно недоступно.");

    const key = `${crypto.randomUUID()}.${extension}`;
    await env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    return Response.json({
      url: `/api/product-images/${encodeURIComponent(key)}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить фото.";
    return Response.json({ error: message }, { status: 400 });
  }
}

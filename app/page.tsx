import { Storefront } from "./storefront";
import { listPublicCatalogProducts } from "../lib/catalog.server";

const CATEGORY_ORDER = [
  "Сэндвичи",
  "Завтраки",
  "Салаты",
  "Супы",
  "Горячие блюда",
  "Выпечка",
  "Десерты",
] as const;

const categoryRank = new Map<string, number>(
  CATEGORY_ORDER.map((category, index) => [category, index]),
);

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await listPublicCatalogProducts();
  const orderedProducts = [...products].sort(
    (left, right) =>
      (categoryRank.get(left.category) ?? CATEGORY_ORDER.length) -
      (categoryRank.get(right.category) ?? CATEGORY_ORDER.length),
  );

  return <Storefront initialProducts={orderedProducts} />;
}

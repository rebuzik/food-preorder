import { Storefront } from "./storefront";
import { listPublicCatalogProducts } from "../lib/catalog.server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await listPublicCatalogProducts();
  return <Storefront initialProducts={products} />;
}

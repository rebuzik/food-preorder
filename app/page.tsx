import { Storefront } from "./storefront";
import { listCatalogProducts } from "../lib/catalog.server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await listCatalogProducts();
  return <Storefront initialProducts={products} />;
}

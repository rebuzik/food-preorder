const EXCLUDED_NAME_TOKEN = /(^|[^\p{L}\p{N}])КРАФТ(?=$|[^\p{L}\p{N}])/iu;

const DESCRIPTION_SUPPLIERS = [
  { name: 'ООО "Лаборатория еды"', pattern: /ООО\s*[«„“"]?\s*Лаборатория\s+еды\s*[»“"]?/iu },
  { name: 'ООО "Партик"', pattern: /ООО\s*[«„“"]?\s*Партик\s*[»“"]?/iu },
] as const;

export function normalizeCatalogText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSupplierName(value: unknown) {
  return normalizeCatalogText(value).toLocaleLowerCase("ru-RU");
}

export function getSupplierFromDescription(description: unknown, fallback = "Поставщик") {
  const text = normalizeCatalogText(description);
  return DESCRIPTION_SUPPLIERS.find((supplier) => supplier.pattern.test(text))?.name
    ?? (normalizeCatalogText(fallback) || "Поставщик");
}

export function getImportExclusionReason(name: unknown) {
  return EXCLUDED_NAME_TOKEN.test(normalizeCatalogText(name))
    ? "excluded_by_import_rule"
    : null;
}

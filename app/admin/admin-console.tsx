"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as XLSX from "xlsx";
import { getImportExclusionReason, getSupplierFromDescription, normalizeCatalogText } from "../../lib/catalog-policy";
import {
  formatPrice,
  type Product,
  type Supplier,
  type SupplierSummary,
} from "../../lib/products";

type Order = {
  id: string;
  publicId: string;
  name: string;
  phone: string;
  wish: string;
  total: number;
  status: string;
  createdAt: string;
  items: Array<{
    id: string;
    preorderId: string;
    productId: string;
    productName: string;
    supplier: string;
    quantity: number;
    unitPrice: number;
  }>;
};

type ResultsTab = "products" | "submissions";
type ResultsPeriod = "current" | "previous" | "all" | "custom";
type ResultsSort = "votes" | "name" | "category" | "price" | "share";
type SortDirection = "asc" | "desc";

type ProductDraft = {
  id?: string;
  name: string;
  supplier: Supplier;
  category: string;
  description: string;
  weight: string;
  priceRubles: string;
  image: string;
  images: string[];
  externalKey?: string | null;
  article?: string | null;
  barcode?: string | null;
  available: boolean;
};

const blankProduct: ProductDraft = {
  name: "",
  supplier: "Партик",
  category: "Горячее",
  description: "",
  weight: "",
  priceRubles: "",
  image: "",
  images: [],
  externalKey: null,
  article: null,
  barcode: null,
  available: true,
};

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatAdminDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function productToDraft(product: Product): ProductDraft {
  return {
    ...product,
    images: product.images?.length ? product.images : [product.image],
    priceRubles: String(product.price / 100),
  };
}

type ImportProduct = { sourceRow: number; name: string; article: string; barcode: string; supplier: string; category: string; description: string; price: number; images: string[] };
type ImportExcluded = { sourceRow: number; name: string; reason: string };
type ImportPreview = { fileName: string; rows: ImportProduct[]; allRows: ImportProduct[]; sourceRows: number; duplicates: number; errors: string[]; excluded: ImportExcluded[] };

export function AdminConsole({
  initialOrders,
  initialProducts,
  initialSuppliers,
  userName,
}: {
  initialOrders: Order[];
  initialProducts: Product[];
  initialSuppliers: SupplierSummary[];
  userName: string;
}) {
  const [section, setSection] = useState<"orders" | "catalog">("catalog");
  const [orders, setOrders] = useState(initialOrders);
  const [products, setProducts] = useState(initialProducts);
  const [supplierRows, setSupplierRows] = useState(initialSuppliers);
  const [pendingOrderId, setPendingOrderId] = useState("");
  const [resultsTab, setResultsTab] = useState<ResultsTab>("products");
  const [resultsPeriod, setResultsPeriod] = useState<ResultsPeriod>("current");
  const [resultsQuery, setResultsQuery] = useState("");
  const [resultsCategory, setResultsCategory] = useState("all");
  const [resultsSort, setResultsSort] = useState<ResultsSort>("votes");
  const [resultsDirection, setResultsDirection] = useState<SortDirection>("desc");
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsPageSize, setResultsPageSize] = useState<24 | 48 | 96>(24);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState("");
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingProductId, setPendingProductId] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogSupplier, setCatalogSupplier] = useState("all");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPageSize, setCatalogPageSize] = useState<"25" | "50" | "100" | "all">("25");
  const [pendingSupplierId, setPendingSupplierId] = useState("");

  const filteredProducts = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    return products.filter((product) =>
      (catalogSupplier === "all" || product.supplierId === catalogSupplier) &&
      (!query || [product.name, product.category, product.supplier, product.article, product.barcode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))),
    );
  }, [catalogQuery, catalogSupplier, products]);

  const catalogPageCount = catalogPageSize === "all"
    ? 1
    : Math.max(1, Math.ceil(filteredProducts.length / Number(catalogPageSize)));
  const currentCatalogPage = Math.min(catalogPage, catalogPageCount);
  const paginatedProducts = catalogPageSize === "all"
    ? filteredProducts
    : filteredProducts.slice(
        (currentCatalogPage - 1) * Number(catalogPageSize),
        currentCatalogPage * Number(catalogPageSize),
      );
  const catalogRangeStart = filteredProducts.length === 0
    ? 0
    : catalogPageSize === "all"
      ? 1
      : (currentCatalogPage - 1) * Number(catalogPageSize) + 1;
  const catalogRangeEnd = catalogPageSize === "all"
    ? filteredProducts.length
    : Math.min(currentCatalogPage * Number(catalogPageSize), filteredProducts.length);

  const filteredOrders = useMemo(() => {
    if (resultsPeriod === "all") return orders;
    const now = new Date();
    const currentStart = startOfWeek(now);
    let from: Date | null = null;
    let to: Date | null = null;
    if (resultsPeriod === "current") {
      from = currentStart;
    } else if (resultsPeriod === "previous") {
      from = new Date(currentStart);
      from.setDate(from.getDate() - 7);
      to = currentStart;
    } else if (resultsPeriod === "custom") {
      from = customStart ? new Date(`${customStart}T00:00:00`) : null;
      to = customEnd ? new Date(`${customEnd}T23:59:59.999`) : null;
    }
    return orders.filter((order) => {
      const created = new Date(order.createdAt);
      return (!from || created >= from) && (!to || created < to || resultsPeriod === "custom" && created <= to);
    });
  }, [customEnd, customStart, orders, resultsPeriod]);

  const resultsCategories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")),
    [products],
  );

  const productResults = useMemo(() => {
    const votes = new Map<string, number>();
    filteredOrders.forEach((order) => {
      const uniqueIds = new Set(order.items.map((item) => item.productId));
      uniqueIds.forEach((productId) => votes.set(productId, (votes.get(productId) ?? 0) + 1));
    });
    const total = filteredOrders.length;
    const query = resultsQuery.trim().toLowerCase();
    const rows = products
      .map((product) => {
        const voteCount = votes.get(product.id) ?? 0;
        return { product, voteCount, share: total ? voteCount / total * 100 : 0 };
      })
      .filter(({ product }) => resultsCategory === "all" || product.category === resultsCategory)
      .filter(({ product }) => !query || product.name.toLowerCase().includes(query));
    rows.sort((left, right) => {
      let value = 0;
      if (resultsSort === "votes") value = left.voteCount - right.voteCount;
      if (resultsSort === "share") value = left.share - right.share;
      if (resultsSort === "price") value = left.product.price - right.product.price;
      if (resultsSort === "name") value = left.product.name.localeCompare(right.product.name, "ru");
      if (resultsSort === "category") value = left.product.category.localeCompare(right.product.category, "ru");
      return resultsDirection === "asc" ? value : -value;
    });
    return rows;
  }, [filteredOrders, products, resultsCategory, resultsDirection, resultsQuery, resultsSort]);

  const votedProductCount = useMemo(() => {
    const ids = new Set<string>();
    filteredOrders.forEach((order) => order.items.forEach((item) => ids.add(item.productId)));
    return ids.size;
  }, [filteredOrders]);
  const resultsPageCount = Math.max(1, Math.ceil(productResults.length / resultsPageSize));
  const currentResultsPage = Math.min(resultsPage, resultsPageCount);
  const paginatedResults = productResults.slice((currentResultsPage - 1) * resultsPageSize, currentResultsPage * resultsPageSize);

  function changeResultsSort(sort: ResultsSort) {
    if (resultsSort === sort) setResultsDirection((current) => current === "desc" ? "asc" : "desc");
    else {
      setResultsSort(sort);
      setResultsDirection(sort === "name" || sort === "category" ? "asc" : "desc");
    }
    setResultsPage(1);
  }

  function exportResults(format: "xlsx" | "csv") {
    const rows = productResults.map(({ product, voteCount, share }) => ({
      "Артикул": product.article ?? "",
      "Наименование": product.name,
      "Категория": product.category,
      "Цена": product.price / 100,
      "Количество голосов": voteCount,
      "Выбрали, %": `${share.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 16 }, { wch: 42 }, { wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 18 }];
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Результаты");
      XLSX.writeFile(workbook, `rezultaty-golosovaniya-${stamp}.xlsx`);
      return;
    }
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ";" });
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rezultaty-golosovaniya-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const localPreview = useMemo(
    () => (imageFiles[0] ? URL.createObjectURL(imageFiles[0]) : ""),
    [imageFiles],
  );

  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview],
  );

  useEffect(() => {
    if (!draft) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) closeEditor();
    };
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = "";
    };
  }, [draft, saving]);

  function closeEditor() {
    setDraft(null);
    setImageFiles([]);
    setFormError("");
  }

  async function uploadImage(file: File) {
    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch("/api/admin/product-images", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as {
      url?: string;
      error?: string;
    };
    if (!response.ok || !payload.url)
      throw new Error(payload.error ?? "Не удалось загрузить фотографию.");
    return payload.url;
  }

  async function refreshSuppliers() {
    const response = await fetch("/api/admin/suppliers");
    const payload = (await response.json()) as { suppliers?: SupplierSummary[]; error?: string };
    if (!response.ok || !payload.suppliers) throw new Error(payload.error ?? "Не удалось обновить список поставщиков.");
    setSupplierRows(payload.suppliers);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setFormError("");
    setSaving(true);
    try {
      const numericPrice = Number(draft.priceRubles.replace(",", "."));
      if (!Number.isFinite(numericPrice) || numericPrice <= 0)
        throw new Error("Проверьте цену блюда.");
      const uploadedImages = imageFiles.length ? await Promise.all(imageFiles.map(uploadImage)) : [];
      const images = [...uploadedImages, ...draft.images].map((value) => value.trim()).filter((value, index, list) => value && list.indexOf(value) === index);
      const image = images[0] || draft.image;
      if (!image) throw new Error("Загрузите фотографию блюда.");

      const payload = {
        id: draft.id,
        name: draft.name,
        supplier: draft.supplier,
        category: draft.category,
        description: draft.description,
        weight: draft.weight,
        price: Math.round(numericPrice * 100),
        image,
        images,
        externalKey: draft.externalKey,
        article: draft.article,
        barcode: draft.barcode,
        available: draft.available,
      };
      const response = await fetch("/api/admin/products", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as Product & { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Не удалось сохранить блюдо.");

      setProducts((current) =>
        draft.id
          ? current.map((product) =>
              product.id === draft.id ? result : product,
            )
          : [...current, result],
      );
      await refreshSuppliers();
      setNotice(draft.id ? "Карточка обновлена" : "Новое блюдо добавлено");
      window.setTimeout(() => setNotice(""), 2600);
      closeEditor();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Не удалось сохранить блюдо.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function readImportFile(file: File) {
    setFormError("");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const normalized = rawRows.map((row, index) => {
        const images = String(row["Изображения"] ?? "").split(/\s*[;\n\r,]+\s*|\s+(?=https?:\/\/)/).map((value) => value.trim()).filter((value) => /^https?:\/\//i.test(value));
        const description = normalizeCatalogText(row["Короткое описание"]);
        const supplier = getSupplierFromDescription(description, row["Компания (название)"]);
        return { sourceRow: index + 2, name: normalizeCatalogText(row["Название"]), article: normalizeCatalogText(row["Артикул"]), barcode: normalizeCatalogText(row["Штрих-код"]).replace(/\.0$/, ""), supplier, category: normalizeCatalogText(row["Тип услуги (название)"]) || "Другое", description, price: Math.round(Number(row["Цена"] || 0) * 100), images } satisfies ImportProduct;
      });
      const errors: string[] = [];
      const excluded: ImportExcluded[] = [];
      const unique = new Map<string, ImportProduct>();
      normalized.forEach((row) => {
        if (!row.name) return errors.push(`Строка ${row.sourceRow}: нет названия`);
        if (!row.images.length) return errors.push(`Строка ${row.sourceRow}: нет ссылки на изображение`);
        const reason = getImportExclusionReason(row.name);
        if (reason) { excluded.push({ sourceRow: row.sourceRow, name: row.name, reason }); return; }
        unique.set(row.article || row.barcode || `${row.supplier}:${row.name}`.toLowerCase(), row);
      });
      setImportPreview({ fileName: file.name, rows: [...unique.values()], allRows: normalized, sourceRows: normalized.length, duplicates: Math.max(0, normalized.length - unique.size - errors.length - excluded.length), errors, excluded });
    } catch { setFormError("Не удалось прочитать Excel. Проверьте формат и заголовки колонок."); }
  }

  async function applyImport() {
    if (!importPreview) return;
    setImporting(true); setFormError("");
    try {
      const response = await fetch("/api/admin/products/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ products: importPreview.allRows, sourceRows: importPreview.sourceRows }) });
      const result = (await response.json()) as { products?: Product[]; created?: number; updated?: number; summary?: { excluded?: number }; error?: string };
      if (!response.ok || !result.products) throw new Error(result.error ?? "Импорт не выполнен.");
      setProducts(result.products); await refreshSuppliers(); setNotice(`Импорт завершён: ${result.created ?? 0} новых, ${result.updated ?? 0} обновлено, ${result.summary?.excluded ?? 0} исключено`); window.setTimeout(() => setNotice(""), 4000); setImportPreview(null);
    } catch (error) { setFormError(error instanceof Error ? error.message : "Импорт не выполнен."); }
    finally { setImporting(false); }
  }

  async function toggleAvailability(product: Product) {
    setPendingProductId(product.id);
    const response = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...product, available: !product.available }),
    });
    if (response.ok) {
      const updated = (await response.json()) as Product;
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? updated : item)),
      );
    }
    setPendingProductId("");
  }

  async function setAllAvailability(available: boolean) {
    setPendingProductId("all");
    const response = await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available }),
    });
    if (response.ok) {
      setProducts((current) => current.map((product) => ({ ...product, available })));
      setNotice(available ? "Все товары показаны в голосовании" : "Все товары скрыты");
      window.setTimeout(() => setNotice(""), 3000);
    }
    setPendingProductId("");
  }

  function toggleProductSelection(id: string) {
    setSelectedProductIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllFiltered() {
    const filteredIds = filteredProducts.map((product) => product.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedProductIds.includes(id));
    setSelectedProductIds((current) => allSelected
      ? current.filter((id) => !filteredIds.includes(id))
      : [...new Set([...current, ...filteredIds])],
    );
  }

  async function bulkSetAvailability(available: boolean) {
    if (!selectedProductIds.length) return;
    setPendingProductId("bulk");
    const response = await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available, ids: selectedProductIds }),
    });
    if (response.ok) {
      const selected = new Set(selectedProductIds);
      setProducts((current) => current.map((product) => selected.has(product.id) ? { ...product, available } : product));
      setNotice(`${selectedProductIds.length} товаров ${available ? "показано" : "скрыто"}`);
      setSelectedProductIds([]);
      window.setTimeout(() => setNotice(""), 3000);
    }
    setPendingProductId("");
  }

  async function toggleSupplierCatalog(supplier: SupplierSummary) {
    const nextEnabled = !supplier.catalogEnabled;
    const confirmed = window.confirm(nextEnabled
      ? `Включить поставщика «${supplier.name}»? В каталоге снова появятся его индивидуально активные товары.`
      : `Отключить поставщика «${supplier.name}»? Из публичного каталога исчезнет ${supplier.activeProductCount} товаров. Новые позиции после импорта также останутся скрытыми. Товары не удаляются.`);
    if (!confirmed) return;
    setPendingSupplierId(supplier.id);
    try {
      const response = await fetch(`/api/admin/suppliers/${encodeURIComponent(supplier.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalogEnabled: nextEnabled }) });
      const result = (await response.json()) as { supplier?: { catalogEnabled: boolean }; error?: string };
      if (!response.ok || !result.supplier) throw new Error(result.error ?? "Не удалось обновить поставщика.");
      setSupplierRows((current) => current.map((item) => item.id === supplier.id ? { ...item, catalogEnabled: nextEnabled } : item));
      setProducts((current) => current.map((product) => product.supplierId === supplier.id ? { ...product, supplierCatalogEnabled: nextEnabled } : product));
      setNotice(nextEnabled ? `Поставщик «${supplier.name}» включён` : `Поставщик «${supplier.name}» отключён`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось обновить поставщика.");
    } finally {
      window.setTimeout(() => setNotice(""), 3200);
      setPendingSupplierId("");
    }
  }

  async function deleteProduct(product: Product) {
    const confirmed = window.confirm(
      `Удалить «${product.name}»? Карточка исчезнет из каталога.`,
    );
    if (!confirmed) return;
    setPendingProductId(product.id);
    const response = await fetch(
      `/api/admin/products?id=${encodeURIComponent(product.id)}`,
      { method: "DELETE" },
    );
    if (response.ok) {
      setProducts((current) =>
        current.filter((item) => item.id !== product.id),
      );
      setNotice("Карточка удалена");
      window.setTimeout(() => setNotice(""), 2600);
    }
    setPendingProductId("");
  }

  async function deleteVote(order: Order) {
    if (!window.confirm("Удалить этот голос? Он исчезнет из статистики вместе со всеми выбранными товарами. Действие нельзя отменить.")) return;
    setPendingOrderId(order.id);
    try {
      const response = await fetch("/api/admin/preorders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Не удалось удалить голос.");
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setExpandedOrderId((current) => current === order.id ? "" : current);
      setNotice("Голос удалён, статистика обновлена");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось удалить голос.");
    } finally { setPendingOrderId(""); }
  }

  async function logoutAdmin() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.replace("/admin/login");
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <Link className="brand" href="/">
            ReFreshTech
          </Link>
          <span>Управление сайтом</span>
        </div>
        <div>
          <a className="admin-site-link" href="/" target="_blank">
            Открыть сайт ↗
          </a>
          <span className="admin-user">{userName}</span>
          <button className="admin-logout" onClick={logoutAdmin}>Выйти</button>
        </div>
      </header>

      <section className="admin-content">
        <nav className="admin-sections" aria-label="Разделы управления">
          <button
            className={section === "catalog" ? "active" : ""}
            onClick={() => setSection("catalog")}
          >
            Каталог
            <span>{products.length}</span>
          </button>
          <button
            className={section === "orders" ? "active" : ""}
            onClick={() => setSection("orders")}
          >
            Результаты
            <span>{filteredOrders.length}</span>
          </button>
        </nav>

        {section === "orders" ? (
          <>
            <div className="admin-title results-admin-title">
              <div>
                <h1>Результаты голосования</h1>
                <p>Статистика выбора товаров для ассортимента на следующую неделю.</p>
              </div>
              <div className="results-summary" aria-label="Сводка голосования">
                <div><strong>{filteredOrders.length}</strong><span>всего голосов</span></div>
                <div><strong>{votedProductCount}</strong><span>из {products.length} позиций выбрали</span></div>
              </div>
            </div>

            <div className="results-tabs" role="tablist" aria-label="Представление результатов">
              <button role="tab" aria-selected={resultsTab === "products"} className={resultsTab === "products" ? "active" : ""} onClick={() => setResultsTab("products")}>Статистика по товарам</button>
              <button role="tab" aria-selected={resultsTab === "submissions"} className={resultsTab === "submissions" ? "active" : ""} onClick={() => setResultsTab("submissions")}>Отправленные голоса <span>{filteredOrders.length}</span></button>
            </div>

            <div className="results-period-row">
              <label><span>Период</span><select value={resultsPeriod} onChange={(event) => { setResultsPeriod(event.target.value as ResultsPeriod); setResultsPage(1); }}><option value="current">Текущая неделя</option><option value="previous">Прошлая неделя</option><option value="all">За всё время</option><option value="custom">Выбрать период</option></select></label>
              {resultsPeriod === "custom" && <div className="custom-period"><label><span>С</span><input type="date" value={customStart} onChange={(event) => { setCustomStart(event.target.value); setResultsPage(1); }} /></label><label><span>По</span><input type="date" value={customEnd} onChange={(event) => { setCustomEnd(event.target.value); setResultsPage(1); }} /></label></div>}
            </div>

            {resultsTab === "products" ? <>
              <div className="results-tools">
                <label className="results-search"><span aria-hidden="true">⌕</span><input value={resultsQuery} onChange={(event) => { setResultsQuery(event.target.value); setResultsPage(1); }} placeholder="Поиск по товарам" />{resultsQuery && <button onClick={() => { setResultsQuery(""); setResultsPage(1); }} aria-label="Очистить поиск">×</button>}</label>
                <label className="results-category"><span>Категория</span><select value={resultsCategory} onChange={(event) => { setResultsCategory(event.target.value); setResultsPage(1); }}><option value="all">Все категории</option>{resultsCategories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
                <details className="results-export"><summary>↓ Скачать результаты</summary><div><button onClick={() => exportResults("xlsx")}>Excel (.xlsx)</button><button onClick={() => exportResults("csv")}>CSV (.csv)</button></div></details>
              </div>

              <div className="results-table-wrap">
                <table className="results-table">
                  <thead><tr><th><button onClick={() => changeResultsSort("name")}>Товар {resultsSort === "name" && (resultsDirection === "desc" ? "↓" : "↑")}</button></th><th><button onClick={() => changeResultsSort("category")}>Категория {resultsSort === "category" && (resultsDirection === "desc" ? "↓" : "↑")}</button></th><th><button onClick={() => changeResultsSort("price")}>Цена {resultsSort === "price" && (resultsDirection === "desc" ? "↓" : "↑")}</button></th><th className="numeric"><button onClick={() => changeResultsSort("votes")}>Голосов {resultsSort === "votes" && (resultsDirection === "desc" ? "↓" : "↑")}</button></th><th className="numeric"><div className="result-share-heading"><button onClick={() => changeResultsSort("share")}>Выбрали, % {resultsSort === "share" && (resultsDirection === "desc" ? "↓" : "↑")}</button><span className="results-help"><button type="button" aria-label="Как рассчитывается процент выбранных товаров" aria-describedby="share-help">i</button><span id="share-help" role="tooltip"><strong>Как рассчитывается</strong>Процент голосований, в которых выбрали товар. Например: 1 выбор из 2 голосований = 50%. Значения не складываются в 100%, потому что в одном голосовании можно выбрать несколько товаров.</span></span></div></th></tr></thead>
                  <tbody>{paginatedResults.map(({ product, voteCount, share }) => <tr key={product.id}><td><div className="result-product"><img src={product.image} width="56" height="56" alt="" /><span><strong>{product.name}</strong><small>{product.article ? `Арт. ${product.article}` : "Без артикула"}</small></span></div></td><td>{product.category}</td><td>{formatPrice(product.price)}</td><td className="numeric"><strong className={voteCount ? "result-votes positive" : "result-votes"}>{voteCount}</strong></td><td className="numeric"><strong>{share.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</strong></td></tr>)}</tbody>
                </table>
                {productResults.length === 0 && <div className="admin-empty compact"><h2>Ничего не найдено</h2><p>Измените поиск или категорию.</p></div>}
              </div>

              {productResults.length > 0 && <nav className="results-pagination" aria-label="Страницы результатов"><span>Показано {(currentResultsPage - 1) * resultsPageSize + 1}–{Math.min(currentResultsPage * resultsPageSize, productResults.length)} из {productResults.length}</span><div><button disabled={currentResultsPage === 1} onClick={() => setResultsPage((page) => Math.max(1, page - 1))}>Назад</button><strong>{currentResultsPage} / {resultsPageCount}</strong><button disabled={currentResultsPage === resultsPageCount} onClick={() => setResultsPage((page) => Math.min(resultsPageCount, page + 1))}>Дальше</button></div><label>Показывать <select value={resultsPageSize} onChange={(event) => { setResultsPageSize(Number(event.target.value) as 24 | 48 | 96); setResultsPage(1); }}><option value="24">24</option><option value="48">48</option><option value="96">96</option></select></label></nav>}
            </> : <div className="submissions-list">
              {filteredOrders.length === 0 ? <div className="admin-empty"><h2>Голосов за период нет</h2><p>Выберите другой период или дождитесь новых отправок.</p></div> : filteredOrders.map((order, index) => <article className={`submission-row ${expandedOrderId === order.id ? "expanded" : ""}`} key={order.id}><div className="submission-row-head"><button className="submission-summary" onClick={() => setExpandedOrderId((current) => current === order.id ? "" : order.id)} aria-expanded={expandedOrderId === order.id}><span className="submission-number"><strong>Голос #{filteredOrders.length - index}</strong><small>{formatAdminDate(order.createdAt)}</small></span><span><strong>{order.items.length}</strong><small>выбрано товаров</small></span><span className="submission-toggle">{expandedOrderId === order.id ? "Свернуть ↑" : "Посмотреть ↓"}</span></button><button className="submission-delete" disabled={pendingOrderId === order.id} onClick={() => deleteVote(order)} aria-label={`Удалить голос от ${formatAdminDate(order.createdAt)}`}>{pendingOrderId === order.id ? "Удаляем…" : "Удалить"}</button></div>{expandedOrderId === order.id && <div className="submission-items">{order.items.map((item) => { const product = products.find((entry) => entry.id === item.productId); return <div key={item.id}>{product && <img src={product.image} width="44" height="44" alt="" />}<span><strong>{item.productName}</strong><small>{product?.category ?? item.supplier} · {formatPrice(item.unitPrice)}</small></span></div>; })}</div>}</article>)}
            </div>}
          </>
        ) : (
          <>
            <div className="admin-title catalog-admin-title">
              <div>
                <h1>Каталог</h1>
                <p>
                  Изменения в карточках сразу появляются на главной странице.
                </p>
              </div>
              <div className="catalog-admin-actions">
                <button className="secondary-button" disabled={pendingProductId === "all"} onClick={() => setAllAvailability(true)}>Показать все</button>
                <label className="secondary-button admin-import-button">Импортировать Excel<input type="file" accept=".xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImportFile(file); event.currentTarget.value = ""; }} /></label>
                <button className="primary-button admin-add-button" onClick={() => setDraft({ ...blankProduct })}><span aria-hidden="true">+</span>Добавить товар</button>
              </div>
            </div>

            <section className="supplier-management" aria-labelledby="supplier-management-title">
              <div className="supplier-management-heading">
                <div><strong id="supplier-management-title">Поставщики</strong><span>Отключение скрывает товары публично, но не удаляет их и не мешает будущим импортам.</span></div>
                <span>{supplierRows.filter((item) => item.catalogEnabled).length} из {supplierRows.length} включено</span>
              </div>
              <div className="supplier-management-list">{supplierRows.map((item) => <article className={item.catalogEnabled ? "" : "disabled"} key={item.id}><div><strong>{item.name}</strong><span>{item.productCount} товаров · {item.activeProductCount} активных</span></div><button className={item.catalogEnabled ? "supplier-disable-button" : "supplier-enable-button"} disabled={pendingSupplierId === item.id} onClick={() => toggleSupplierCatalog(item)}>{pendingSupplierId === item.id ? "Сохраняем…" : item.catalogEnabled ? "Отключить" : "Включить"}</button></article>)}</div>
            </section>

            <div className="catalog-tools">
              <label className="catalog-search">
                <span aria-hidden="true">⌕</span>
                <input value={catalogQuery} onChange={(event) => { setCatalogQuery(event.target.value); setCatalogPage(1); }} placeholder="Поиск по названию, артикулу, штрих-коду или категории" />
                {catalogQuery && <button type="button" onClick={() => { setCatalogQuery(""); setCatalogPage(1); }} aria-label="Очистить поиск">×</button>}
              </label>
              <label className="catalog-supplier-filter"><span>Поставщик</span><select value={catalogSupplier} onChange={(event) => { setCatalogSupplier(event.target.value); setCatalogPage(1); setSelectedProductIds([]); }}><option value="all">Все поставщики</option>{supplierRows.map((item) => <option value={item.id} key={item.id}>{item.name}{item.catalogEnabled ? "" : " — отключён"}</option>)}</select></label>
              <label className="catalog-page-size">
                <span>На странице</span>
                <select value={catalogPageSize} onChange={(event) => { setCatalogPageSize(event.target.value as "25" | "50" | "100" | "all"); setCatalogPage(1); }}>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="all">Все</option>
                </select>
              </label>
              <button className="select-all-button" onClick={toggleAllFiltered} disabled={!filteredProducts.length}>
                {filteredProducts.length > 0 && filteredProducts.every((product) => selectedProductIds.includes(product.id)) ? "Снять выбор" : `Выбрать найденные (${filteredProducts.length})`}
              </button>
            </div>

            {selectedProductIds.length > 0 && <div className="catalog-bulk-bar">
              <strong>Выбрано: {selectedProductIds.length}</strong>
              <div><button onClick={() => bulkSetAvailability(true)} disabled={pendingProductId === "bulk"}>Показать</button><button onClick={() => bulkSetAvailability(false)} disabled={pendingProductId === "bulk"}>Скрыть</button><button className="bulk-clear" onClick={() => setSelectedProductIds([])}>Снять выбор</button></div>
            </div>}

            <div className="admin-product-list">
              {paginatedProducts.map((product) => (
                <article className={`admin-product-row ${selectedProductIds.includes(product.id) ? "selected" : ""}`} key={product.id}>
                  <label className="admin-product-select" aria-label={`Выбрать ${product.name}`}><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={() => toggleProductSelection(product.id)} /><span /></label>
                  <img
                    src={product.image}
                    width="112"
                    height="84"
                    alt=""
                  />
                  <div className="admin-product-main">
                    <span>{product.supplier} · {product.category}{product.supplierCatalogEnabled === false && <b className="supplier-disabled-note">Поставщик отключён</b>}</span>
                    <strong>{product.name}</strong>
                    <small>{product.description}</small>
                  </div>
                  <div className="admin-product-price">
                    <strong>{formatPrice(product.price)}</strong>
                    <span>{product.weight}</span>
                  </div>
                  <button
                    className={`availability-pill ${
                      product.available ? "available" : ""
                    }`}
                    disabled={pendingProductId === product.id}
                    onClick={() => toggleAvailability(product)}
                  >
                    <span />
                    {product.available ? "Показывается" : "Скрыт"}
                  </button>
                  <div className="admin-product-actions">
                    <button
                      onClick={() => setDraft(productToDraft(product))}
                      disabled={pendingProductId === product.id}
                    >
                      Редактировать
                    </button>
                    <button
                      className="danger-link"
                      onClick={() => deleteProduct(product)}
                      disabled={pendingProductId === product.id}
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
              {filteredProducts.length === 0 && <div className="catalog-no-results"><strong>Ничего не найдено</strong><span>Попробуйте изменить запрос.</span></div>}
            </div>

            {filteredProducts.length > 0 && <nav className="admin-catalog-pagination" aria-label="Страницы каталога">
              <span>Показано {catalogRangeStart}–{catalogRangeEnd} из {filteredProducts.length}</span>
              <div>
                <button onClick={() => setCatalogPage(Math.max(1, currentCatalogPage - 1))} disabled={currentCatalogPage === 1 || catalogPageSize === "all"}>Назад</button>
                <strong>{catalogPageSize === "all" ? "Все товары" : `Страница ${currentCatalogPage} из ${catalogPageCount}`}</strong>
                <button onClick={() => setCatalogPage(Math.min(catalogPageCount, currentCatalogPage + 1))} disabled={currentCatalogPage === catalogPageCount || catalogPageSize === "all"}>Дальше</button>
              </div>
            </nav>}
          </>
        )}
      </section>

      {notice && (
        <div className="admin-toast" role="status">
          <span>✓</span>
          {notice}
        </div>
      )}

      {importPreview && <div className="admin-editor-backdrop import-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !importing && setImportPreview(null)}><aside className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="admin-editor-header"><div><span>Массовое обновление</span><h2 id="import-title">Проверка файла</h2></div><button className="editor-close" onClick={() => setImportPreview(null)} disabled={importing}>×</button></div><div className="import-body"><div className="import-file-name">{importPreview.fileName}</div><div className="import-stats"><div><strong>{importPreview.sourceRows}</strong><span>строк в файле</span></div><div><strong>{importPreview.rows.length}</strong><span>готово к загрузке</span></div><div><strong>{importPreview.excluded.length}</strong><span>исключено «КРАФТ»</span></div><div><strong>{importPreview.duplicates}</strong><span>дублей объединено</span></div><div><strong>{importPreview.errors.length}</strong><span>ошибок в строках</span></div></div><div className="import-rules"><strong>Как обновляем каталог</strong><p>Позиции с отдельной маркировкой «КРАФТ» не импортируются. Совпадения обновляются по артикулу, штрих-коду или поставщику и названию. Ручное скрытие товара и отключение поставщика сохраняются после импорта.</p></div>{importPreview.excluded.length > 0 && <details className="import-excluded"><summary>Показать исключённые позиции</summary>{importPreview.excluded.slice(0,30).map((item) => <div key={`${item.sourceRow}-${item.name}`}>Строка {item.sourceRow}: {item.name} <span>excluded_by_import_rule</span></div>)}</details>}{importPreview.errors.length > 0 && <details className="import-errors"><summary>Показать строки с ошибками</summary>{importPreview.errors.slice(0,20).map((item) => <div key={item}>{item}</div>)}</details>}<div className="import-sample"><strong>Первые позиции</strong>{importPreview.rows.slice(0,5).map((row) => <div key={row.article || row.barcode || row.name}><img src={row.images[0]} alt="" /><span><b>{row.name}</b><small>{row.supplier} · {row.category} · {row.article || row.barcode || "без артикула"}</small></span><em>{row.images.length} фото</em></div>)}</div>{formError && <p className="form-error">{formError}</p>}<div className="product-form-actions"><button className="secondary-button" onClick={() => setImportPreview(null)} disabled={importing}>Отмена</button><button className="primary-button" onClick={applyImport} disabled={importing || importPreview.rows.length === 0}>{importing ? "Обновляем каталог…" : `Импортировать ${importPreview.rows.length} товаров`}</button></div></div></aside></div>}

      {draft && (
        <div
          className="admin-editor-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) closeEditor();
          }}
        >
          <aside
            className="admin-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-editor-title"
          >
            <div className="admin-editor-header">
              <div>
                <span>Карточка товара</span>
                <h2 id="product-editor-title">
                  {draft.id ? "Редактировать блюдо" : "Новое блюдо"}
                </h2>
              </div>
              <button
                className="editor-close"
                onClick={closeEditor}
                disabled={saving}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <form className="product-form" onSubmit={saveProduct}>
              <label className="product-photo-field">
                <span>Фотография</span>
                <div className="product-photo-preview">
                  {localPreview || draft.image ? (
                    <img
                      src={localPreview || draft.image}
                      width="560"
                      height="320"
                      alt="Предпросмотр фотографии блюда"
                    />
                  ) : (
                    <div>
                      <strong>Добавьте фотографию</strong>
                      <small>JPG, PNG или WebP до 8 МБ</small>
                    </div>
                  )}
                  <span className="photo-change-label">
                    {draft.image || imageFiles.length ? "Добавить фото" : "Выбрать фото"}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setImageFiles(Array.from(event.target.files ?? []))
                  }
                  multiple
                />
              </label>

              <label><span>Ссылки на изображения</span><textarea value={draft.images.join("\n")} onChange={(event) => { const images = event.target.value.split(/\n+/).map((value) => value.trim()).filter(Boolean); setDraft({ ...draft, images, image: images[0] || draft.image }); }} placeholder="По одной ссылке в строке" rows={4} /><small>Если изображений несколько, на карточке появится слайдер.</small></label>

              <label>
                <span>Название</span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  placeholder="Например, курица в сливочном соусе"
                  maxLength={100}
                  required
                />
              </label>

              <div className="product-form-grid">
                <label>
                  <span>Поставщик</span>
                  <input
                    value={draft.supplier}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        supplier: event.target.value as Supplier,
                      })
                    }
                    placeholder="Название поставщика"
                  />
                </label>
                <label>
                  <span>Категория</span>
                  <input
                    value={draft.category}
                    onChange={(event) =>
                      setDraft({ ...draft, category: event.target.value })
                    }
                    placeholder="Горячее"
                    maxLength={50}
                    required
                  />
                </label>
              </div>

              <label>
                <span>Короткое описание</span>
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  placeholder="Что входит в блюдо"
                  maxLength={320}
                  rows={3}
                  required
                />
                <small>{draft.description.length}/320</small>
              </label>

              <div className="product-form-grid">
                <label>
                  <span>Цена, ₽</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="decimal"
                    value={draft.priceRubles}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        priceRubles: event.target.value,
                      })
                    }
                    placeholder="420"
                    required
                  />
                </label>
                <label>
                  <span>Вес или объём</span>
                  <input
                    value={draft.weight}
                    onChange={(event) =>
                      setDraft({ ...draft, weight: event.target.value })
                    }
                    placeholder="320 г"
                    maxLength={30}
                  />
                </label>
              </div>

              <label className="availability-switch">
                <input
                  type="checkbox"
                  checked={draft.available}
                  onChange={(event) =>
                    setDraft({ ...draft, available: event.target.checked })
                  }
                />
                <span className="switch-track">
                  <span />
                </span>
                <span>
                  <strong>Показывать в голосовании</strong>
                  <small>
                    Если выключить, карточка будет скрыта из голосования,
                    но останется в каталоге администратора.
                  </small>
                </span>
              </label>

              {formError && <p className="form-error">{formError}</p>}

              <div className="product-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeEditor}
                  disabled={saving}
                >
                  Отмена
                </button>
                <button className="primary-button" disabled={saving}>
                  {saving
                    ? "Сохраняем…"
                    : draft.id
                      ? "Сохранить изменения"
                      : "Добавить в каталог"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </main>
  );
}

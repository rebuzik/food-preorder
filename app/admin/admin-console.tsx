"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  formatPrice,
  type Product,
  type Supplier,
} from "../../lib/products";

type Order = {
  id: string;
  publicId: string;
  name: string;
  phone: string;
  total: number;
  status: string;
  createdAt: string;
};

type ProductDraft = {
  id?: string;
  name: string;
  supplier: Supplier;
  category: string;
  description: string;
  weight: string;
  priceRubles: string;
  image: string;
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
  available: true,
};

const statusLabels: Record<string, string> = {
  new: "Новый",
  contacted: "Связались",
  confirmed: "Подтверждён",
  cancelled: "Отменён",
};

function productToDraft(product: Product): ProductDraft {
  return {
    ...product,
    priceRubles: String(product.price / 100),
  };
}

export function AdminConsole({
  initialOrders,
  initialProducts,
  userName,
}: {
  initialOrders: Order[];
  initialProducts: Product[];
  userName: string;
}) {
  const [section, setSection] = useState<"orders" | "catalog">("catalog");
  const [orders, setOrders] = useState(initialOrders);
  const [products, setProducts] = useState(initialProducts);
  const [orderFilter, setOrderFilter] = useState("all");
  const [pendingOrderId, setPendingOrderId] = useState("");
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingProductId, setPendingProductId] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const visibleOrders = useMemo(
    () =>
      orderFilter === "all"
        ? orders
        : orders.filter((order) => order.status === orderFilter),
    [orderFilter, orders],
  );

  const localPreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : ""),
    [imageFile],
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
    setImageFile(null);
    setFormError("");
  }

  async function changeStatus(id: string, status: string) {
    setPendingOrderId(id);
    const previous = orders;
    setOrders((current) =>
      current.map((order) => (order.id === id ? { ...order, status } : order)),
    );
    const response = await fetch("/api/admin/preorders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) setOrders(previous);
    setPendingOrderId("");
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

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setFormError("");
    setSaving(true);
    try {
      const numericPrice = Number(draft.priceRubles.replace(",", "."));
      if (!Number.isFinite(numericPrice) || numericPrice <= 0)
        throw new Error("Проверьте цену блюда.");
      const image = imageFile
        ? await uploadImage(imageFile)
        : draft.image;
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

  const newCount = orders.filter((order) => order.status === "new").length;
  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <Link className="brand" href="/">
            Еда рядом
          </Link>
          <span>Управление сайтом</span>
        </div>
        <div>
          <a className="admin-site-link" href="/" target="_blank">
            Открыть сайт ↗
          </a>
          <span className="admin-user">{userName}</span>
          <a href="/signout-with-chatgpt?return_to=/">Выйти</a>
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
            Предзаказы
            {newCount > 0 && <span>{newCount}</span>}
          </button>
        </nav>

        {section === "orders" ? (
          <>
            <div className="admin-title">
              <div>
                <h1>Предзаказы</h1>
                <p>Новые заявки появляются здесь сразу после отправки.</p>
              </div>
              <div className="admin-stat">
                <strong>{newCount}</strong>
                <span>новых</span>
              </div>
            </div>
            <div className="admin-filters">
              {[
                ["all", "Все"],
                ["new", "Новые"],
                ["contacted", "Связались"],
                ["confirmed", "Подтверждены"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={orderFilter === value ? "active" : ""}
                  onClick={() => setOrderFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {visibleOrders.length === 0 ? (
              <div className="admin-empty">
                <h2>Заявок пока нет</h2>
                <p>
                  Как только посетитель отправит предзаказ, он появится здесь.
                </p>
              </div>
            ) : (
              <div className="orders-list">
                {visibleOrders.map((order) => (
                  <article className="order-row" key={order.id}>
                    <div className="order-number">
                      <strong>{order.publicId}</strong>
                      <span>
                        {new Date(order.createdAt).toLocaleString("ru-RU")}
                      </span>
                    </div>
                    <div className="order-contact">
                      <strong>{order.name}</strong>
                      <a href={`tel:${order.phone}`}>{order.phone}</a>
                    </div>
                    <strong className="order-total">
                      {formatPrice(order.total)}
                    </strong>
                    <label>
                      <span className={`status-dot ${order.status}`} />
                      <select
                        value={order.status}
                        disabled={pendingOrderId === order.id}
                        onChange={(event) =>
                          changeStatus(order.id, event.target.value)
                        }
                        aria-label={`Статус ${order.publicId}`}
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            )}
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
              <button
                className="primary-button admin-add-button"
                onClick={() => setDraft({ ...blankProduct })}
              >
                <span aria-hidden="true">+</span>
                Добавить блюдо
              </button>
            </div>

            <div className="admin-product-list">
              {products.map((product) => (
                <article className="admin-product-row" key={product.id}>
                  <img
                    src={product.image}
                    width="112"
                    height="84"
                    alt=""
                  />
                  <div className="admin-product-main">
                    <span>
                      {product.supplier} · {product.category}
                    </span>
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
                    {product.available ? "В продаже" : "Недоступно"}
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
            </div>
          </>
        )}
      </section>

      {notice && (
        <div className="admin-toast" role="status">
          <span>✓</span>
          {notice}
        </div>
      )}

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
                    {draft.image || imageFile ? "Заменить фото" : "Выбрать фото"}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setImageFile(event.target.files?.[0] ?? null)
                  }
                />
              </label>

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
                  <select
                    value={draft.supplier}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        supplier: event.target.value as Supplier,
                      })
                    }
                  >
                    <option>Партик</option>
                    <option>Лаборатория еды</option>
                  </select>
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
                    required
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
                  <strong>Доступно для предзаказа</strong>
                  <small>
                    Если выключить, карточка останется в меню с пометкой
                    «Временно недоступно».
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

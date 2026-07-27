"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  formatPrice,
  type Product,
  type Supplier,
} from "../lib/products";

type Cart = Record<string, number>;
type SupplierFilter = "Все" | Supplier;

const CART_STORAGE_KEY = "eda-ryadom-cart-v1";
const CART_TTL = 24 * 60 * 60 * 1000;

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.7L20.5 7H6.2M9.5 20a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm7 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function loadCart(): Cart {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return {};
    const saved = JSON.parse(raw) as { cart: Cart; savedAt: number };
    if (Date.now() - saved.savedAt > CART_TTL) {
      localStorage.removeItem(CART_STORAGE_KEY);
      return {};
    }
    return saved.cart ?? {};
  } catch {
    return {};
  }
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const normalized =
    digits.startsWith("8") && digits.length === 11
      ? `7${digits.slice(1)}`
      : digits.startsWith("7")
        ? digits
        : digits
          ? `7${digits.slice(0, 10)}`
          : "";
  const local = normalized.slice(1);
  const parts = [
    local.slice(0, 3),
    local.slice(3, 6),
    local.slice(6, 8),
    local.slice(8, 10),
  ].filter(Boolean);
  if (!parts.length) return "";
  let result = `+7 (${parts[0]}`;
  if (parts[0].length === 3) result += ")";
  if (parts[1]) result += ` ${parts[1]}`;
  if (parts[2]) result += `-${parts[2]}`;
  if (parts[3]) result += `-${parts[3]}`;
  return result;
}

export function Storefront({
  initialProducts,
}: {
  initialProducts: Product[];
}) {
  const products = initialProducts;
  const [supplier, setSupplier] = useState<SupplierFilter>("Все");
  const [cart, setCart] = useState<Cart>({});
  const [cartReady, setCartReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState("");

  useEffect(() => {
    const initialCart = loadCart();
    queueMicrotask(() => {
      setCart(initialCart);
      setCartReady(true);
    });
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ cart, savedAt: Date.now() }),
    );
  }, [cart, cartReady]);

  useEffect(() => {
    if (!cartOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartOpen(false);
    };
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = "";
    };
  }, [cartOpen]);

  const visibleProducts =
    supplier === "Все"
      ? products
      : products.filter((product) => product.supplier === supplier);
  const cartLines = useMemo(
    () =>
      products
        .filter((product) => cart[product.id])
        .map((product) => ({ ...product, quantity: cart[product.id] })),
    [cart, products],
  );
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const total = cartLines.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  );

  function changeQuantity(id: string, delta: number) {
    setCart((current) => {
      const nextQuantity = Math.max(0, Math.min(20, (current[id] ?? 0) + delta));
      const next = { ...current };
      if (nextQuantity === 0) delete next[id];
      else next[id] = nextQuantity;
      return next;
    });
  }

  async function submitPreorder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!cartLines.length) return setError("Добавьте хотя бы одно блюдо.");
    if (phone.replace(/\D/g, "").length !== 11)
      return setError("Проверьте номер телефона.");
    if (!consent) return setError("Нужно согласие на обработку данных.");

    setSubmitting(true);
    try {
      const response = await fetch("/api/preorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          items: cartLines.map((line) => ({
            productId: line.id,
            quantity: line.quantity,
          })),
        }),
      });
      const payload = (await response.json()) as {
        publicId?: string;
        error?: string;
      };
      if (!response.ok || !payload.publicId)
        throw new Error(payload.error ?? "Не удалось отправить предзаказ.");
      setSuccessId(payload.publicId);
      setCart({});
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось отправить предзаказ.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Еда рядом — на главную">
          Еда рядом
        </a>
        <nav aria-label="Основная навигация">
          <a href="#menu">Меню</a>
          <Link href="/terms">Условия</Link>
        </nav>
        <button className="header-cart" onClick={() => setCartOpen(true)}>
          <CartIcon />
          <span>Корзина · {itemCount}</span>
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <h1>Выберите готовые блюда и оставьте предзаказ</h1>
          <p className="hero-text">
            Оплачивать ничего не нужно. Мы уточним наличие и свяжемся с вами
            для подтверждения.
          </p>
          <a className="primary-button" href="#menu">
            Смотреть меню
          </a>
          <div className="preorder-note">
            <span aria-hidden="true">i</span>
            <p>
              Это предзаказ — покупка не обязательна. Решение можно принять
              после звонка менеджера.
            </p>
          </div>
        </div>
        <figure className="hero-image">
          <img
            src="/images/hero-food.webp"
            width="1536"
            height="1024"
            alt="Готовые блюда: лосось с овощами, паста и боул с курицей"
          />
        </figure>
      </section>

      <section className="catalog" id="menu">
        <div className="catalog-heading">
          <div>
            <h2>Меню на сегодня</h2>
            <p>Выберите блюда одного или сразу двух поставщиков</p>
          </div>
          <div className="supplier-tabs" aria-label="Фильтр по поставщику">
            {(["Все", "Партик", "Лаборатория еды"] as SupplierFilter[]).map(
              (item) => (
                <button
                  className={supplier === item ? "active" : ""}
                  key={item}
                  onClick={() => setSupplier(item)}
                >
                  {item}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="product-grid">
          {visibleProducts.map((product) => {
            const quantity = cart[product.id] ?? 0;
            return (
              <article className="product-card" key={product.id}>
                <div className="product-image">
                  <img
                    src={product.image}
                    width="724"
                    height="724"
                    loading="lazy"
                    alt={product.name}
                  />
                  {!product.available && (
                    <span className="unavailable">Временно недоступно</span>
                  )}
                </div>
                <div className="product-content">
                  <div className="product-meta">
                    {product.supplier} · {product.category}
                  </div>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="product-bottom">
                    <div>
                      <strong>{formatPrice(product.price)}</strong>
                      <span>{product.weight}</span>
                    </div>
                    {product.available &&
                      (quantity === 0 ? (
                        <button
                          className="add-button"
                          onClick={() => changeQuantity(product.id, 1)}
                          aria-label={`Добавить ${product.name}`}
                        >
                          <PlusIcon />
                        </button>
                      ) : (
                        <div className="quantity-control">
                          <button
                            onClick={() => changeQuantity(product.id, -1)}
                            aria-label="Уменьшить количество"
                          >
                            <MinusIcon />
                          </button>
                          <span>{quantity}</span>
                          <button
                            onClick={() => changeQuantity(product.id, 1)}
                            aria-label="Увеличить количество"
                          >
                            <PlusIcon />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="how-it-works">
        <h2>Как работает предзаказ</h2>
        <ol>
          <li>
            <span>1</span>
            <div>
              <strong>Соберите корзину</strong>
              <p>Можно выбрать блюда обоих поставщиков.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Оставьте контакт</strong>
              <p>Нужны только имя и номер телефона.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Дождитесь звонка</strong>
              <p>Менеджер подтвердит наличие и итоговые условия.</p>
            </div>
          </li>
        </ol>
      </section>

      <footer>
        <a className="brand" href="#top">
          Еда рядом
        </a>
        <p>Предварительный выбор готовых блюд без оплаты на сайте.</p>
        <div>
          <Link href="/terms">Условия предзаказа</Link>
          <Link href="/privacy">Обработка данных</Link>
          <Link href="/admin">Для администратора</Link>
        </div>
      </footer>

      {itemCount > 0 && (
        <button
          className="floating-cart-bar"
          onClick={() => setCartOpen(true)}
          aria-label={`Открыть корзину: ${itemCount} позиций на сумму ${formatPrice(total)}`}
        >
          <span className="floating-cart-icon">
            <CartIcon />
          </span>
          <span className="floating-cart-copy">
            <strong>Корзина</strong>
            <small>{itemCount} поз.</small>
          </span>
          <strong className="floating-cart-total">{formatPrice(total)}</strong>
        </button>
      )}

      {cartOpen && (
        <div
          className="drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCartOpen(false);
          }}
        >
          <aside
            className="cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <div className="drawer-header">
              <div>
                <span className="drawer-kicker">Ваш выбор</span>
                <h2 id="cart-title">Предзаказ</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setCartOpen(false)}
                aria-label="Закрыть корзину"
              >
                <CloseIcon />
              </button>
            </div>

            {successId ? (
              <div className="success-state">
                <div className="success-mark">✓</div>
                <h3>Предзаказ получен</h3>
                <p className="success-number">{successId}</p>
                <p>
                  Оплачивать ничего не нужно. Мы проверим доступность и свяжемся
                  с вами для подтверждения.
                </p>
                <button
                  className="primary-button"
                  onClick={() => {
                    setSuccessId("");
                    setCartOpen(false);
                  }}
                >
                  Вернуться в меню
                </button>
              </div>
            ) : cartLines.length === 0 ? (
              <div className="empty-cart">
                <CartIcon />
                <h3>Корзина пока пустая</h3>
                <p>Добавьте блюда из меню — оплата на сайте не потребуется.</p>
                <button
                  className="primary-button"
                  onClick={() => setCartOpen(false)}
                >
                  Выбрать блюда
                </button>
              </div>
            ) : (
              <>
                <div className="cart-lines">
                  {cartLines.map((line) => (
                    <div className="cart-line" key={line.id}>
                      <img
                        src={line.image}
                        width="84"
                        height="84"
                        alt=""
                      />
                      <div className="cart-line-main">
                        <span>{line.supplier}</span>
                        <strong>{line.name}</strong>
                        <div className="cart-line-bottom">
                          <div className="quantity-control compact">
                            <button
                              onClick={() => changeQuantity(line.id, -1)}
                              aria-label="Уменьшить количество"
                            >
                              <MinusIcon />
                            </button>
                            <span>{line.quantity}</span>
                            <button
                              onClick={() => changeQuantity(line.id, 1)}
                              aria-label="Увеличить количество"
                            >
                              <PlusIcon />
                            </button>
                          </div>
                          <strong>{formatPrice(line.price * line.quantity)}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-total">
                  <span>Предварительная сумма</span>
                  <strong>{formatPrice(total)}</strong>
                </div>
                <form className="checkout-form" onSubmit={submitPreorder}>
                  <label>
                    <span>Имя</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      placeholder="Как к вам обращаться"
                      required
                      maxLength={80}
                    />
                  </label>
                  <label>
                    <span>Телефон</span>
                    <input
                      value={phone}
                      onChange={(event) =>
                        setPhone(normalizePhone(event.target.value))
                      }
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+7 (___) ___-__-__"
                      required
                    />
                  </label>
                  <div className="checkout-notice">
                    Вы отправляете заявку на предзаказ. Оплата на сайте не
                    производится. Заявка не обязывает вас приобретать товары.
                  </div>
                  <label className="consent-row">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(event) => setConsent(event.target.checked)}
                    />
                    <span>
                      Согласен на{" "}
                      <Link href="/privacy" target="_blank">
                        обработку персональных данных
                      </Link>
                    </span>
                  </label>
                  {error && <p className="form-error">{error}</p>}
                  <button
                    className="primary-button submit-button"
                    disabled={submitting}
                  >
                    {submitting ? "Отправляем…" : "Отправить предзаказ"}
                  </button>
                </form>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

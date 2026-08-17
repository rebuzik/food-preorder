"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useState } from "react";
import { formatPrice, type Product } from "../lib/products";

type Selection = Record<string, boolean>;
type CategoryFilter = "Все" | string;
type TopVote = { productId: string; votes: number };
const STORAGE_KEY = "eda-ryadom-vote-v1";
const DEFAULT_PAGE_SIZE = 24;
const ALL_SUPPLIERS = "Все поставщики";

function HeartIcon({ filled = false }: { filled?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={filled ? "filled" : ""}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function loadSelection(): Selection {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Selection; }
  catch { return {}; }
}

export function Storefront({ initialProducts }: { initialProducts: Product[] }) {
  const products = initialProducts.filter((product) => product.available);
  const [category, setCategory] = useState<CategoryFilter>("Все");
  const [supplier, setSupplier] = useState(ALL_SUPPLIERS);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(DEFAULT_PAGE_SIZE);
  const [filtersReady, setFiltersReady] = useState(false);
  const [topVotes, setTopVotes] = useState<TopVote[]>([]);
  const [selection, setSelection] = useState<Selection>({});
  const [ready, setReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [imageIndexes, setImageIndexes] = useState<Record<string, number>>({});

  useEffect(() => { queueMicrotask(() => { setSelection(loadSelection()); setReady(true); }); }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(selection)); }, [selection, ready]);
  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      setCatalogQuery(params.get("q") ?? "");
      const requestedCategory = params.get("category");
      const requestedSupplier = params.get("supplier");
      setCategory(requestedCategory && initialProducts.some((product) => product.category === requestedCategory) ? requestedCategory : "Все");
      setSupplier(requestedSupplier && initialProducts.some((product) => product.supplier === requestedSupplier) ? requestedSupplier : ALL_SUPPLIERS);
      setFiltersReady(true);
    });
  }, [initialProducts]);
  useEffect(() => {
    if (!filtersReady) return;
    const url = new URL(window.location.href);
    if (catalogQuery.trim()) url.searchParams.set("q", catalogQuery.trim()); else url.searchParams.delete("q");
    if (category !== "Все") url.searchParams.set("category", category); else url.searchParams.delete("category");
    if (supplier !== ALL_SUPPLIERS) url.searchParams.set("supplier", supplier); else url.searchParams.delete("supplier");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [catalogQuery, category, filtersReady, supplier]);
  useEffect(() => {
    fetch("/api/votes/top")
      .then((response) => response.ok ? response.json() : { votes: [] })
      .then((payload: { votes?: TopVote[] }) => setTopVotes(payload.votes ?? []))
      .catch(() => setTopVotes([]));
  }, []);
  useEffect(() => {
    if (!panelOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setPanelOpen(false);
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", close); document.body.style.overflow = ""; };
  }, [panelOpen]);

  const normalizedQuery = catalogQuery.trim().toLowerCase();
  const visibleProducts = products.filter((product) => {
    if (category !== "Все" && product.category !== category) return false;
    if (supplier !== ALL_SUPPLIERS && product.supplier !== supplier) return false;
    if (!normalizedQuery) return true;
    return [product.name, product.category, product.description, product.supplier]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });
  const displayedProducts = visibleProducts.slice(0, visibleCount);
  const selectedProducts = products.filter((product) => selection[product.id]);
  const categories = ["Все", ...new Set(products.map((product) => product.category).filter(Boolean))];
  const suppliers = [ALL_SUPPLIERS, ...new Set(products.map((product) => product.supplier).filter(Boolean))];
  const voteCounts = new Map(topVotes.map((item) => [item.productId, item.votes]));
  const toggleProduct = (id: string) => setSelection((current) => ({ ...current, [id]: !current[id] }));

  async function submitVote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!selectedProducts.length) return setError("Выберите хотя бы один товар.");
    setSubmitting(true);
    try {
      const response = await fetch("/api/preorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: selectedProducts.map((product) => ({ productId: product.id, quantity: 1 })) }),
      });
      const payload = (await response.json()) as { error?: string; code?: string; unavailableProductIds?: string[] };
      if (response.status === 409 && payload.unavailableProductIds?.length) {
        const unavailable = new Set(payload.unavailableProductIds);
        setSelection((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !unavailable.has(id))));
        setError(payload.error ?? "Некоторые товары больше недоступны. Мы убрали их из выбора — остальные позиции сохранены.");
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "Не удалось отправить пожелания.");
      setTopVotes((current) => {
        const counts = new Map(current.map((item) => [item.productId, item.votes]));
        selectedProducts.forEach((product) => counts.set(product.id, (counts.get(product.id) ?? 0) + 1));
        return [...counts].map(([productId, votes]) => ({ productId, votes })).sort((a, b) => b.votes - a.votes);
      });
      setSuccess(true); setSelection({}); localStorage.removeItem(STORAGE_KEY);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось отправить пожелания.");
    } finally { setSubmitting(false); }
  }

  return (
    <main className={selectedProducts.length > 0 ? "has-floating-selection" : ""}>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="ReFreshTech — на главную"><img src="/rft-logo.svg" alt="ReFreshTech" /></a>
        <nav aria-label="Основная навигация"><a href="#products">Товары</a><a href="#how">Как это работает</a></nav>
        <button className="header-cart" onClick={() => setPanelOpen(true)}><HeartIcon filled={selectedProducts.length > 0} /><span>Мой выбор · {selectedProducts.length}</span></button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <h1>Оставьте ваши пожелания</h1>
          <p className="hero-text">Отметьте понравившиеся товары, чтобы мы добавили их в наш ассортимент на следующей неделе.</p>
          <a className="primary-button" href="#products">Выбрать товары</a>
          <div className="preorder-note"><span aria-hidden="true">✓</span><p><strong>Это анонимные пожелания.</strong> Никаких контактов и оплаты.</p></div>
        </div>
        <figure className="hero-image"><img src="/images/hero-food.webp" width="1536" height="1024" alt="Подборка готовых блюд и продуктов" /></figure>
      </section>

      <section className="catalog" id="products">
        <div className="catalog-heading">
          <div><div className="section-kicker">Ваши пожелания</div><h2>Ассортимент на следующую неделю</h2><p>Можно выбрать несколько товаров — отметьте всё, что вам нравится.</p></div>
          <div className="supplier-tabs category-tabs" aria-label="Фильтр по категории">{(categories as CategoryFilter[]).map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => { setCategory(item); setVisibleCount(DEFAULT_PAGE_SIZE); }}>{item}</button>)}</div>
        </div>
        <div className="public-catalog-tools">
          <label className="public-catalog-search">
            <span aria-hidden="true">⌕</span>
            <input value={catalogQuery} onChange={(event) => { setCatalogQuery(event.target.value); setVisibleCount(DEFAULT_PAGE_SIZE); }} placeholder="Найти товар" aria-label="Поиск товаров" />
            {catalogQuery && <button type="button" onClick={() => { setCatalogQuery(""); setVisibleCount(DEFAULT_PAGE_SIZE); }} aria-label="Очистить поиск">×</button>}
          </label>
          {suppliers.length > 2 && <label className="public-supplier-filter"><span>Поставщик</span><select value={supplier} onChange={(event) => { setSupplier(event.target.value); setVisibleCount(DEFAULT_PAGE_SIZE); }}><option value={ALL_SUPPLIERS}>{ALL_SUPPLIERS}</option>{suppliers.slice(1).map((item) => <option value={item} key={item}>{item}</option>)}</select></label>}
          <span className="public-catalog-count">Найдено: {visibleProducts.length}</span>
        </div>
        <div className="product-grid">
          {displayedProducts.map((product) => {
            const selected = Boolean(selection[product.id]);
            const voteCount = voteCounts.get(product.id) ?? 0;
            const images = product.images?.length ? product.images : [product.image];
            const imageIndex = Math.min(imageIndexes[product.id] ?? 0, images.length - 1);
            return <article className={`product-card ${selected ? "selected" : ""}`} key={product.id}>
              <div className="product-image">
                <img src={images[imageIndex]} width="724" height="724" loading="lazy" decoding="async" alt={product.name} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/rft-logo.svg"; event.currentTarget.alt = "Изображение товара недоступно"; }} />
                {images.length > 1 && <div className="image-slider-controls" aria-label={`Фотографии ${product.name}`}><button onClick={() => setImageIndexes((current) => ({ ...current, [product.id]: (imageIndex - 1 + images.length) % images.length }))} aria-label="Предыдущее фото">‹</button><span>{imageIndex + 1}/{images.length}</span><button onClick={() => setImageIndexes((current) => ({ ...current, [product.id]: (imageIndex + 1) % images.length }))} aria-label="Следующее фото">›</button></div>}
                {selected && <span className="selected-badge">Хочу это</span>}
              </div>
              <div className="product-content"><div className="product-meta">{product.category}</div><h3>{product.name}</h3><strong className="product-price">{formatPrice(product.price)}</strong><div className="product-bottom"><span className="card-vote-count" aria-label={`Пожеланий: ${voteCount}`} title={`Пожеланий: ${voteCount}`}><HeartIcon filled /><strong>{voteCount}</strong></span><button className={`vote-button ${selected ? "selected" : ""}`} onClick={() => toggleProduct(product.id)} aria-pressed={selected}><HeartIcon filled={selected} /><span>{selected ? "Выбрано" : "Хочу это"}</span></button></div></div>
            </article>;
          })}
          {visibleProducts.length === 0 && <div className="public-catalog-empty"><strong>Ничего не найдено</strong><span>Попробуйте другой запрос или выберите другую категорию.</span></div>}
        </div>
        {visibleProducts.length > 0 && <div className="public-catalog-footer">{visibleCount < visibleProducts.length ? <button className="load-more-button" type="button" onClick={() => setVisibleCount((current) => Math.min(current + DEFAULT_PAGE_SIZE, visibleProducts.length))}>Смотреть ещё <span>{Math.min(DEFAULT_PAGE_SIZE, visibleProducts.length - visibleCount)}</span></button> : <span className="catalog-end-note">Все товары показаны</span>}</div>}
      </section>

      <section className="how-it-works" id="how"><div className="section-kicker">Как это работает</div><h2>Учтём ваши пожелания по еде — всё просто!</h2><ol><li><span>1</span><div><strong>Выберите товары</strong><p>Отметьте один или несколько товаров, которые хотели бы видеть в своём минимаркете.</p></div></li><li><span>2</span><div><strong>Отправьте пожелания анонимно</strong><p>Регистрация и личные данные не нужны — всё полностью анонимно и безопасно.</p></div></li><li><span>3</span><div><strong>Мы сформируем ассортимент</strong><p>Учтём ваши пожелания при выборе позиций на следующую неделю. Доставим товары в минимаркет при наличии у поставщиков.</p></div></li></ol></section>
      <footer>
        <a className="brand" href="#top"><img src="/rft-logo.svg" alt="ReFreshTech" /></a>
        <div className="footer-copy">
          <p>Вы выбираете — мы формируем ассортимент.</p>
          <p className="footer-legal"><span>Создание сайта — ММП</span><span>© ММП - 2026</span><span>Все права защищены</span></p>
        </div>
        <div className="footer-links"><a href="#products">Выбрать товары</a><a href="/admin">Для администратора</a></div>
      </footer>

      {selectedProducts.length > 0 && <button className="floating-cart-bar" onClick={() => setPanelOpen(true)}><span className="floating-cart-icon"><HeartIcon filled /></span><span className="floating-cart-copy"><strong>Мой выбор</strong><small>{selectedProducts.length} товар(а)</small></span><strong className="floating-cart-total">Отправить пожелания →</strong></button>}
      {panelOpen && <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPanelOpen(false)}><aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="selection-title">
        <div className="drawer-header"><div><span className="drawer-kicker">Ваш выбор</span><h2 id="selection-title">Хочу видеть у вас</h2></div><button className="icon-button" onClick={() => setPanelOpen(false)} aria-label="Закрыть"><CloseIcon /></button></div>
        {success ? <div className="success-state"><div className="success-mark">✓</div><h3>Спасибо! Пожелания приняты</h3><p>Ваш выбор поможет нам сформировать ассортимент ReFreshTech на следующую неделю.</p><button className="primary-button" onClick={() => { setSuccess(false); setPanelOpen(false); }}>Вернуться к ассортименту</button></div>
        : selectedProducts.length === 0 ? <div className="empty-cart"><HeartIcon /><h3>Пока ничего не выбрано</h3><p>Отметьте товары, которые хотели бы видеть в наших кофейнях и магазинах.</p><button className="primary-button" onClick={() => setPanelOpen(false)}>Перейти к товарам</button></div>
        : <form className="vote-form" onSubmit={submitVote}><div className="cart-lines">{selectedProducts.map((product) => <div className="cart-line" key={product.id}><img src={product.image} width="84" height="84" loading="lazy" alt={product.name} /><div className="cart-line-main"><span>{product.category}</span><strong>{product.name}</strong><b className="cart-line-price">{formatPrice(product.price)}</b><button type="button" className="remove-choice" onClick={() => toggleProduct(product.id)}>Убрать из выбора</button></div></div>)}</div><div className="anonymous-note"><strong>Анонимно, без контактов и оплаты</strong><span>Мы не просим имя, телефон или другие данные. Ваш выбор нужен только для формирования ассортимента.</span></div>{error && <p className="form-error">{error}</p>}<button className="primary-button submit-button" disabled={submitting}>{submitting ? "Отправляем…" : "Отправить пожелания"}</button></form>}
      </aside></div>}
    </main>
  );
}

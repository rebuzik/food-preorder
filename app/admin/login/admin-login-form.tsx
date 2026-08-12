"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function AdminLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Не удалось войти.");
      window.location.replace("/admin");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось войти.");
    } finally { setSubmitting(false); }
  }

  return <main className="admin-login-page"><section className="admin-login-card"><Link className="brand" href="/">ReFreshTech</Link><div><span>Панель управления</span><h1>Вход для администратора</h1><p>Введите логин и пароль администратора. Сеанс сохранится на 12 часов.</p></div><form onSubmit={submit}><label><span>Логин</span><input type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" maxLength={128} required autoFocus /></label><label><span>Пароль</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" maxLength={256} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={submitting || !username.trim() || !password}>{submitting ? "Проверяем…" : "Войти"}</button></form><small>Доступ только для администратора сайта</small></section></main>;
}

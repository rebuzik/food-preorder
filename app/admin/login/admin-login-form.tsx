"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function AdminLoginForm({ userName }: { userName: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Не удалось войти.");
      window.location.replace("/admin");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось войти.");
    } finally { setSubmitting(false); }
  }

  return <main className="admin-login-page"><section className="admin-login-card"><Link className="brand" href="/">ReFreshTech</Link><div><span>Панель управления</span><h1>Вход для администратора</h1><p>Введите пароль администратора. Сеанс сохранится на 12 часов.</p></div><form onSubmit={submit}><label><span>Пароль</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required autoFocus /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={submitting || !password}>{submitting ? "Проверяем…" : "Войти"}</button></form><small>Вы вошли в ChatGPT как {userName}</small></section></main>;
}

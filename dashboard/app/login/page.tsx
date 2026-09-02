"use client";

import { useState, type FormEvent } from "react";
import { Mark } from "../_components/Mark";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState(0);

  function showError(message: string) {
    setError(message);
    setErrorKey((key) => key + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.replace("/");
        return;
      }

      if (res.status === 401) {
        showError("Incorrect password");
      } else {
        showError("Something went wrong. Please try again.");
      }
      setPassword("");
    } catch {
      showError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-7">
      <div className="plate-in w-full max-w-[22rem]">
        <div className="mb-5 flex items-center gap-3">
          <Mark className="size-5 text-ink" />
          <span className="stencil text-[12px] text-ink">Claude Usage</span>
        </div>

        <div className="bracket border border-rule bg-raise">
          <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
            <span className="plate-label plate-label-ink">Access control</span>
            <span className="plate-label">Restricted</span>
          </div>

          <form onSubmit={handleSubmit} className="px-4 py-5">
            <label htmlFor="password" className="plate-label mb-2.5 block">
              Passphrase
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError(null);
              }}
              aria-invalid={error !== null}
              aria-describedby={error ? "password-error" : undefined}
              className={`field focus-ring w-full px-3 py-2 text-[13px] tracking-[0.2em] ${
                error ? "field-invalid" : ""
              }`}
              placeholder="••••••••"
            />

            {error ? (
              <p
                key={errorKey}
                id="password-error"
                role="alert"
                className="stencil mt-2.5 text-[10px] text-crit"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || password.length === 0}
              className="btn-solid focus-ring stencil mt-5 flex w-full items-center justify-center gap-2 px-3 py-2.5 text-[11px] disabled:cursor-not-allowed"
            >
              {submitting ? "Authenticating" : "Unlock plate"}
            </button>
          </form>

          <div className="tick-rail-h h-2 w-full border-t border-rule opacity-60" aria-hidden />
        </div>

        <p className="plate-label mt-4">Private instrument · single operator</p>
      </div>
    </main>
  );
}

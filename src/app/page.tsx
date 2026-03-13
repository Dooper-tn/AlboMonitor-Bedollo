"use client";

import { useState, FormEvent } from "react";
import { subscribeEmail } from "./actions";

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setMessage("");

    const result = await subscribeEmail(email);

    setLoading(false);

    if (result.error) {
      setMessage(result.error);
    } else {
      setSubmitted(true);
      setMessage("Grazie per esserti iscritto!");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Top Navigation */}
      <header className="container top-nav">
        <div className="logo">
          <div className="logo-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          </div>
          AlboMonitor
        </div>
        <div className="hidden sm:block">
          <a href="#" className="nav-link">
            Non hai ancora un account? <span>Iscriviti ora</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="container flex flex-grow flex-col items-center justify-center py-12 text-center sm:py-24">
        {/* Illustration Placeholder */}
        <div className="illustration animate-up">
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M40 85L80 85M20 100L100 100M60 20V80M50 30L60 20L70 30"
              stroke="#ff5c22"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x="30"
              y="15"
              width="60"
              height="80"
              rx="4"
              stroke="#1a1a1a"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Hero Section */}
        <div className="animate-up mb-12 max-w-2xl" style={{ animationDelay: "0.1s" }}>
          <h1 className="title">L'Albo Pretorio, semplificato.</h1>
          <p className="subtitle">
            Ricevi un riassunto chiaro dei nuovi bandi e atti ufficiali del tuo comune,
            grazie all'intelligenza artificiale.
          </p>
        </div>

        {/* Subscription Form */}
        <div className="animate-up w-full max-w-md" style={{ animationDelay: "0.2s" }}>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col items-start gap-2">
                <label htmlFor="email-input" className="pl-4 text-sm font-semibold uppercase tracking-tight text-slate-500">
                  Email
                </label>
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="es. mario.rossi@email.it"
                  required
                  className="input-field"
                  disabled={loading}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Invio in corso..." : "Ricevi gli aggiornamenti"}
              </button>
              <div className="mt-4 flex flex-col items-center justify-center gap-4 border-t border-slate-100 pt-6">
                <button type="button" className="text-sm font-medium text-slate-400 hover:text-slate-600">
                  &larr; Torna alla home
                </button>
              </div>
              {message && <p className="mt-2 text-sm font-medium text-red-500">{message}</p>}
            </form>
          ) : (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-slate-900">Ottimo lavoro!</p>
                <p className="text-slate-500">
                  Ti abbiamo inviato un'email a <span className="font-semibold text-orange-500">{email}</span>.
                </p>
              </div>
              <button onClick={() => setSubmitted(false)} className="text-sm font-semibold text-slate-400 hover:text-orange-500">
                Usa un altro indirizzo
              </button>
            </div>
          )}
        </div>

        {/* Feature Pills */}
        <div className="animate-up mt-16 flex flex-wrap justify-center gap-4" style={{ animationDelay: "0.3s" }}>
          <div className="feature-pill">Monitoring AI</div>
          <div className="feature-pill">Aggiornamenti quotidiani</div>
          <div className="feature-pill">Analisi PDF</div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-12 text-center">
        <p className="text-sm font-medium tracking-tight text-slate-400">
          AlboMonitor &bull; Bedollo Digital &bull; 2024
        </p>
      </footer>
    </div>
  );

}

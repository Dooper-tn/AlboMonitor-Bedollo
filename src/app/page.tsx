"use client";

import { useState, useEffect, FormEvent } from "react";
import { subscribeEmail } from "./actions";

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Standard URL search params parsing, robust for builds (no useSearchParams Suspense warning)
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      if (err === "token_mancante") setErrorMsg("Il link di verifica è incompleto o non valido.");
      else if (err === "token_non_valido") setErrorMsg("Il link di verifica è scaduto o inesistente. Prova a registrarti nuovamente.");
      else if (err === "db_error") setErrorMsg("Errore interno di verifica del server. Ti preghiamo di riprovare più tardi.");
      else setErrorMsg("Si è verificato un errore durante l'attivazione. Riprova.");

      // Clean the URL query params without triggering page reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubscribe = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setMessage("Inserisci un indirizzo email valido.");
      return;
    }

    setLoading(true);
    setMessage("");
    setErrorMsg("");

    try {
      const result = await subscribeEmail({ email });

      if (result.error) {
        setMessage(result.error);
      } else {
        setMessage(result.message || "Ti abbiamo inviato un link! Controlla la tua email per completare l'operazione.");
        setSubmitted(true);
      }
    } catch {
      setMessage("Errore di rete. Riprova più tardi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* ===== HEADER ===== */}
      <header className="page-container site-header">
        <div className="site-logo flex items-center gap-2">
          <img src="/stemma-bedollo.png" alt="Stemma Comune di Bedollo" style={{ height: "32px", width: "auto" }} />
          <span>AlboMonitor Bedollo</span>
        </div>
        <a href="#come-funziona" className="site-nav-link">
          Come funziona
        </a>
      </header>

      {/* ===== MAIN HERO SECTION ===== */}
      <main className="flex-1">
        <section className="page-container" style={{ paddingTop: "var(--space-16)", paddingBottom: "var(--space-20)" }}>
          
          {errorMsg && (
            <div className="animate-in pref-card error-msg" style={{ marginBottom: "var(--space-6)", borderColor: "var(--color-error)", backgroundColor: "var(--color-error-light)", padding: "var(--space-4)", borderRadius: "8px" }}>
              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span style={{ fontSize: "var(--text-small)", color: "var(--color-text-primary)", fontWeight: 500 }}>{errorMsg}</span>
              </div>
            </div>
          )}

          <div className="animate-in">
            <h1 className="hero-title">
              L&apos;Albo Pretorio del Comune di Bedollo,<br />
              semplificato e comprensibile.
            </h1>
          </div>

          <p className="animate-in hero-subtitle" style={{ marginTop: "var(--space-5)", animationDelay: "0.1s" }}>
            Ricevi un riassunto chiaro dei nuovi avvisi del Comune di Bedollo, elaborato dall&apos;AI per leggerlo in linguaggio chiaro e comprensibile, consegnato direttamente nella tua casella email.
          </p>

          {/* Form / Success Feedback */}
          <div className="animate-in" style={{ marginTop: "var(--space-10)", animationDelay: "0.2s" }}>
            {!submitted ? (
              <div>
                <form onSubmit={handleSubscribe} className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1 flex flex-col gap-1">
                    <input
                      id="email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Il tuo indirizzo email"
                      required
                      className="input-field"
                      disabled={loading}
                      aria-label="Indirizzo email"
                    />
                  </div>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? "Invio in corso..." : "Ricevi gli aggiornamenti"}
                  </button>
                </form>

                <div className="trust-row" style={{ marginTop: "var(--space-6)" }}>
                  <span className="trust-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                    Gratuito
                  </span>
                  <span className="trust-dot" />
                  <span className="trust-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Nessuno spam
                  </span>
                  <span className="trust-dot" />
                  <span className="trust-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                    Cancellati quando vuoi
                  </span>
                </div>

                {message && <p className="error-msg" style={{ marginTop: "var(--space-3)" }}>{message}</p>}
              </div>
            ) : (
              <div className="animate-in flex flex-col items-center" style={{ gap: "var(--space-5)", padding: "var(--space-8) var(--space-4)", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                <div className="success-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div className="text-center" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxWidth: "500px" }}>
                  <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-h2)", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
                    Controlla la tua email
                  </h2>
                  <p style={{ fontSize: "var(--text-body)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-relaxed)" }}>
                    {message}
                  </p>
                  <p style={{ fontSize: "var(--text-small)", color: "var(--color-text-tertiary)", marginTop: "var(--space-2)" }}>
                    Email di destinazione: <strong style={{ color: "var(--color-primary)" }}>{email}</strong>
                  </p>
                </div>
                <button onClick={() => setSubmitted(false)} className="btn-secondary" style={{ marginTop: "var(--space-2)" }}>
                  Torna indietro
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ===== COME FUNZIONA ===== */}
        <section id="come-funziona" className="steps-section" style={{ padding: "var(--space-20) 0" }}>
          <div className="page-container">
            <h2
              className="animate-in"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "var(--text-h2)",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                marginBottom: "var(--space-8)",
              }}
            >
              Come funziona
            </h2>

            <div className="steps-grid">
              {/* Step 1 */}
              <div className="step-card animate-in" style={{ animationDelay: "0.05s" }}>
                <div className="step-number">01</div>
                <h3 className="step-title">Fornisci la tua email</h3>
                <p className="step-desc">
                  Nessuna registrazione formale, nessuna password. Ti basta inserire l&apos;indirizzo email per richiedere il link di attivazione.
                </p>
              </div>

              {/* Step 2 */}
              <div className="step-card animate-in" style={{ animationDelay: "0.15s" }}>
                <div className="step-number">02</div>
                <h3 className="step-title">Verifica e personalizza</h3>
                <p className="step-desc">
                  Clicca sul link ricevuto per email per verificare il tuo indirizzo. Scegli subito quali categorie di atti ti interessano.
                </p>
              </div>

              {/* Step 3 */}
              <div className="step-card animate-in" style={{ animationDelay: "0.25s" }}>
                <div className="step-number">03</div>
                <h3 className="step-title">Ricevi i riassunti AI</h3>
                <p className="step-desc">
                  Ad ogni nuova pubblicazione, riceverai un&apos;email con riassunti in linguaggio semplice, chiaro e privo di burocrazia.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="page-container site-footer" style={{ padding: "var(--space-8) 0", borderTop: "1px solid var(--color-border)" }}>
        <div className="flex items-center justify-between" style={{ minHeight: "44px" }}>
          <p style={{ margin: 0 }}>Un servizio civico per la comunità di Bedollo</p>
          <a href="/" className="site-nav-link" style={{ fontWeight: 600 }}>Home Page</a>
        </div>
      </footer>
    </div>
  );
}

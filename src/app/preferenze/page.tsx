"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSubscriberByToken, getCategories, updatePreferences, unsubscribe } from "../actions";

export default function PreferenzePage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscriber, setSubscriber] = useState<{ id: string; email: string; preferences: { categories?: string[]; relevance?: string; send_recent?: boolean; recent_count?: number }; status: string } | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // Preference state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState(true);
  const [relevance, setRelevance] = useState<"all" | "locale">("all");
  const [sendRecent, setSendRecent] = useState(false);
  const [recentCount, setRecentCount] = useState(5);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    const v = params.get("verify");
    
    setToken(t);
    setIsVerified(v === "success");

    if (t) {
      Promise.all([getSubscriberByToken(t), getCategories()]).then(([sub, cats]) => {
        setCategories(cats);
        if (sub && (sub.status === "active" || sub.status === "pending")) {
          setSubscriber(sub);
          const prefs = sub.preferences;
          if (prefs) {
            const isAll = !prefs.categories || prefs.categories.includes("*");
            setAllCategories(isAll);
            setSelectedCategories(isAll ? cats : (prefs.categories || []));
            setRelevance((prefs.relevance as "all" | "locale") || "all");
            setSendRecent(prefs.send_recent || false);
            setRecentCount(prefs.recent_count || 5);
          }
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const toggleCategory = (cat: string) => {
    setAllCategories(false);
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleAllCategories = () => {
    if (allCategories) {
      setAllCategories(false);
      setSelectedCategories([]);
    } else {
      setAllCategories(true);
      setSelectedCategories(categories);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setMessage("");

    try {
      const result = await updatePreferences(token, {
        categories: allCategories ? ["*"] : selectedCategories,
        relevance,
        send_recent: sendRecent,
        recent_count: recentCount,
      });

      if (result.error) {
        setMessage(result.error);
        setMessageType("error");
      } else {
        setMessage("Preferenze salvate con successo.");
        setMessageType("success");
        setIsVerified(false); // Hide the verification banner once preferences have been configured
      }
    } catch {
      setMessage("Errore di rete. Riprova più tardi.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!token) return;
    setSaving(true);

    try {
      const result = await unsubscribe(token);

      if (result.error) {
        setMessage(result.error);
        setMessageType("error");
      } else {
        setUnsubscribed(true);
      }
    } catch {
      setMessage("Errore di rete. Riprova più tardi.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-body)" }}>Caricamento...</p>
      </div>
    );
  }

  if (!token || !subscriber) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-4">
        <div className="site-logo mb-8 flex items-center gap-2">
          <img src="/stemma-bedollo.png" alt="Stemma Comune di Bedollo" style={{ height: "32px", width: "auto" }} />
          <span>AlboMonitor Bedollo</span>
        </div>
        <p className="text-center" style={{ color: "var(--color-text-secondary)", lineHeight: "var(--leading-relaxed)", maxWidth: "400px" }}>
          Link non valido o iscrizione non trovata.<br />
          Se hai bisogno di assistenza, effettua una nuova richiesta dalla <Link href="/" style={{ fontWeight: 600, color: "var(--color-accent)", textDecoration: "none" }}>pagina principale</Link>.
        </p>
      </div>
    );
  }

  if (unsubscribed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-4">
        <div className="site-logo mb-8 flex items-center gap-2">
          <img src="/stemma-bedollo.png" alt="Stemma Comune di Bedollo" style={{ height: "32px", width: "auto" }} />
          <span>AlboMonitor Bedollo</span>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-tertiary)]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="mt-6 font-bold" style={{ fontSize: "var(--text-h3)", color: "var(--color-text-primary)" }}>Iscrizione cancellata</p>
        <p className="mt-2 text-center" style={{ fontSize: "var(--text-small)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-relaxed)" }}>
          Non riceverai più notifiche. Se cambi idea, puoi sempre iscriverti nuovamente dalla <Link href="/" style={{ fontWeight: 600, color: "var(--color-accent)", textDecoration: "none" }}>pagina principale</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="page-container site-header">
        <div className="site-logo flex items-center gap-2">
          <img src="/stemma-bedollo.png" alt="Stemma Comune di Bedollo" style={{ height: "32px", width: "auto" }} />
          <span>AlboMonitor Bedollo</span>
        </div>
        <Link href="/" className="site-nav-link" style={{ fontWeight: 600 }}>Home</Link>
      </header>

      <main className="page-container flex-grow py-12" style={{ maxWidth: "560px" }}>
        {isVerified && (
          <div className="animate-in pref-card" style={{ marginBottom: "var(--space-6)", borderColor: "var(--color-success)", backgroundColor: "var(--color-success-light)", padding: "var(--space-4)", borderRadius: "8px" }}>
            <div className="flex items-start gap-3">
              <div className="success-icon" style={{ width: "24px", height: "24px", minWidth: "24px", color: "var(--color-success)", backgroundColor: "transparent", padding: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <h4 style={{ fontSize: "var(--text-small)", color: "var(--color-text-primary)", fontWeight: 700, margin: "0 0 2px 0" }}>Email verificata con successo!</h4>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", margin: 0, lineHeight: "1.4" }}>
                  Benvenuto su AlboMonitor Bedollo. Seleziona di seguito quali tipologie di avviso comunali desideri ricevere per attivare il servizio.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="animate-in">
          <h1 className="hero-title" style={{ fontSize: "var(--text-h1)", marginBottom: "var(--space-1)" }}>Le tue preferenze</h1>
          <p style={{ fontSize: "var(--text-small)", color: "var(--color-text-secondary)", marginBottom: "var(--space-8)" }}>
            Iscritto come <strong style={{ color: "var(--color-text-primary)" }}>{subscriber.email}</strong>
          </p>
        </div>

        <div className="animate-in flex flex-col gap-6" style={{ animationDelay: "0.1s" }}>
          
          {/* Categories */}
          <div className="pref-card">
            <h3 className="pref-title">Categorie di avviso</h3>
            <p className="pref-desc">Seleziona quali tipologie di atti comunali vuoi ricevere nella tua email.</p>
            <label className="pref-check">
              <input type="checkbox" checked={allCategories} onChange={toggleAllCategories} />
              <span style={{ fontWeight: 600 }}>Tutte le categorie</span>
            </label>
            {categories.length > 0 && !allCategories && (
              <div className="flex flex-wrap gap-2" style={{ marginTop: "var(--space-3)" }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`cat-chip ${selectedCategories.includes(cat) ? "cat-chip-active" : ""}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Relevance */}
          <div className="pref-card">
            <h3 className="pref-title">Provenienza territoriale</h3>
            <p className="pref-desc">Vuoi ricevere solo gli atti inerenti a Bedollo o anche quelli pubblicati per altri enti?</p>
            <div className="flex flex-col gap-1">
              <label className="pref-check">
                <input type="radio" name="relevance" checked={relevance === "all"} onChange={() => setRelevance("all")} />
                <span>Tutti gli avvisi pubblicati</span>
              </label>
              <label className="pref-check">
                <input type="radio" name="relevance" checked={relevance === "locale"} onChange={() => setRelevance("locale")} />
                <span>Solo quelli relativi direttamente al Comune di Bedollo</span>
              </label>
            </div>
          </div>

          {/* Recent notices */}
          <div className="pref-card">
            <h3 className="pref-title">Invio storico recente</h3>
            <p className="pref-desc">Vuoi che il sistema ti invii subito gli atti più recenti all&apos;attivazione?</p>
            <label className="pref-check">
              <input type="checkbox" checked={sendRecent} onChange={(e) => setSendRecent(e.target.checked)} />
              <span>Inviami subito gli atti più recenti</span>
            </label>
            {sendRecent && (
              <div className="flex items-center gap-3" style={{ marginTop: "var(--space-3)" }}>
                <label style={{ fontSize: "var(--text-small)", color: "var(--color-text-secondary)" }}>Quantità:</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={recentCount}
                  onChange={(e) => setRecentCount(Number(e.target.value))}
                  className="flex-1"
                />
                <span style={{ fontSize: "var(--text-small)", fontWeight: 700, color: "var(--color-primary)", minWidth: "2rem", textAlign: "center" }}>
                  {recentCount}
                </span>
              </div>
            )}
          </div>

          {/* Save Button */}
          <button onClick={handleSave} className="btn-primary" style={{ width: "100%" }} disabled={saving || (!allCategories && selectedCategories.length === 0)}>
            {saving ? "Salvataggio in corso..." : "Salva preferenze ed attiva"}
          </button>

          {message && (
            <p className={`text-center font-semibold animate-in`} style={{ fontSize: "var(--text-small)", color: messageType === "success" ? "var(--color-success)" : "var(--color-error)" }}>
              {message}
            </p>
          )}

          {/* Unsubscribe link */}
          <div style={{ marginTop: "var(--space-6)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--color-border)" }}>
            {!showConfirmDelete ? (
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="site-nav-link"
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "block", textAlign: "center", fontFamily: "inherit" }}
              >
                Cancella iscrizione ad AlboMonitor Bedollo
              </button>
            ) : (
              <div className="animate-in pref-card text-center" style={{ borderColor: "var(--color-error)", backgroundColor: "var(--color-error-light)" }}>
                <p style={{ fontSize: "var(--text-small)", color: "var(--color-text-primary)", fontWeight: 600, margin: "0 0 var(--space-3) 0" }}>Sei sicuro? Non riceverai più alcuna notifica.</p>
                <div className="flex justify-center gap-3">
                  <button onClick={handleUnsubscribe} disabled={saving} className="btn-primary" style={{ backgroundColor: "var(--color-error)", minHeight: "auto", fontSize: "var(--text-small)", padding: "var(--space-2) var(--space-4)" }}>
                    {saving ? "..." : "Conferma cancellazione"}
                  </button>
                  <button onClick={() => setShowConfirmDelete(false)} className="btn-secondary" style={{ minHeight: "auto", fontSize: "var(--text-small)", padding: "var(--space-2) var(--space-4)", backgroundColor: "var(--color-surface)" }}>
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="page-container site-footer" style={{ padding: "var(--space-8) 0", borderTop: "1px solid var(--color-border)" }}>
        <div className="flex items-center justify-between" style={{ minHeight: "44px" }}>
          <p style={{ margin: 0 }}>AlboMonitor Bedollo &bull; 2026</p>
          <a href="/" className="site-nav-link" style={{ fontWeight: 600 }}>Home Page</a>
        </div>
      </footer>
    </div>
  );
}

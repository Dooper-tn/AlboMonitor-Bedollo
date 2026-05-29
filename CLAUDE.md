# AlboMonitor Bedollo — Design System & Regole UI

## Contesto del progetto

AlboMonitor Bedollo è un servizio civico che monitora l'Albo Pretorio del Comune di Bedollo (TN). Quando viene pubblicato un nuovo atto, il sistema genera un riassunto comprensibile via AI e lo invia agli iscritti per email. L'homepage è una landing page di conversione: il suo unico scopo è trasformare il visitatore in iscritto.

**Tono del design**: istituzionale moderno. Deve trasmettere fiducia, trasparenza e semplicità. Non deve sembrare né un sito della PA anni 2000, né una startup tech. Il riferimento estetico è a metà tra un servizio pubblico scandinavo e un'app utility ben curata — pulito, sobrio, autorevole ma umano.

**Target utenti**: residenti e interessati al Comune di Bedollo, età 30-70+. Il design deve essere accessibile, leggibile, e non intimidire chi ha poca confidenza con il digitale.

---

## Palette colori

Usa ESCLUSIVAMENTE questi colori. Non introdurre altri colori se non esplicitamente richiesto.

```
/* Colori primari */
--color-primary: #1B4D3E;          /* Verde bosco scuro — identità, CTA principali, header */
--color-primary-hover: #153D31;    /* Verde bosco più scuro — hover su CTA primarie */
--color-primary-light: #E8F0ED;    /* Verde chiaro tenue — sfondi sezioni alternate, badge */

/* Colori di accento */
--color-accent: #C7552B;           /* Terracotta — dettagli, icone, link attivi, elementi che devono risaltare */
--color-accent-hover: #A84722;     /* Terracotta scuro — hover */
--color-accent-light: #FDF0EB;     /* Terracotta chiaro — sfondo notifiche, highlight leggeri */

/* Neutri */
--color-bg: #FAFAF8;              /* Bianco caldo — sfondo pagina principale */
--color-surface: #FFFFFF;          /* Bianco puro — card, form, elementi sovrapposti */
--color-border: #E2E0DB;          /* Grigio caldo chiaro — bordi card, separatori */
--color-border-focus: #1B4D3E;    /* Verde primario — bordi input in focus */

/* Testo */
--color-text-primary: #1A1A18;    /* Quasi nero caldo — titoli, testo principale */
--color-text-secondary: #5C5B56;  /* Grigio scuro caldo — testo secondario, descrizioni */
--color-text-tertiary: #8A8983;   /* Grigio medio — placeholder, label, caption */
--color-text-inverse: #FFFFFF;    /* Bianco — testo su sfondi scuri */

/* Stato / feedback */
--color-success: #2D7A4F;         /* Verde — conferma iscrizione */
--color-success-light: #EBF5F0;   /* Verde chiaro — sfondo messaggi successo */
--color-error: #C23B22;           /* Rosso sobrio — errori validazione */
--color-error-light: #FDF0ED;     /* Rosso chiaro — sfondo messaggi errore */
```

**Regole d'uso dei colori**:
- Lo sfondo della pagina è `--color-bg` (bianco caldo, mai bianco puro #FFF per il body).
- Le sezioni alternate usano `--color-primary-light` come sfondo per creare ritmo visivo.
- I bottoni primari sono `--color-primary` con testo `--color-text-inverse`.
- I link nel corpo del testo usano `--color-accent`.
- Non usare MAI gradienti sui bottoni. I colori sono sempre piatti.
- Il rapporto di contrasto testo/sfondo deve sempre superare 4.5:1 (WCAG AA).

---

## Tipografia

```
/* Font stack */
--font-heading: 'Source Serif 4', Georgia, 'Times New Roman', serif;
--font-body: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;  /* Solo se servono dati tecnici */

/* Importa da Google Fonts */
/* Source Serif 4: pesi 600, 700 */
/* DM Sans: pesi 400, 500, 600 */
```

**Regole tipografiche**:
- I titoli (h1, h2, h3) usano **Source Serif 4** (serif). Questo dà autorevolezza istituzionale senza sembrare vecchio.
- Tutto il resto (body, bottoni, label, input, caption) usa **DM Sans** (sans-serif). Moderno, leggibile, friendly.
- Non mescolare MAI altri font. Solo questi due.

```
/* Scala tipografica */
--text-hero: 2.75rem;     /* 44px — solo il titolo principale dell'homepage */
--text-h1: 2rem;          /* 32px */
--text-h2: 1.5rem;        /* 24px — titoli di sezione */
--text-h3: 1.25rem;       /* 20px — sottotitoli */
--text-body: 1rem;         /* 16px — testo base */
--text-body-large: 1.125rem; /* 18px — paragrafi importanti, sottotitolo hero */
--text-small: 0.875rem;    /* 14px — caption, label form, note */
--text-xs: 0.75rem;        /* 12px — badge, tag, micro-testo */

/* Altezza riga */
--leading-tight: 1.2;     /* Titoli */
--leading-normal: 1.6;    /* Body text */
--leading-relaxed: 1.75;  /* Paragrafi lunghi */

/* Peso */
--weight-regular: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;
```

**Regole aggiuntive**:
- Il titolo hero (h1 principale) usa `--text-hero` con peso 700 e line-height `--leading-tight`.
- I sottotitoli sotto i titoli hero usano `--text-body-large`, peso 400, colore `--color-text-secondary`.
- Le label dei form usano `--text-small`, peso 500, colore `--color-text-secondary`.
- Il testo nei bottoni usa `--text-body` (o `--text-small` per bottoni secondari), peso 600.
- La lunghezza massima di una riga di testo è `38em` (~65 caratteri). Usa `max-width` sui paragrafi.

---

## Spaziatura e layout

```
/* Scala di spacing (multipli di 4px) */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;       /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;       /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;      /* 48px */
--space-16: 4rem;      /* 64px */
--space-20: 5rem;      /* 80px */
--space-24: 6rem;      /* 96px */
```

**Layout homepage**:
- Larghezza massima del contenuto: `720px` (è una landing page, non un dashboard — tieni tutto stretto e focalizzato).
- Padding orizzontale del container: `--space-6` su mobile, `--space-8` su tablet+.
- Spazio tra le sezioni principali: `--space-20` su mobile, `--space-24` su desktop.
- Spazio tra titolo di sezione e contenuto sotto: `--space-8`.
- Tutto il layout è a colonna singola, centrato. Non usare layout multi-colonna tranne che nella sezione "Come funziona" (3 colonne su desktop, 1 su mobile).

**Breakpoints**:
```
--bp-sm: 640px;
--bp-md: 768px;
--bp-lg: 1024px;
```

---

## Componenti

### Bottoni

```
/* Bottone primario (CTA principale — "Iscriviti", "Conferma") */
background: var(--color-primary);
color: var(--color-text-inverse);
font-family: var(--font-body);
font-size: var(--text-body);
font-weight: 600;
padding: var(--space-3) var(--space-6);    /* 12px 24px */
border-radius: 8px;
border: none;
cursor: pointer;
transition: background-color 0.15s ease, transform 0.1s ease;
/* Hover */
background: var(--color-primary-hover);
transform: translateY(-1px);
/* Active */
transform: translateY(0);
/* Disabled */
opacity: 0.5;
cursor: not-allowed;
```

```
/* Bottone secondario (azioni secondarie — "Indietro", "Salta") */
background: transparent;
color: var(--color-primary);
font-family: var(--font-body);
font-size: var(--text-small);
font-weight: 600;
padding: var(--space-2) var(--space-5);    /* 8px 20px */
border-radius: 8px;
border: 1.5px solid var(--color-border);
cursor: pointer;
transition: border-color 0.15s ease, background-color 0.15s ease;
/* Hover */
border-color: var(--color-primary);
background: var(--color-primary-light);
```

**Regole bottoni**:
- La CTA primaria in tutta la pagina è UNA SOLA. Non mettere due bottoni verdi nella stessa schermata.
- I bottoni hanno sempre il testo centrato. Mai icone sole — sempre testo, opzionalmente con icona a sinistra.
- Larghezza: `auto` (si adatta al contenuto) oppure `100%` su mobile per i form.
- Non usare MAI bottoni con solo bordo per la CTA principale.

### Card

```
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: 12px;
padding: var(--space-6);               /* 24px */
box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
transition: box-shadow 0.2s ease;
```

**Regole card**:
- Le card della sezione "Come funziona" (i 3 passi) hanno un'icona/numero in alto, un titolo in `--text-h3` serif, e una descrizione in `--text-body` sans-serif.
- Le card NON hanno hover effect a meno che non siano cliccabili.
- Le card delle categorie/preferenze sono più compatte: padding `--space-4`, e hanno un checkbox o toggle integrato.
- Non sovraccaricare le card. Max 1 titolo + 1 paragrafo + 1 azione opzionale.

### Input e form

```
/* Input testuale / email */
background: var(--color-surface);
border: 1.5px solid var(--color-border);
border-radius: 8px;
padding: var(--space-3) var(--space-4);   /* 12px 16px */
font-family: var(--font-body);
font-size: var(--text-body);
color: var(--color-text-primary);
transition: border-color 0.15s ease, box-shadow 0.15s ease;
/* Placeholder */
color: var(--color-text-tertiary);
/* Focus */
border-color: var(--color-border-focus);
box-shadow: 0 0 0 3px rgba(27, 77, 62, 0.1);
outline: none;
/* Errore */
border-color: var(--color-error);
box-shadow: 0 0 0 3px rgba(194, 59, 34, 0.08);
```

```
/* Checkbox / preferenze categoria */
/* Usa card selezionabili, non checkbox nativi */
background: var(--color-surface);
border: 1.5px solid var(--color-border);
border-radius: 8px;
padding: var(--space-3) var(--space-4);
cursor: pointer;
transition: all 0.15s ease;
/* Stato selezionato */
border-color: var(--color-primary);
background: var(--color-primary-light);
/* Indicatore check: piccolo cerchio o spunta in --color-primary */
```

**Regole form**:
- Ogni input ha una `<label>` sopra, in `--text-small`, peso 500, colore `--color-text-secondary`.
- Il messaggio di errore appare sotto l'input, in `--text-small`, colore `--color-error`.
- Tra un campo e l'altro: `--space-5` (20px).
- Il bottone submit è sempre in fondo, separato dai campi da `--space-8`.
- L'input email nell'hero può essere inline con il bottone su desktop (input + bottone sulla stessa riga).

### Sezione "Come funziona"

- 3 step numerati (non icone astratte — usa numeri: 01, 02, 03).
- I numeri sono grandi (`--text-h1`), in `--color-primary`, peso 700, font serif.
- Titolo dello step in `--text-h3`, font serif, peso 600.
- Descrizione in `--text-body`, font sans-serif, colore `--color-text-secondary`.
- Su desktop: 3 colonne con gap `--space-6`. Su mobile: colonna singola con gap `--space-8`.
- Sfondo di questa sezione: `--color-primary-light` per distinguerla dal resto.

---

## Iconografia

- Usa Lucide Icons (già disponibile in React come `lucide-react`). Sono pulite, minimali, coerenti.
- Dimensione standard icone: 20px nel body, 24px nei titoli, 32px nelle card "Come funziona".
- Colore icone: `--color-primary` o `--color-accent` — mai grigio o nero pieno.
- Non usare emoji come icone. Mai.

---

## Micro-interazioni e animazioni

```
/* Transizione standard per tutti gli elementi interattivi */
transition: all 0.15s ease;

/* Animazione di entrata per le sezioni (al caricamento della pagina) */
/* Usa un leggero fade-in + slide-up */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Applica con delay crescente: sezione 1 = 0ms, sezione 2 = 100ms, sezione 3 = 200ms */
```

**Regole animazioni**:
- Le animazioni sono SOTTILI. Mai bounce, mai elasticità, mai durate oltre 300ms.
- Gli unici elementi animati sono: entrata delle sezioni al load, hover sui bottoni, focus sugli input, transizione di stato dei checkbox.
- Non animare lo scroll. Non usare parallax. Non usare animazioni continue/loop.
- Rispetta `prefers-reduced-motion`: disabilita tutte le animazioni se attivo.

---

## Struttura homepage (guida al layout)

L'homepage segue questa struttura verticale, dall'alto in basso:

1. **Header minimale**: logo/nome a sinistra ("AlboMonitor Bedollo"), nessun menu di navigazione. Opzionalmente un piccolo link "Come funziona" che scrolla alla sezione. Sfondo: `--color-bg`.

2. **Hero section**: titolo principale (serif, grande, scuro), sottotitolo che spiega il servizio in una riga (sans-serif, `--color-text-secondary`), campo email + bottone CTA inline. Sfondo: `--color-bg`.

3. **Social proof / fiducia** (opzionale): una riga sotto l'hero con un micro-testo tipo "Servizio gratuito · Nessuno spam · Cancellati quando vuoi" in `--text-small`, colore `--color-text-tertiary`, con piccole icone Lucide accanto.

4. **Sezione "Come funziona"**: sfondo `--color-primary-light`, 3 step in card bianche.

5. **Sezione preferenze** (dopo inserimento email): form di scelta categorie (card selezionabili), opzione "tutti gli avvisi", bottone conferma.

6. **Footer minimale**: una riga con "Un progetto per la comunità di Bedollo" + link privacy policy. Font `--text-small`, colore `--color-text-tertiary`.

---

## Regole generali di stile

- **Semplicità prima di tutto**: in caso di dubbio, togli elementi piuttosto che aggiungerne. Meno è meglio.
- **Niente effetti decorativi gratuiti**: no gradienti, no pattern di sfondo, no ombre esagerate, no bordi colorati.
- **Gerarchia visiva chiara**: in ogni sezione deve essere immediatamente ovvio cosa leggere per primo, cosa per secondo, e dove cliccare.
- **Mobile-first**: progetta prima per schermi piccoli (375px), poi adatta per desktop.
- **Accessibilità**: tutti i colori rispettano il contrasto WCAG AA. Gli input hanno label esplicite. I bottoni hanno dimensione minima 44x44px come area cliccabile.
- **Lingua**: tutta l'interfaccia è in italiano. I testi devono essere chiari, brevi, diretti. Niente burocratese ("Si prega di..." → "Inserisci..."). Tono: informale ma rispettoso, come un vicino competente.
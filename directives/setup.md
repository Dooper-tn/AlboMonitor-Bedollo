# SOP: Configurazione Iniziale e Setup (Progetto AlboMonitor)

Questa procedura deve essere eseguita all'avvio del progetto o quando mancano configurazioni chiave.

## 1. Verifica Dipendenze
- Esegui `npm list --depth=0` per verificare se i pacchetti sono installati.
- Se `node_modules` non esiste, proponi `npm install`.

## 2. Verifica .env.local
- Verifica l'esistenza di `.env.local`.
- Se manca, usa `.env.example` come template e chiedi all'utente le chiavi mancanti (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`).

## 3. Verifica Stato GitHub
- Verifica se il comando `git` è disponibile.
- Se `git` non è disponibile, usa il server MCP `github` per tracciare il backup del progetto.
- Assicurati che il repository remoto sia configurato correttamente in `package.json` o tramite i log del server.

## 4. Verifica Connettività Supabase
- Testa una query veloce (es. `SELECT 1`) usando `mcp_supabase_query` se configurato, o valida le chiavi via fetch verso l'URL API.

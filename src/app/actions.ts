'use server';

import { createClient } from '@supabase/supabase-js';

// Inizializzazione del client Supabase lato server
// Assicurati che queste variabili d'ambiente siano definite nel tuo file .env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function subscribeEmail(email: string) {
    // Validazione base dell'email
    if (!email || !email.includes('@')) {
        return { error: "Indirizzo email non valido." };
    }

    try {
        // Inserimento nella tabella 'subscribers'
        const { error } = await supabase
            .from('subscribers')
            .insert([{ email }]);

        if (error) {
            // Gestione violazione vincolo di unicità (codice Postgres 23505)
            if (error.code === '23505') {
                return { error: "Questa email è già iscritta." };
            }
            console.error("Supabase error:", error);
            return { error: "Si è verificato un errore durante l'iscrizione. Riprova più tardi." };
        }

        return { success: true };

    } catch (err) {
        console.error("Unexpected error:", err);
        return { error: "Si è verificato un errore imprevisto." };
    }
}
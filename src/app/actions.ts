'use server';

import { createClient } from '@supabase/supabase-js';
import { sendNotifications, sendVerificationEmail } from '@/lib/notifications';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getCategories(): Promise<string[]> {
    const { data } = await supabase
        .from('notices')
        .select('category')
        .not('category', 'is', null);

    if (!data) return [];
    const unique = [...new Set(data.map(n => n.category).filter(Boolean))];
    return unique.sort();
}

interface SubscribeData {
    email: string;
}

export async function subscribeEmail(data: SubscribeData) {
    const { email } = data;

    if (!email || !email.includes('@')) {
        return { error: "Indirizzo email non valido." };
    }

    try {
        // Check if email already exists
        const { data: existing, error: fetchErr } = await supabase
            .from('subscribers')
            .select('id, token, status')
            .eq('email', email)
            .maybeSingle();

        if (fetchErr) {
            console.error("Fetch subscriber error:", fetchErr);
            return { error: "Si è verificato un errore di rete. Riprova più tardi." };
        }

        if (existing) {
            const isPending = existing.status === 'pending';
            // Send email: verification email if pending, or access link if already active
            const sent = await sendVerificationEmail(email, existing.token, isPending);
            
            if (!sent) {
                return { error: "Impossibile inviare l'email in questo momento. Riprova più tardi." };
            }

            return {
                success: true,
                isNew: isPending,
                message: isPending
                    ? "Abbiamo inviato un nuovo link di verifica alla tua email per completare l'iscrizione."
                    : "Questa email è già iscritta. Ti abbiamo inviato un link via email per gestire le tue preferenze."
            };
        }

        // New subscriber flow
        const token = crypto.randomUUID();
        const defaultPreferences = {
            categories: ['*'],
            relevance: 'all',
            send_recent: false,
            recent_count: 5,
        };

        const { error: insertErr } = await supabase
            .from('subscribers')
            .insert([{
                email,
                token,
                status: 'pending',
                preferences: defaultPreferences
            }]);

        if (insertErr) {
            console.error("Insert subscriber error:", insertErr);
            return { error: "Si è verificato un errore durante la registrazione. Riprova più tardi." };
        }

        const sent = await sendVerificationEmail(email, token, true);
        if (!sent) {
            return { error: "Registrazione effettuata, ma non è stato possibile inviare l'email di verifica. Riprova più tardi." };
        }

        return {
            success: true,
            isNew: true,
            message: "Iscrizione avviata! Abbiamo inviato un link di verifica alla tua email per impostare le preferenze e completare l'iscrizione."
        };

    } catch (err) {
        console.error("Unexpected error in subscribeEmail:", err);
        return { error: "Si è verificato un errore imprevisto." };
    }
}

export async function getSubscriberByToken(token: string) {
    if (!token) return null;

    const { data } = await supabase
        .from('subscribers')
        .select('id, email, preferences, status')
        .eq('token', token)
        .single();

    return data;
}

export async function updatePreferences(token: string, preferences: {
    categories: string[];
    relevance: 'all' | 'locale';
    send_recent: boolean;
    recent_count: number;
}) {
    if (!token) return { error: "Token mancante." };

    const { data: subscriber, error: fetchErr } = await supabase
        .from('subscribers')
        .select('id, status')
        .eq('token', token)
        .single();

    if (fetchErr || !subscriber) {
        return { error: "Iscrizione non trovata." };
    }

    const { error } = await supabase
        .from('subscribers')
        .update({
            preferences,
            status: 'active' // Ensure they are active when updating preferences
        })
        .eq('token', token);

    if (error) {
        console.error("Update preferences error:", error);
        return { error: "Errore nell'aggiornamento delle preferenze." };
    }

    // Se l'utente vuole ricevere gli avvisi recenti adesso, innesca l'invio
    if (preferences.send_recent) {
        sendNotifications(subscriber.id).catch(err =>
            console.error("Errore invio avvisi recenti all'attivazione:", err)
        );
    }

    return { success: true };
}

export async function unsubscribe(token: string) {
    if (!token) return { error: "Token mancante." };

    try {
        // Fetch subscriber first to get their ID
        const { data: subscriber, error: fetchErr } = await supabase
            .from('subscribers')
            .select('id')
            .eq('token', token)
            .maybeSingle();

        if (fetchErr || !subscriber) {
            console.error("Unsubscribe fetch error:", fetchErr);
            return { error: "Iscrizione non trovata o già cancellata." };
        }

        // Delete all sent notification records for this subscriber
        const { error: trackingErr } = await supabase
            .from('sent_notifications')
            .delete()
            .eq('subscriber_id', subscriber.id);

        if (trackingErr) {
            console.error("Error deleting sent notification tracking:", trackingErr);
            // We proceed anyway to try deleting the subscriber
        }

        // Delete the subscriber record completely from the database
        const { error: deleteErr } = await supabase
            .from('subscribers')
            .delete()
            .eq('id', subscriber.id);

        if (deleteErr) {
            console.error("Error deleting subscriber:", deleteErr);
            return { error: "Errore durante la cancellazione dal database." };
        }

        return { success: true };

    } catch (err) {
        console.error("Unexpected unsubscribe error:", err);
        return { error: "Si è verificato un errore imprevisto." };
    }
}

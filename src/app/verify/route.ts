import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Estrai l'URL originale dalla richiesta
        const reqUrl = new URL(request.url);

        // Correzione per il Reverse Proxy di Google Cloud Run
        const forwardedHost = request.headers.get('x-forwarded-host');
        const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

        if (forwardedHost) {
            reqUrl.host = forwardedHost;
            reqUrl.protocol = `${forwardedProto}:`;
            reqUrl.port = ''; // Rimuove la porta interna (es. 8080)
        }

        // Usiamo l'URL pubblico come base per tutti i redirect
        const baseUrl = reqUrl.origin;
        const token = reqUrl.searchParams.get('token');

        if (!token) {
            return NextResponse.redirect(new URL('/?error=token_mancante', baseUrl));
        }

        // Fetch subscriber to check if they exist
        const { data: subscriber, error: fetchErr } = await supabase
            .from('subscribers')
            .select('id, email, status')
            .eq('token', token)
            .maybeSingle();

        if (fetchErr || !subscriber) {
            console.error("Verification error - subscriber not found for token:", token, fetchErr);
            return NextResponse.redirect(new URL('/?error=token_non_valido', baseUrl));
        }

        // Update status to active
        const { error: updateErr } = await supabase
            .from('subscribers')
            .update({ status: 'active' })
            .eq('token', token);

        if (updateErr) {
            console.error("Verification error - failed to update status:", updateErr);
            return NextResponse.redirect(new URL('/?error=db_error', baseUrl));
        }

        console.log(`Email verificata con successo per ${subscriber.email}`);

        // Redirect to preferences page with verify success flag
        return NextResponse.redirect(new URL(`/preferenze?token=${token}&verify=success`, baseUrl));

    } catch (err) {
        console.error("Verification unexpected error:", err);
        
        // Costruiamo un URL di fallback in caso di errore inaspettato
        const fallbackUrl = new URL(request.url);
        const host = request.headers.get('x-forwarded-host');
        if (host) {
            fallbackUrl.host = host;
            fallbackUrl.protocol = 'https:';
            fallbackUrl.port = '';
        }
        return NextResponse.redirect(new URL('/?error=unknown', fallbackUrl.origin));
    }
}

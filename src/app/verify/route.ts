import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const token = url.searchParams.get('token');

        if (!token) {
            return NextResponse.redirect(new URL('/?error=token_mancante', request.url));
        }

        // Fetch subscriber to check if they exist
        const { data: subscriber, error: fetchErr } = await supabase
            .from('subscribers')
            .select('id, email, status')
            .eq('token', token)
            .maybeSingle();

        if (fetchErr || !subscriber) {
            console.error("Verification error - subscriber not found for token:", token, fetchErr);
            return NextResponse.redirect(new URL('/?error=token_non_valido', request.url));
        }

        // Update status to active
        const { error: updateErr } = await supabase
            .from('subscribers')
            .update({ status: 'active' })
            .eq('token', token);

        if (updateErr) {
            console.error("Verification error - failed to update status:", updateErr);
            return NextResponse.redirect(new URL('/?error=db_error', request.url));
        }

        console.log(`Email verificata con successo per ${subscriber.email}`);

        // Redirect to preferences page with verify success flag
        return NextResponse.redirect(new URL(`/preferenze?token=${token}&verify=success`, request.url));

    } catch (err) {
        console.error("Verification unexpected error:", err);
        return NextResponse.redirect(new URL('/?error=unknown', request.url));
    }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function GET(request: Request) {
    // Add simple authentication to prevent unauthorized trigger
    const authHeader = request.headers.get('authorization');
    const secret = process.env.CRON_SECRET || 'test-secret';
    
    // Allow local testing without auth if developing
    const isDev = process.env.NODE_ENV === 'development';
    
    if (!isDev && authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log("Inizio job send-notifications...");

        // 1. Fetch active subscribers
        const { data: subscribers, error: subErr } = await supabase
            .from('subscribers')
            .select('id, email')
            .eq('status', 'active');

        if (subErr || !subscribers || subscribers.length === 0) {
            console.log("Nessun sottoscrittore attivo trovato.");
            return NextResponse.json({ success: true, sent: 0, message: "No active subscribers" });
        }

        let totalSent = 0;
        const reports = [];

        // 2. Loop through each subscriber
        for (const sub of subscribers) {
            // Find notices not sent to this subscriber yet
            // Using a raw query to find missing notices, or a simpler logic:
            // Fetch ALL notices sent to this user
            const { data: sentNotices } = await supabase
                .from('sent_notifications')
                .select('notice_id')
                .eq('subscriber_id', sub.id);
            
            const sentIds = sentNotices?.map(sn => sn.notice_id) || [];

            // Query unsent notices from the last 7 days (to avoid sending very old ones)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            let query = supabase
                .from('notices')
                .select('*')
                .gte('created_at', sevenDaysAgo.toISOString())
                .order('affissione_start', { ascending: false })
                .order('created_at', { ascending: true });

            const { data: recentNotices, error: noticeErr } = await query;
            
            if (noticeErr) continue;

            const unsentNotices = recentNotices.filter(n => !sentIds.includes(n.id));

            if (unsentNotices.length === 0) {
                reports.push({ email: sub.email, sent: 0 });
                continue;
            }

            console.log(`Trovati ${unsentNotices.length} nuovi avvisi per ${sub.email}`);

            // 3. Prepare email content
            let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; color: #111827; }
                    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
                    .header { background-color: #ffffff; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; border-bottom: 3px solid #ff5c22; }
                    .header h1 { color: #111827; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
                    .header p { color: #6b7280; margin: 8px 0 0 0; font-size: 15px; }
                    .content-wrapper { background-color: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
                    .greeting { font-size: 16px; margin-bottom: 25px; line-height: 1.5; color: #374151; }
                    .notice-card { background-color: #fcfcfc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 25px; margin-bottom: 25px; }
                    .badge-container { margin-bottom: 12px; }
                    .badge { background-color: #f3f4f6; color: #4b5563; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-block; letter-spacing: 0.3px; text-transform: uppercase; }
                    .notice-title { font-size: 18px; margin: 0 0 10px 0; color: #111827; font-weight: 700; line-height: 1.3; }
                    .notice-abstract { font-size: 15px; color: #4b5563; line-height: 1.5; margin: 0 0 15px 0; font-style: italic; }
                    .notice-details { font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 20px 0; background-color: #ffffff; padding: 15px; border-radius: 8px; border-left: 3px solid #ff5c22; }
                    .notice-bullets { margin: 0; padding-left: 20px; }
                    .notice-bullets li { margin-bottom: 8px; }
                    .btn { display: inline-block; background-color: #ff5c22; color: #ffffff !important; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block; text-align: center; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
                    .footer p { font-size: 12px; color: #9ca3af; line-height: 1.5; margin: 0; }
                    .footer a { color: #ff5c22; text-decoration: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>AlboMonitor</h1>
                        <p>Aggiornamenti dal Comune di Bedollo</p>
                    </div>
                    <div class="content-wrapper">
                        <div class="greeting">
                            Ciao,<br><br>Ci sono <strong>${unsentNotices.length}</strong> nuovi atti in pubblicazione all'Albo Pretorio che potrebbero interessarti:
                        </div>
            `;

            for (const notice of unsentNotices) {
                const badgeText = [notice.category || 'Atto', notice.atto_number].filter(Boolean).join(' • ');
                const titleToUse = notice.ai_title || notice.summary_short || notice.title;
                
                // Format summary_long to convert text bullets (- item) into HTML lists
                let formattedLong = notice.summary_long;
                if (formattedLong && formattedLong.includes('\n-')) {
                    formattedLong = formattedLong.replace(/\n- (.*?)(?=(\n- |$))/g, '<li>$1</li>');
                    formattedLong = `<ul class="notice-bullets">${formattedLong.replace(/[\s\S]*?(?=<li>)/, (m: string) => m ? m + '<br>' : '')}</ul>`;
                } else if (formattedLong) {
                    formattedLong = formattedLong.replace(/\n/g, '<br/>');
                } else {
                    formattedLong = notice.title; // fallback
                }

                const pdfButton = notice.pdf_url 
                    ? `<a href="${notice.pdf_url}" class="btn">📄 Scarica PDF Originale</a>`
                    : `<span style="font-size: 13px; color: #9ca3af; font-style: italic;">Nessun PDF scaricabile trovato</span>`;

                htmlContent += `
                        <div class="notice-card">
                            <div class="badge-container">
                                <span class="badge">${badgeText}</span>
                            </div>
                            <h2 class="notice-title">${titleToUse}</h2>
                            <p class="notice-abstract">${notice.summary_short}</p>
                            <div class="notice-details">
                                ${formattedLong}
                            </div>
                            <div style="margin-top: 15px;">
                                ${pdfButton}
                            </div>
                        </div>
                `;
            }

            htmlContent += `
                        <div class="footer">
                            <p>
                                Ricevi questa email perché sei iscritto ad AlboMonitor.<br>
                                Questo è un servizio automatico non affiliato legalmente al Comune.<br>
                                Tutti i documenti originali sono consultabili sull'<a href="https://albobedollo.gisco-tn.it/">Albo Pretorio Ufficiale</a>.
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            `;

            // 4. Send email via Resend
            try {
                const { data: emailRes, error: emailErr } = await resend.emails.send({
                    from: 'AlboMonitor <onboarding@resend.dev>', // Usare il dominio verificato in produzione
                    to: [sub.email],
                    subject: `📍 ${unsentNotices.length} nuovi aggiornamenti dall'Albo Pretorio`,
                    html: htmlContent,
                });

                if (emailErr) {
                    console.error(`Errore invio email a ${sub.email}:`, emailErr);
                    reports.push({ email: sub.email, sent: 0, error: emailErr.message });
                    continue;
                }

                console.log(`Email inviata con successo a ${sub.email} (${emailRes?.id})`);
                
                // 5. If sent successfully, insert tracking records
                const trackingRecords = unsentNotices.map(n => ({
                    subscriber_id: sub.id,
                    notice_id: n.id
                }));

                const { error: insertErr } = await supabase
                    .from('sent_notifications')
                    .insert(trackingRecords);

                if (insertErr) {
                    console.error(`Errore inserimento tracking per ${sub.email}:`, insertErr);
                } else {
                    totalSent += unsentNotices.length;
                    reports.push({ email: sub.email, sent: unsentNotices.length });
                }

            } catch (sendErr) {
                console.error(`Catch error invio a ${sub.email}:`, sendErr);
                reports.push({ email: sub.email, sent: 0, error: String(sendErr) });
            }
        }

        console.log(`Job completato. Totale avvisi inviati: ${totalSent}`);
        return NextResponse.json({ success: true, totalSent, reports });

    } catch (err: any) {
        console.error("Errore generico in send-notifications:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return 'http://localhost:3000';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderNoticeCard(notice: any): string {
    const isLocal = notice.relevance !== 'esterno';
    const badgeCls = isLocal ? 'badge badge-local' : 'badge badge-ext';
    const relevanceLabel = isLocal ? 'Bedollo' : 'Altro ente';
    const categoryBadge = escapeHtml([notice.category || 'Atto', notice.atto_number].filter(Boolean).join(' · '));

    // Formatta la data di affissione (es. "4 mar 2026")
    let dateLabel = '';
    if (notice.affissione_start) {
        const d = new Date(notice.affissione_start);
        dateLabel = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    const titleToUse = escapeHtml(notice.ai_title || notice.title);
    const summaryShort = escapeHtml(notice.summary_short || '');

    let formattedLong = notice.summary_long;
    if (formattedLong && formattedLong.includes('\n-')) {
        const escaped = escapeHtml(formattedLong);
        const parts = escaped.split('\n');
        const intro: string[] = [];
        const bullets: string[] = [];
        for (const line of parts) {
            if (line.startsWith('- ')) {
                bullets.push(`<li>${line.substring(2)}</li>`);
            } else if (line.trim()) {
                if (bullets.length === 0) intro.push(line);
            }
        }
        formattedLong = (intro.length ? intro.join('<br/>') + '<br/>' : '') + `<ul>${bullets.join('')}</ul>`;
    } else if (formattedLong) {
        formattedLong = escapeHtml(formattedLong).replace(/\n/g, '<br/>');
    } else {
        formattedLong = '';
    }

    // Build PDF buttons — support multiple PDFs via pdf_urls array
    let pdfButtons = '';
    const pdfUrls = (notice.pdf_urls as { url: string; label: string }[]) || [];
    
    if (pdfUrls.length > 0) {
        pdfButtons = pdfUrls.map((pdf, i) => {
            const cleanLabel = escapeHtml(pdf.label || `Documento PDF ${i + 1}`);
            return `<a href="${escapeHtml(pdf.url)}" class="btn" style="margin-right:8px;margin-bottom:6px;">${cleanLabel}</a>`;
        }).join('\n            ');
    } else if (notice.pdf_url) {
        // Fallback to legacy single pdf_url
        pdfButtons = `<a href="${escapeHtml(notice.pdf_url)}" class="btn" style="margin-right:8px;margin-bottom:6px;">Documento originale (PDF)</a>`;
    } else {
        pdfButtons = `<span class="no-pdf">PDF non disponibile</span>`;
    }

    // Link to the original Albo Pretorio page
    const alboLink = notice.link
        ? `<a href="${escapeHtml(notice.link)}" class="btn-albo">Vedi sull'Albo Pretorio</a>`
        : '';

    return `
        <div class="card">
            <div class="card-top">
                <span class="${badgeCls}">${relevanceLabel}</span>
                <span class="badge">${categoryBadge}</span>
                ${dateLabel ? `<span class="card-date">${escapeHtml(dateLabel)}</span>` : ''}
            </div>
            <h2 class="card-title">${titleToUse}</h2>
            <p class="card-abstract">${summaryShort}</p>
            ${formattedLong ? `<div class="card-details">${formattedLong}</div>` : ''}
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">${pdfButtons}</div>
            ${alboLink ? `<div style="margin-top:10px;">${alboLink}</div>` : ''}
        </div>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEmailHtml(notices: any[], prefsUrl: string): string {
    const today = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    const localNotices = notices.filter(n => n.relevance !== 'esterno');
    const externalNotices = notices.filter(n => n.relevance === 'esterno');

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #fafaf8; margin: 0; padding: 0; color: #1a1a18; }
            .wrapper { max-width: 620px; margin: 0 auto; padding: 30px 16px; }
            .header { background-color: #1B4D3E; padding: 28px 30px; border-radius: 12px 12px 0 0; }
            .header-icon { width: 36px; height: 36px; background-color: #C7552B; border-radius: 8px; display: inline-block; text-align: center; line-height: 36px; color: #fff; font-weight: 800; font-size: 18px; margin-right: 12px; vertical-align: middle; }
            .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; display: inline; vertical-align: middle; font-family: 'Source Serif 4', Georgia, serif; }
            .header-date { color: #e8f0ed; font-size: 13px; margin-top: 10px; opacity: 0.85; }
            .toolbar { background-color: #ffffff; padding: 14px 30px; border-bottom: 1px solid #e2e0db; display: flex; justify-content: center; gap: 10px; }
            .toolbar-btn { font-size: 12px; font-weight: 600; text-decoration: none; padding: 6px 16px; border-radius: 6px; display: inline-block; }
            .toolbar-btn-primary { background-color: #fdf0eb; color: #C7552B; }
            .toolbar-btn-secondary { background-color: #fafaf8; color: #8a8983; border: 1px solid #e2e0db; }
            .body-wrap { background-color: #ffffff; padding: 28px 30px; border: 1px solid #e2e0db; border-top: none; border-bottom: none; }
            .greeting { font-size: 15px; margin-bottom: 24px; line-height: 1.6; color: #5c5b56; border-bottom: 1px solid #e2e0db; padding-bottom: 20px; }
            .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #C7552B; margin: 24px 0 14px 0; padding-bottom: 8px; border-bottom: 2px solid #fdf0eb; }
            .section-label-ext { color: #8a8983; border-bottom-color: #fafaf8; }
            .card { border: 1px solid #e2e0db; border-radius: 10px; padding: 20px; margin-bottom: 16px; background-color: #fafaf8; }
            .card-top { margin-bottom: 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
            .card-date { font-size: 11px; color: #8a8983; margin-left: auto; }
            .badge { background-color: #fafaf8; color: #5c5b56; border: 1px solid #e2e0db; padding: 3px 9px; border-radius: 5px; font-size: 11px; font-weight: 600; display: inline-block; letter-spacing: 0.3px; text-transform: uppercase; }
            .badge-local { background-color: #e8f0ed; color: #1B4D3E; border-color: #e8f0ed; }
            .badge-ext { background-color: #fafaf8; color: #8a8983; }
            .card-title { font-family: 'Source Serif 4', Georgia, serif; font-size: 17px; margin: 0 0 6px 0; color: #1a1a18; font-weight: 700; line-height: 1.35; }
            .card-abstract { font-size: 14px; color: #5c5b56; line-height: 1.55; margin: 0 0 14px 0; }
            .card-details { font-size: 13px; color: #1a1a18; line-height: 1.65; margin: 0 0 16px 0; background-color: #ffffff; padding: 14px; border-radius: 8px; border-left: 3px solid #1B4D3E; border-top: 1px solid #e2e0db; border-right: 1px solid #e2e0db; border-bottom: 1px solid #e2e0db; }
            .card-details ul { margin: 4px 0 0 0; padding-left: 18px; }
            .card-details li { margin-bottom: 5px; }
            .btn { display: inline-block; background-color: #1B4D3E; color: #ffffff !important; text-decoration: none; padding: 9px 18px; border-radius: 7px; font-size: 13px; font-weight: 600; text-align: center; transition: background-color 0.15s ease; }
            .btn:hover { background-color: #153D31; }
            .no-pdf { font-size: 12px; color: #8a8983; font-style: italic; }
            .btn-albo { display: inline-block; color: #1B4D3E !important; text-decoration: none; padding: 8px 16px; border-radius: 7px; font-size: 12px; font-weight: 600; text-align: center; border: 1.5px solid #1B4D3E; background-color: transparent; }
            .btn-albo:hover { background-color: #e8f0ed; }
            .footer-wrap { background-color: #ffffff; padding: 20px 30px 28px; border-radius: 0 0 12px 12px; border: 1px solid #e2e0db; border-top: 1px solid #e2e0db; }
            .footer { text-align: center; }
            .footer p { font-size: 11px; color: #8a8983; line-height: 1.6; margin: 0; }
            .footer a { color: #C7552B; text-decoration: none; }
            .stats-bar { display: flex; justify-content: center; gap: 0; margin-bottom: 24px; }
            .stat { text-align: center; padding: 16px 28px; }
            .stat-local { background-color: #e8f0ed; border-radius: 10px 0 0 10px; border: 1px solid #1B4D3E; }
            .stat-ext { background-color: #fafaf8; border-radius: 0 10px 10px 0; border: 1px solid #e2e0db; border-left: none; }
            .stat-num { font-size: 26px; font-weight: 800; display: block; font-family: 'Source Serif 4', Georgia, serif; }
            .stat-num-local { color: #1B4D3E; }
            .stat-num-ext { color: #8a8983; }
            .stat-label { font-size: 11px; color: #5c5b56; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="header">
                <div>
                    <span class="header-icon">A</span>
                    <h1>AlboMonitor Bedollo</h1>
                </div>
                <div class="header-date">${today}</div>
            </div>
            <div class="toolbar">
                <a href="${prefsUrl}" class="toolbar-btn toolbar-btn-primary">Modifica preferenze</a>
                <a href="${prefsUrl}" class="toolbar-btn toolbar-btn-secondary">Cancella iscrizione</a>
            </div>
            <div class="body-wrap">
                <div class="greeting">
                    Ciao, ci sono <strong>${notices.length} nuovi atti</strong> pubblicati all'Albo Pretorio del Comune di Bedollo.
                </div>
                <div class="stats-bar">
                    <div class="stat stat-local"><span class="stat-num stat-num-local">${localNotices.length}</span><span class="stat-label">Comune di Bedollo</span></div>
                    <div class="stat stat-ext"><span class="stat-num stat-num-ext">${externalNotices.length}</span><span class="stat-label">Altri enti</span></div>
                </div>
    `;

    if (localNotices.length > 0) {
        html += `<div class="section-label">Riguarda Bedollo</div>`;
        for (const notice of localNotices) {
            html += renderNoticeCard(notice);
        }
    }

    if (externalNotices.length > 0) {
        html += `<div class="section-label section-label-ext">Pubblicazioni di altri enti</div>`;
        for (const notice of externalNotices) {
            html += renderNoticeCard(notice);
        }
    }

    html += `
                </div>
                <div class="footer-wrap">
                    <div class="footer">
                        <p>
                            Ricevi questa email perché sei iscritto ad <strong>AlboMonitor Bedollo</strong>.<br>
                            Servizio automatico non affiliato al Comune di Bedollo.<br>
                            Documenti originali: <a href="https://albobedollo.gisco-tn.it/">Albo Pretorio Ufficiale</a><br>
                            <a href="${prefsUrl}">Gestisci preferenze</a> · <a href="${prefsUrl}">Cancella iscrizione</a>
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    return html;
}

interface Subscriber {
    id: string;
    email: string;
    token: string;
    preferences: { categories?: string[]; relevance?: string; send_recent?: boolean; recent_count?: number } | null;
}

export interface SendResult {
    email: string;
    sent: number;
    error?: string;
}

/**
 * Sends pending notifications to a single subscriber.
 * Returns the send result.
 */
export async function sendNotificationsToSubscriber(sub: Subscriber): Promise<SendResult> {
    const prefs = sub.preferences || {};
    const prefCategories: string[] = prefs.categories || ['*'];
    const prefRelevance: string = prefs.relevance || 'all';
    const wantsRecent: boolean = prefs.send_recent || false;
    const recentCount: number = Math.min(Math.max(prefs.recent_count || 5, 1), 10);

    // Fetch sent notices for this subscriber
    const { data: sentNotices } = await supabase
        .from('sent_notifications')
        .select('notice_id')
        .eq('subscriber_id', sub.id);

    const sentIds = sentNotices?.map(sn => sn.notice_id) || [];
    const isFirstSend = sentIds.length === 0;

    // Query notices: if first send and user wants recent, fetch more; otherwise last 7 days
    let noticeQuery = supabase
        .from('notices')
        .select('*');

    // Apply preference filters directly in DB query to ensure the limit matches user preferences
    if (prefRelevance === 'locale') {
        noticeQuery = noticeQuery.neq('relevance', 'esterno');
    }
    if (!prefCategories.includes('*')) {
        noticeQuery = noticeQuery.in('category', prefCategories);
    }

    noticeQuery = noticeQuery
        .order('affissione_start', { ascending: false })
        .order('created_at', { ascending: true });

    if (isFirstSend && wantsRecent) {
        noticeQuery = noticeQuery.limit(recentCount);
    } else {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        noticeQuery = noticeQuery.gte('created_at', sevenDaysAgo.toISOString());
    }

    const { data: recentNotices, error: noticeErr } = await noticeQuery;

    if (noticeErr || !recentNotices) {
        return { email: sub.email, sent: 0, error: noticeErr?.message };
    }

    // Filter by preferences
    let unsentNotices = recentNotices.filter(n => !sentIds.includes(n.id));

    if (prefRelevance === 'locale') {
        unsentNotices = unsentNotices.filter(n => n.relevance !== 'esterno');
    }

    if (!prefCategories.includes('*')) {
        unsentNotices = unsentNotices.filter(n => prefCategories.includes(n.category));
    }

    if (unsentNotices.length === 0) {
        return { email: sub.email, sent: 0 };
    }

    console.log(`Trovati ${unsentNotices.length} nuovi avvisi per ${sub.email}`);

    const baseUrl = getBaseUrl();
    const prefsUrl = `${baseUrl}/preferenze?token=${sub.token}`;
    const htmlContent = buildEmailHtml(unsentNotices, prefsUrl);

    try {
        await transporter.sendMail({
            from: `AlboMonitor Bedollo <${process.env.GMAIL_USER}>`,
            to: sub.email,
            subject: `${unsentNotices.length} nuovi aggiornamenti dall'Albo Pretorio di Bedollo`,
            html: htmlContent,
        });

        console.log(`Email inviata con successo a ${sub.email}`);

        // Track only the notices actually sent
        const trackingRecords = unsentNotices.map(n => ({
            subscriber_id: sub.id,
            notice_id: n.id
        }));

        const { error: insertErr } = await supabase
            .from('sent_notifications')
            .insert(trackingRecords);

        if (insertErr) {
            console.error(`Errore inserimento tracking per ${sub.email}:`, insertErr);
        }

        return { email: sub.email, sent: unsentNotices.length };

    } catch (sendErr) {
        console.error(`Errore invio a ${sub.email}:`, sendErr);
        return { email: sub.email, sent: 0, error: String(sendErr) };
    }
}

/**
 * Fetches all active subscribers and sends notifications.
 * Optionally filters by a single subscriber ID.
 */
export async function sendNotifications(subscriberId?: string): Promise<{ totalSent: number; reports: SendResult[] }> {
    let query = supabase
        .from('subscribers')
        .select('id, email, token, preferences')
        .eq('status', 'active');

    if (subscriberId) {
        query = query.eq('id', subscriberId);
    }

    const { data: subscribers, error: subErr } = await query;

    if (subErr || !subscribers || subscribers.length === 0) {
        console.log("Nessun sottoscrittore attivo trovato.");
        return { totalSent: 0, reports: [] };
    }

    let totalSent = 0;
    const reports: SendResult[] = [];

    for (const sub of subscribers) {
        const result = await sendNotificationsToSubscriber(sub as Subscriber);
        totalSent += result.sent;
        reports.push(result);
    }

    console.log(`Job completato. Totale avvisi inviati: ${totalSent}`);
    return { totalSent, reports };
}

/**
 * Sends a verification or access email to a subscriber.
 * @param email - The email to send to
 * @param token - Unique verification token
 * @param isNew - True if registering for the first time, false if existing subscriber requesting access
 */
export async function sendVerificationEmail(email: string, token: string, isNew: boolean): Promise<boolean> {
    const baseUrl = getBaseUrl();
    const actionUrl = isNew 
        ? `${baseUrl}/verify?token=${token}` 
        : `${baseUrl}/preferenze?token=${token}`;
    
    const subject = isNew 
        ? "Verifica la tua email - AlboMonitor Bedollo" 
        : "Accedi alle tue preferenze - AlboMonitor Bedollo";

    const title = isNew 
        ? "Verifica il tuo indirizzo email" 
        : "Gestisci la tua iscrizione";

    const bodyText = isNew 
        ? "Grazie per esserti registrato ad AlboMonitor Bedollo. Clicca sul pulsante qui sotto per confermare la tua email e configurare le tue preferenze di ricezione degli avvisi comunali."
        : "Hai richiesto l'accesso ad AlboMonitor Bedollo per modificare le tue preferenze o cancellarti. Clicca sul pulsante qui sotto per accedere direttamente alla pagina di gestione.";

    const btnText = isNew 
        ? "Conferma email" 
        : "Gestisci preferenze";

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #fafaf8; margin: 0; padding: 0; color: #1a1a18; }
            .wrapper { max-width: 620px; margin: 0 auto; padding: 30px 16px; }
            .header { background-color: #1B4D3E; padding: 28px 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .header-icon { width: 36px; height: 36px; background-color: #C7552B; border-radius: 8px; display: inline-block; text-align: center; line-height: 36px; color: #fff; font-weight: 800; font-size: 18px; margin-right: 12px; vertical-align: middle; }
            .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; display: inline; vertical-align: middle; font-family: 'Source Serif 4', Georgia, serif; }
            .body-wrap { background-color: #ffffff; padding: 36px 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e0db; border-top: none; }
            .title { font-family: 'Source Serif 4', Georgia, serif; font-size: 20px; font-weight: 700; color: #1a1a18; margin-top: 0; margin-bottom: 16px; }
            .text { font-size: 15px; color: #5c5b56; line-height: 1.6; margin-bottom: 24px; }
            .btn-wrap { text-align: center; margin: 28px 0; }
            .btn { display: inline-block; background-color: #1B4D3E; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; text-align: center; transition: background-color 0.15s ease; }
            .btn:hover { background-color: #153D31; }
            .footer { text-align: center; margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e0db; }
            .footer p { font-size: 11px; color: #8a8983; line-height: 1.6; margin: 0; }
            .footer a { color: #C7552B; text-decoration: none; }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="header">
                <div>
                    <span class="header-icon">A</span>
                    <h1>AlboMonitor Bedollo</h1>
                </div>
            </div>
            <div class="body-wrap">
                <h2 class="title">${title}</h2>
                <p class="text">${bodyText}</p>
                <div class="btn-wrap">
                    <a href="${actionUrl}" class="btn">${btnText}</a>
                </div>
                <p class="text" style="font-size: 13px; color: #8a8983;">
                    Se il pulsante non funziona, copia e incolla questo indirizzo nel tuo browser:<br>
                    <a href="${actionUrl}" style="color: #C7552B; word-break: break-all;">${actionUrl}</a>
                </p>
                <div class="footer">
                    <p>
                        Ricevi questa email in risposta ad una richiesta di iscrizione o accesso ad <strong>AlboMonitor Bedollo</strong>.<br>
                        Se non sei stato tu, puoi tranquillamente ignorare questo messaggio.<br>
                        <a href="${baseUrl}">Home Page</a>
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        await transporter.sendMail({
            from: `AlboMonitor Bedollo <${process.env.GMAIL_USER}>`,
            to: email,
            subject: subject,
            html: htmlContent,
        });
        console.log(`Email di verifica/accesso inviata con successo a ${email}`);
        return true;
    } catch (err) {
        console.error(`Errore invio email di verifica a ${email}:`, err);
        return false;
    }
}

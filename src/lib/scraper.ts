import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { sendNotifications } from './notifications';

const ALBO_BASE_URL = 'https://albobedollo.gisco-tn.it';
const ALBO_URL = `${ALBO_BASE_URL}/Albo-Pretorio/Pubblicazioni`;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const FETCH_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
};

interface PdfAttachment {
    url: string;
    label: string;
}

interface NoticeCard {
    title: string;
    link: string;
    category: string;
    atto_number: string;
    affissione_start: string | null;
    affissione_end: string | null;
}

/**
 * Parses the affissione date string like "In affissione dal 04/03/2026  al 03/04/2026"
 */
function parseAffissioneDates(text: string): { start: string | null; end: string | null } {
    const match = text.match(/dal\s+(\d{2}\/\d{2}\/\d{4})\s+al\s+(\d{2}\/\d{2}\/\d{4})/);
    if (!match) return { start: null, end: null };

    // Convert DD/MM/YYYY to YYYY-MM-DD
    const toISO = (d: string) => {
        const [day, month, year] = d.split('/');
        return `${year}-${month}-${day}`;
    };

    return { start: toISO(match[1]), end: toISO(match[2]) };
}

/**
 * Extracts all notice cards from a single page's HTML
 */
function extractCardsFromHTML($: cheerio.CheerioAPI): NoticeCard[] {
    const cards: NoticeCard[] = [];

    $('.card-wrapper.cmp-list-card-img').each((_, wrapper) => {
        const $card = $(wrapper);

        // Extract link (first documento-albo link)
        const linkEl = $card.find('a[href*="/documento-albo/"]').first();
        let link = linkEl.attr('href') || '';
        if (!link) return;
        if (!link.startsWith('http')) link = new URL(link, ALBO_BASE_URL).toString();

        // Extract title from .card-text
        const title = $card.find('.card-text').first().text().trim();
        if (!title || title.length < 5) return;

        // Extract category from .categoryicon-top
        const category = $card.find('.categoryicon-top .text a').first().text().trim() || 'Altro';

        // Extract atto number from .chip-label
        const atto_number = $card.find('.chip-label').first().text().trim() || '';

        // Extract affissione dates
        const dateText = $card.find('.data').first().text().trim();
        const dates = parseAffissioneDates(dateText);

        cards.push({
            title,
            link,
            category,
            atto_number,
            affissione_start: dates.start,
            affissione_end: dates.end,
        });
    });

    return cards;
}

/**
 * Fetches and extracts text content from a detail page,
 * returning the text and ALL PDF attachments found on the page.
 */
export async function extractDetailContent(detailUrl: string): Promise<{ text: string; pdfAttachments: PdfAttachment[] }> {
    try {
        const res = await fetch(detailUrl, { headers: FETCH_HEADERS });
        if (!res.ok) return { text: "", pdfAttachments: [] };
        const html = await res.text();
        const $ = cheerio.load(html);

        // Find ALL PDF links on the page (case-insensitive: .pdf, .PDF, .Pdf, etc.)
        const pdfAttachments: PdfAttachment[] = [];
        $('a').each((_, el) => {
            const href = $(el).attr('href') || '';
            if (/\.pdf$/i.test(href)) {
                const fullUrl = href.startsWith('http') ? href : new URL(href, ALBO_BASE_URL).toString();
                // Extract a label from the link text or parent context
                const rawLabel = $(el).text().trim()
                    || $(el).attr('aria-label')
                    || $(el).attr('title')
                    || 'Documento PDF';
                const label = rawLabel.replace(/\s+/g, ' ').substring(0, 100);
                // Avoid duplicates
                if (!pdfAttachments.some(p => p.url === fullUrl)) {
                    pdfAttachments.push({ url: fullUrl, label });
                }
            }
        });

        console.log(`     📎 Trovati ${pdfAttachments.length} allegati PDF`);

        // 1. Extract text from the detail page itself
        const pageText = $('main').text().trim() || $('body').text().trim();
        let combinedText = `=== CONTENUTO PAGINA WEB DETTAGLIO ===\n${pageText.substring(0, 4000)}\n\n`;

        // 2. Extract text from all PDFs and append them to combinedText
        if (pdfAttachments.length > 0) {
            combinedText += `=== CONTENUTO DOCUMENTI PDF ALLEGATI (${pdfAttachments.length}) ===\n`;
            for (const pdf of pdfAttachments) {
                try {
                    console.log(`        📄 Estrazione testo da PDF: ${pdf.label}`);
                    const pdfRes = await fetch(pdf.url, { headers: FETCH_HEADERS });
                    if (pdfRes.ok) {
                        const buffer = new Uint8Array(await pdfRes.arrayBuffer());
                        const parser = new PDFParse({ data: buffer });
                        const data = await parser.getText();
                        const pdfText = data.text?.trim() || '';
                        await parser.destroy();
                        if (pdfText.length > 10) {
                            combinedText += `\n--- INIZIO DOCUMENTO: ${pdf.label} ---\n${pdfText.substring(0, 15000)}\n--- FINE DOCUMENTO: ${pdf.label} ---\n`;
                        }
                    }
                } catch (pdfErr) {
                    console.log(`     ⚠️ Errore parsing PDF ${pdf.label}: ${(pdfErr as Error).message}`);
                }
            }
        }

        return { text: combinedText, pdfAttachments };
    } catch (err) {
        console.log(`  ⚠️ Errore pagina dettaglio: ${(err as Error).message}`);
        return { text: "", pdfAttachments: [] };
    }
}

/**
 * Generates an AI summary using Gemini
 */
async function generateAISummary(title: string, content: string, retryCount = 0): Promise<{ ai_title: string; summary_short: string; summary_long: string; relevance: string }> {
    const fallback = {
        ai_title: title.substring(0, 100),
        summary_short: title.substring(0, 150),
        summary_long: "Riassunto non disponibile.",
        relevance: "locale",
    };

    if (!process.env.GEMINI_API_KEY) return fallback;

    try {
        const textToAnalyze = content && content.length > 50 ? content : title;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Sei un assistente editoriale per i cittadini del Comune di Bedollo (Trentino). Analizzi atti dell'Albo Pretorio e produci riassunti chiari, utili e senza ridondanze.

REGOLE FONDAMENTALI:
- I 3 campi testuali (ai_title, summary_short, summary_long) devono essere COMPLEMENTARI, non ripetitivi. Ogni campo aggiunge informazioni nuove rispetto al precedente.
- ai_title cattura l'essenza in una frase. summary_short aggiunge il contesto immediato (chi, quando, perché) SENZA ripetere il titolo. summary_long dettaglia tutto il resto (date, luoghi, importi, procedure, contatti) SENZA ripetere titolo e abstract.
- Scrivi in italiano corrente, cordiale e diretto. Zero burocratese.
- summary_long deve essere conciso ma completo: massimo 6-8 righe di testo o 5-6 bullet points. Vai dritto alle informazioni utili.
- Se il testo fornito è scarno (solo titolo e metadati), fai del tuo meglio con le informazioni disponibili. Non inventare dettagli, ma interpreta il tipo di atto dalla categoria e dal titolo per fornire un riassunto utile.

CAMPO SPECIALE - "relevance":
Determina se l'atto riguarda direttamente il territorio/comunità di Bedollo oppure se è una pubblicazione che il Comune è obbligato a pubblicare ma proviene da altri enti o territori.
- "locale" = riguarda Bedollo, i suoi abitanti, le sue strade, i suoi servizi
- "esterno" = proviene da altri comuni, provincia, enti terzi; pubblicato per obbligo ma non riguarda direttamente Bedollo

Restituisci SOLO un oggetto JSON valido (no markdown, no backtick) con questi 4 campi:
1) "ai_title": string - Titolo semplificato, chiaro, non troncato
2) "summary_short": string - 1-2 frasi che aggiungono contesto al titolo (non ripeterlo)
3) "summary_long": string - Dettagli utili rimanenti, organizzati a punti se serve (usa \\n e - nella stringa). Breve ed efficace.
4) "relevance": "locale" | "esterno"

Testo da analizzare:
${textToAnalyze.substring(0, 10000)}`,
        });

        const responseText = response.text || '';
        // Clean potential markdown wrapping
        const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                ai_title: parsed.ai_title || fallback.ai_title,
                summary_short: parsed.summary_short || fallback.summary_short,
                summary_long: parsed.summary_long || fallback.summary_long,
                relevance: parsed.relevance === 'esterno' ? 'esterno' : 'locale',
            };
        }
    } catch (err) {
        const message = (err as Error).message;
        console.error(`  ❌ Errore AI: ${message}`);
        // Handle 429 Too Many Requests
        if (message.includes('429') && retryCount < 2) {
            console.log(`     ⏳ Rate limit superato, ritento tra 10 secondi...`);
            await new Promise(r => setTimeout(r, 10000));
            return generateAISummary(title, content, retryCount + 1);
        }
    }

    return fallback;
}

/**
 * Main scraping function — fetches only the most recent notices, generates AI summaries, and stores in DB.
 * @param maxNotices - Maximum number of new notices to process per run (default: 6)
 */
export async function scrapeLatestNotices(maxNotices: number = 6) {
    if (!process.env.GEMINI_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("⛔ Scraping saltato: variabili d'ambiente mancanti.");
        return [];
    }

    console.log(`🔍 Inizio scraping Albo Pretorio di Bedollo (max ${maxNotices} nuovi avvisi)...\n`);
    const allResults = [];
    let processed = 0;

    const MAX_PAGES = 10; // Limite massimo di pagine per evitare loop infiniti

    // Paginate only as far as needed to find maxNotices new entries
    for (let page = 1; processed < maxNotices && page <= MAX_PAGES; page++) {
        const url = page === 1 ? ALBO_URL : `${ALBO_URL}?pagina=${page}`;
        console.log(`📄 Pagina ${page}: ${url}`);

        try {
            const res = await fetch(url, { headers: FETCH_HEADERS });
            if (!res.ok) {
                console.log(`  ⚠️ Pagina ${page} ritorna status ${res.status}, fermo la paginazione.`);
                break;
            }
            const html = await res.text();
            const $ = cheerio.load(html);

            const cards = extractCardsFromHTML($);
            console.log(`  📋 Trovate ${cards.length} card nella pagina ${page}`);

            if (cards.length === 0) {
                console.log(`  ℹ️ Nessuna card trovata, fermo la paginazione.`);
                break;
            }

            for (const card of cards) {
                if (processed >= maxNotices) break;

                // Check if already exists in DB
                const { data: existing } = await supabase
                    .from('notices')
                    .select('id')
                    .eq('link', card.link)
                    .maybeSingle();

                if (existing) {
                    console.log(`  ⏭️ Già presente: ${card.atto_number}`);
                    continue;
                }

                console.log(`  🆕 Nuovo: [${card.category}] ${card.atto_number} - ${card.title.substring(0, 60)}...`);

                // Extract content from detail page and find all PDF attachments
                const detailData = await extractDetailContent(card.link);
                console.log(`     📖 Contenuto estratto: ${detailData.text.length} caratteri (PDF: ${detailData.pdfAttachments.length} allegati)`);

                // Enrich content with card metadata when text is insufficient
                let contentForAI = detailData.text;
                if (!contentForAI || contentForAI.length < 50) {
                    const metaParts = [
                        `Titolo: ${card.title}`,
                        card.category ? `Categoria: ${card.category}` : '',
                        card.atto_number ? `Numero atto: ${card.atto_number}` : '',
                        card.affissione_start ? `Periodo affissione: dal ${card.affissione_start} al ${card.affissione_end || 'N/D'}` : '',
                    ].filter(Boolean);
                    contentForAI = metaParts.join('\n');
                    console.log(`     ⚠️ Contenuto insufficiente, uso metadati della card per l'AI`);
                }

                // Generate AI summary
                const summary = await generateAISummary(card.title, contentForAI);
                console.log(`     🤖 AI Titolo: "${summary.ai_title}"`);

                // Insert into DB
                const firstPdfUrl = detailData.pdfAttachments.length > 0 ? detailData.pdfAttachments[0].url : null;
                const { data: inserted, error: insErr } = await supabase.from('notices').insert({
                    title: card.title,
                    link: card.link,
                    pdf_url: firstPdfUrl,
                    pdf_urls: detailData.pdfAttachments,
                    ai_title: summary.ai_title,
                    summary_short: summary.summary_short,
                    summary_long: summary.summary_long,
                    relevance: summary.relevance,
                    category: card.category,
                    atto_number: card.atto_number,
                    affissione_start: card.affissione_start,
                    affissione_end: card.affissione_end,
                    published_at: new Date().toISOString(),
                }).select().single();

                if (insErr) {
                    console.error(`     ❌ Errore inserimento:`, insErr.message);
                } else if (inserted) {
                    allResults.push(inserted);
                    processed++;
                    console.log(`     ✅ Salvato! (${processed}/${maxNotices})`);
                }

                // Delay to respect Gemini API rate limits
                if (processed < maxNotices) {
                    console.log(`     ⏳ Attesa 3 secondi per limite API Gemini...`);
                    await new Promise(r => setTimeout(r, 3000));
                }
            }
        } catch (error) {
            console.error(`  ❌ Errore pagina ${page}:`, (error as Error).message);
        }
    }

    console.log(`\n✅ Scraping completato: ${allResults.length} nuovi avvisi inseriti.`);

    if (allResults.length > 0) {
        console.log(`📣 Trovati ${allResults.length} nuovi avvisi! Innesco l'invio delle notifiche a tutti gli iscritti...`);
        try {
            const { totalSent } = await sendNotifications();
            console.log(`✉️ Notifiche inviate automaticamente a ${totalSent} utenti.`);
        } catch (notifErr) {
            console.error("❌ Errore durante l'invio automatico delle notifiche:", notifErr);
        }
    }

    return allResults;
}

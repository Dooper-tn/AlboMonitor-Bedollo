import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { sendNotifications } from './notifications';

const ALBO_BASE_URL = 'https://albobedollo.gisco-tn.it';
const ALBO_URL = `${ALBO_BASE_URL}/Albo-Pretorio/Pubblicazioni`;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const isVertexAI = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
const ai = isVertexAI
    ? new GoogleGenAI({
        vertexai: true,
        project: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_LOCATION || 'europe-west8'
      })
    : new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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

function parseAffissioneDates(text: string): { start: string | null; end: string | null } {
    const match = text.match(/dal\s+(\d{2}\/\d{2}\/\d{4})\s+al\s+(\d{2}\/\d{2}\/\d{4})/);
    if (!match) return { start: null, end: null };
    const toISO = (d: string) => {
        const [day, month, year] = d.split('/');
        return `${year}-${month}-${day}`;
    };
    return { start: toISO(match[1]), end: toISO(match[2]) };
}

function extractCardsFromHTML($: cheerio.CheerioAPI): NoticeCard[] {
    const cards: NoticeCard[] = [];
    $('.card-wrapper.cmp-list-card-img').each((_, wrapper) => {
        const $card = $(wrapper);
        const linkEl = $card.find('a[href*="/documento-albo/"]').first();
        let link = linkEl.attr('href') || '';
        if (!link) return;
        if (!link.startsWith('http')) link = new URL(link, ALBO_BASE_URL).toString();

        const title = $card.find('.card-text').first().text().trim();
        if (!title || title.length < 5) return;

        const category = $card.find('.categoryicon-top .text a').first().text().trim() || 'Altro';
        const atto_number = $card.find('.chip-label').first().text().trim() || '';
        const dateText = $card.find('.data').first().text().trim();
        const dates = parseAffissioneDates(dateText);

        cards.push({ title, link, category, atto_number, affissione_start: dates.start, affissione_end: dates.end });
    });
    return cards;
}

export async function extractDetailContent(detailUrl: string): Promise<{ text: string; pdfAttachments: PdfAttachment[]; pdfBase64Data: string[] }> {
    try {
        const res = await fetch(detailUrl, { headers: FETCH_HEADERS });
        if (!res.ok) return { text: "", pdfAttachments: [], pdfBase64Data: [] };
        const html = await res.text();
        const $ = cheerio.load(html);

        const pdfAttachments: PdfAttachment[] = [];
        $('a').each((_, el) => {
            const href = $(el).attr('href') || '';
            if (/\.pdf$/i.test(href)) {
                const fullUrl = href.startsWith('http') ? href : new URL(href, ALBO_BASE_URL).toString();
                const rawLabel = $(el).text().trim() || $(el).attr('aria-label') || $(el).attr('title') || 'Documento PDF';
                const label = rawLabel.replace(/\s+/g, ' ').substring(0, 100);
                if (!pdfAttachments.some(p => p.url === fullUrl)) {
                    pdfAttachments.push({ url: fullUrl, label });
                }
            }
        });

        console.log(`     📎 Trovati ${pdfAttachments.length} allegati PDF`);

        const pageText = $('main').text().trim() || $('body').text().trim();
        const combinedText = `=== CONTENUTO PAGINA WEB DETTAGLIO ===\n${pageText.substring(0, 4000)}\n\n`;
        const pdfBase64Data: string[] = [];

        // Logica "Smart": Nessun limite di numero, solo di peso (Max 15MB totali per non far crashare l'API)
        const MAX_TOTAL_BYTES = 15 * 1024 * 1024; 
        let currentTotalBytes = 0;

        for (const pdf of pdfAttachments) {
            try {
                console.log(`        📄 Download PDF per AI: ${pdf.label}`);
                const pdfRes = await fetch(pdf.url, { headers: FETCH_HEADERS });
                if (pdfRes.ok) {
                    const buffer = await pdfRes.arrayBuffer();
                    
                    if (currentTotalBytes + buffer.byteLength <= MAX_TOTAL_BYTES) {
                        pdfBase64Data.push(Buffer.from(buffer).toString('base64'));
                        currentTotalBytes += buffer.byteLength;
                    } else {
                        console.log(`        ⚠️ PDF saltato: Il peso totale degli allegati ha raggiunto il limite massimo di sicurezza (15MB) per Gemini.`);
                    }
                }
            } catch (pdfErr) {
                console.log(`        ⚠️ Errore download PDF ${pdf.label}: ${(pdfErr as Error).message}`);
            }
        }

        return { text: combinedText, pdfAttachments, pdfBase64Data };
    } catch (err) {
        console.log(`  ⚠️ Errore pagina dettaglio: ${(err as Error).message}`);
        return { text: "", pdfAttachments: [], pdfBase64Data: [] };
    }
}

async function generateAISummary(title: string, content: string, pdfBase64Data: string[] = [], retryCount = 0): Promise<{ ai_title: string; summary_short: string; summary_long: string; relevance: string }> {
    const fallback = {
        ai_title: title.substring(0, 100),
        summary_short: title.substring(0, 150),
        summary_long: "Riassunto non disponibile.",
        relevance: "locale",
    };

    const canUseAI = isVertexAI || !!process.env.GEMINI_API_KEY;
    if (!canUseAI) return fallback;

    try {
        const textToAnalyze = content && content.length > 50 ? content : title;

        const parts: any[] = [
            `Sei un assistente editoriale per i cittadini del Comune di Bedollo (Trentino). Analizzi atti dell'Albo Pretorio e produci riassunti chiari, utili e senza ridondanze.

REGOLE FONDAMENTALI:
- I 3 campi testuali (ai_title, summary_short, summary_long) devono essere COMPLEMENTARI, non ripetitivi. Ogni campo aggiunge informazioni nuove rispetto al precedente.
- ai_title cattura l'essenza in una frase. summary_short aggiunge il contesto immediato (chi, quando, perché) SENZA ripetere il titolo. summary_long dettaglia tutto il resto.
- Scrivi in italiano corrente. Zero burocratese. Se ti vengono forniti dei PDF, LEGGILI e trova le informazioni più importanti (incluso il testo da eventuali PDF scansionati).
- summary_long deve essere conciso ma completo: massimo 6-8 righe o bullet points.

CAMPO SPECIALE - "relevance":
- "locale" = riguarda Bedollo, i suoi abitanti, le sue strade, i suoi servizi
- "esterno" = proviene da altri comuni o enti terzi; pubblicato per obbligo ma non riguarda direttamente Bedollo

Restituisci SOLO un oggetto JSON valido con questi 4 campi:
1) "ai_title": string
2) "summary_short": string
3) "summary_long": string
4) "relevance": "locale" | "esterno"

Testo pagina web / Metadati:
${textToAnalyze.substring(0, 10000)}`
        ];

        for (const b64 of pdfBase64Data) {
            parts.push({
                inlineData: {
                    data: b64,
                    mimeType: "application/pdf"
                }
            });
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: parts,
        });

        const responseText = response.text || '';
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
        if (message.includes('429') && retryCount < 2) {
            console.log(`     ⏳ Rate limit superato, ritento tra 10 secondi...`);
            await new Promise(r => setTimeout(r, 10000));
            return generateAISummary(title, content, pdfBase64Data, retryCount + 1);
        }
    }

    return fallback;
}

export async function scrapeLatestNotices(maxNotices: number = 6) {
    if (!process.env.GEMINI_API_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("⛔ Scraping saltato: variabili d'ambiente mancanti.");
        return [];
    }

    console.log(`🔍 Inizio scraping Albo Pretorio di Bedollo (max ${maxNotices} nuovi avvisi)...\n`);
    const allResults = [];
    let processed = 0;
    const MAX_PAGES = 10;

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

            if (cards.length === 0) break;

            for (const card of cards) {
                if (processed >= maxNotices) break;

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

                const detailData = await extractDetailContent(card.link);
                console.log(`     📖 Contenuto estratto: HTML e ${detailData.pdfBase64Data.length} PDF pronti per IA.`);

                let contentForAI = detailData.text;
                if (!contentForAI || contentForAI.length < 50) {
                    const metaParts = [
                        `Titolo: ${card.title}`,
                        card.category ? `Categoria: ${card.category}` : '',
                        card.atto_number ? `Numero atto: ${card.atto_number}` : '',
                        card.affissione_start ? `Periodo affissione: dal ${card.affissione_start} al ${card.affissione_end || 'N/D'}` : '',
                    ].filter(Boolean);
                    contentForAI = metaParts.join('\n');
                }

                const summary = await generateAISummary(card.title, contentForAI, detailData.pdfBase64Data);
                console.log(`     🤖 AI Titolo: "${summary.ai_title}"`);

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
        console.log(`📣 Trovati ${allResults.length} nuovi avvisi! Innesco notifiche...`);
        try {
            const { totalSent } = await sendNotifications();
            console.log(`✉️ Notifiche inviate a ${totalSent} utenti.`);
        } catch (notifErr) {
            console.error("❌ Errore durante l'invio notifiche:", notifErr);
        }
    }

    return allResults;
}

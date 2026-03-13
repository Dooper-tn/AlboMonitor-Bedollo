"use server";

import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

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
 * Fetches and extracts text content from a detail page or PDF, returning both the text and the final PDF URL
 */
async function extractDetailContent(detailUrl: string): Promise<{ text: string; pdfUrl: string | null }> {
    try {
        const res = await fetch(detailUrl, { headers: FETCH_HEADERS });
        if (!res.ok) return { text: "", pdfUrl: null };
        const html = await res.text();
        const $ = cheerio.load(html);

        // Try to find a PDF link on the detail page
        let finalPdfUrl: string | null = null;
        const pdfHref = $('a[href$=".pdf"]').first().attr('href') || $('a:contains("Download")').first().attr('href');
        
        if (pdfHref) {
            finalPdfUrl = pdfHref.startsWith('http') ? pdfHref : new URL(pdfHref, ALBO_BASE_URL).toString();
            try {
                const pdfRes = await fetch(finalPdfUrl, { headers: FETCH_HEADERS });
                if (pdfRes.ok) {
                    const buffer = Buffer.from(await pdfRes.arrayBuffer());
                    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
                    const data = await pdfParse(buffer);
                    if (data.text && data.text.trim().length > 50) {
                        return { text: data.text.trim(), pdfUrl: finalPdfUrl };
                    }
                }
            } catch (pdfErr) {
                console.log(`  ⚠️ Errore PDF parsing: ${(pdfErr as Error).message}`);
            }
        }

        // Fallback: extract text from the detail page itself
        const pageText = $('main').text().trim() || $('body').text().trim();
        return { text: pageText.substring(0, 3000), pdfUrl: finalPdfUrl };
    } catch (err) {
        console.log(`  ⚠️ Errore pagina dettaglio: ${(err as Error).message}`);
        return { text: "", pdfUrl: null };
    }
}

/**
 * Generates an AI summary using Gemini
 */
async function generateAISummary(title: string, content: string, retryCount = 0): Promise<{ ai_title: string; summary_short: string; summary_long: string }> {
    const fallback = { 
        ai_title: title.substring(0, 100), 
        summary_short: title.substring(0, 150), 
        summary_long: "Riassunto non disponibile." 
    };

    if (!process.env.GEMINI_API_KEY) return fallback;

    try {
        const textToAnalyze = content && content.length > 50 ? content : title;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: `Sei un esperto assistente per i cittadini del Comune di Bedollo. Devi analizzare questo testo di un bando/atto dell'Albo Pretorio e restituire SOLO un oggetto JSON valido (senza markdown, senza backtick) con esattamente questi 3 campi:

1) "ai_title": Titolo semplificato e super chiaro in linguaggio non burocratico. Non troncare, usa una frase sensata (es: Senso unico alternato sulla S.P. 83 a Centrale).
2) "summary_short": Breve riassunto/abstract, fluido, che espanda leggermente il titolo dando il contesto immediato senza troppi dettagli (massimo 2 frasi).
3) "summary_long": Riassunto per esteso. Una panoramica completa di tutte le informazioni utili presenti nel documento (date, luoghi, importi, procedure, moduli), scritte in linguaggio semplice, cordiale e diretto al punto, organizzato se serve a punti elenco (usando \n e - all'interno della stringa JSON). Rimuovi ogni burocratismo inutile.

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
 * Main scraping function — fetches all pages, extracts notices, generates AI summaries, and stores in DB
 */
export async function scrapeLatestNotices(maxPages: number = 6) {
    if (!process.env.GEMINI_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("⛔ Scraping saltato: variabili d'ambiente mancanti.");
        return [];
    }

    console.log("🔍 Inizio scraping Albo Pretorio di Bedollo...\n");
    const allResults = [];

    for (let page = 1; page <= maxPages; page++) {
        const url = page === 1 ? ALBO_URL : `${ALBO_URL}?pagina=${page}`;
        console.log(`📄 Pagina ${page}/${maxPages}: ${url}`);

        try {
            const res = await fetch(url, { headers: FETCH_HEADERS });
            if (!res.ok) {
                console.log(`  ⚠️ Pagina ${page} ritorna status ${res.status}, salto.`);
                continue;
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

                // Extract content from detail page and find PDF url
                const detailData = await extractDetailContent(card.link);
                console.log(`     📖 Contenuto estratto: ${detailData.text.length} caratteri (PDF: ${detailData.pdfUrl ? 'Trovato' : 'No'})`);

                // Generate AI summary
                const summary = await generateAISummary(card.title, detailData.text);
                console.log(`     🤖 AI Titolo: "${summary.ai_title}"`);

                // Insert into DB
                const { data: inserted, error: insErr } = await supabase.from('notices').insert({
                    title: card.title,
                    link: card.link,
                    pdf_url: detailData.pdfUrl,
                    ai_title: summary.ai_title,
                    summary_short: summary.summary_short,
                    summary_long: summary.summary_long,
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
                    console.log(`     ✅ Salvato!`);
                }

                // Delay of 5 seconds to avoid Gemini API 429 errors (free tier is 15 RPM)
                console.log(`     ⏳ Attesa 5 secondi per limite API Gemini...`);
                await new Promise(r => setTimeout(r, 5000));
            }
        } catch (error) {
            console.error(`  ❌ Errore pagina ${page}:`, (error as Error).message);
        }
    }

    console.log(`\n✅ Scraping completato: ${allResults.length} nuovi avvisi inseriti.`);
    return allResults;
}

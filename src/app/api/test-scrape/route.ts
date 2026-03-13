import { NextResponse } from 'next/server';
import { scrapeLatestNotices } from '@/lib/scraper';

export const dynamic = 'force-dynamic';

export async function GET() {
    // Extra safety for build-time execution if force-dynamic is ignored
    if (process.env.NEXT_PHASE === 'phase-production-build') {
        return NextResponse.json({ skipped: true });
    }

    try {
        const results = await scrapeLatestNotices();
        return NextResponse.json({ success: true, count: results.length, data: results });
    } catch (error: any) {
        console.error("API error FULL TRACE:", error);
        return NextResponse.json({ success: false, error: error?.message || String(error), stack: error?.stack }, { status: 500 });
    }
}

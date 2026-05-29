import { NextResponse } from 'next/server';
import { scrapeLatestNotices } from '@/lib/scraper';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // Extra safety for build-time execution if force-dynamic is ignored
    if (process.env.NEXT_PHASE === 'phase-production-build') {
        return NextResponse.json({ skipped: true });
    }

    // Auth: richiede CRON_SECRET (come send-notifications)
    const authHeader = request.headers.get('authorization');
    const secret = process.env.CRON_SECRET;
    const isDev = process.env.NODE_ENV === 'development';

    if (!isDev && (!secret || authHeader !== `Bearer ${secret}`)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const max = parseInt(url.searchParams.get('max') || '6', 10);
        const results = await scrapeLatestNotices(max);
        return NextResponse.json({ success: true, count: results.length, data: results });
    } catch (error) {
        console.error("API error FULL TRACE:", error);
        return NextResponse.json({ success: false, error: (error as Error).message || String(error) }, { status: 500 });
    }
}

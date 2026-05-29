import { NextResponse } from 'next/server';
import { sendNotifications } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const secret = process.env.CRON_SECRET;
    const isDev = process.env.NODE_ENV === 'development';

    if (!isDev && (!secret || authHeader !== `Bearer ${secret}`)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log("Inizio job send-notifications...");

        const url = new URL(request.url);
        const subscriberId = url.searchParams.get('subscriber_id') || undefined;

        const { totalSent, reports } = await sendNotifications(subscriberId);

        return NextResponse.json({ success: true, totalSent, reports });

    } catch (err) {
        console.error("Errore generico in send-notifications:", err);
        return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';

const BASE_URL = 'https://clob.polymarket.com';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('token');
    const interval = searchParams.get('interval') || '1d'; // 1h, 1d, 1w, etc.
    const fidelity = searchParams.get('fidelity') || '60'; // minutes

    if (!tokenId) {
        return NextResponse.json({ error: 'Missing token parameter' }, { status: 400 });
    }

    // Build query params for Polymarket CLOB API
    const params = new URLSearchParams();
    params.set('market', tokenId);
    params.set('interval', interval);
    params.set('fidelity', fidelity);

    const targetUrl = `${BASE_URL}/prices-history?${params.toString()}`;

    try {
        const res = await fetch(targetUrl, {
            headers: {
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!res.ok) {
            const errorText = await res.text().catch(() => '');
            return NextResponse.json(
                { error: res.statusText, details: errorText },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Upstream fetch failed', details: message },
            { status: 502 }
        );
    }
}

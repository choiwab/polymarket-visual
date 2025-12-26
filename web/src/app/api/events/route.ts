import { NextResponse } from 'next/server';

const BASE_URL = 'https://gamma-api.polymarket.com';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    // Forward all query params to the events endpoint
    const targetUrl = `${BASE_URL}/events?${searchParams.toString()}`;

    try {
        const res = await fetch(targetUrl);
        if (!res.ok) {
            return NextResponse.json({ error: res.statusText }, { status: res.status });
        }
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

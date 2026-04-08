import { NextResponse } from 'next/server';

function normalizeQueries(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    const arr = raw.map((q) => String(q).trim()).filter(Boolean);
    return arr.length ? arr : null;
  }
  if (typeof raw === 'string') {
    const arr = raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length ? arr : null;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const queries = normalizeQueries(body?.queries);
    const clientType = Number(body?.clientType ?? body?.client_type);

    if (!queries) {
      return NextResponse.json(
        { error: 'queries must be a non-empty string[] or newline-separated string' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(clientType)) {
      return NextResponse.json(
        { error: 'clientType or client_type must be a number' },
        { status: 400 }
      );
    }

    const token = process.env.APIFY_API_TOKEN;
    const actorId = process.env.APIFY_ACTOR_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!token || !actorId) {
      return NextResponse.json({ error: 'Missing APIFY_API_TOKEN or APIFY_ACTOR_ID' }, { status: 500 });
    }

    const fallbackBase = new URL(request.url).origin;
    const base = (appUrl || fallbackBase).replace(/\/$/, '');
    const requestUrl = `${base}/api/webhooks/apify`;
    const payloadTemplate = `{"resource":{{resource}},"eventData":{"clientType":${clientType}}}`;
    const apifyUrl = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs`);
    apifyUrl.searchParams.set('token', token);

    const apifyRes = await fetch(apifyUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries, maxResultsPerQuery: 10 }),
    });
    const apifyJson = (await apifyRes.json().catch(() => ({}))) as {
      data?: { id?: string };
      error?: { message?: string };
    };

    if (!apifyRes.ok) {
      return NextResponse.json(
        { error: apifyJson.error?.message ?? 'Failed to start Apify run' },
        { status: 500 }
      );
    }

    return NextResponse.json({ runId: apifyJson.data?.id ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

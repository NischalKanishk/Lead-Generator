import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';

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

    if (!token || !actorId || !appUrl) {
      return NextResponse.json({ error: 'Missing APIFY_API_TOKEN, APIFY_ACTOR_ID, or NEXT_PUBLIC_APP_URL' }, { status: 500 });
    }

    const base = appUrl.replace(/\/$/, '');
    const requestUrl = `${base}/api/webhooks/apify`;
    const payloadTemplate = `{"resource":{{resource}},"eventData":{"clientType":${clientType}}}`;

    const client = new ApifyClient({ token });
    const run = await client.actor(actorId).start(
      { queries, maxResultsPerQuery: 10 },
      {
        webhooks: [
          {
            eventTypes: ['ACTOR.RUN.SUCCEEDED'],
            requestUrl,
            payloadTemplate,
            isAdHoc: true,
          },
        ],
      },
    );

    return NextResponse.json({ runId: run.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

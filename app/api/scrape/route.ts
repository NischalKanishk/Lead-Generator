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

    const cityRaw = body?.city;
    const city =
      typeof cityRaw === 'string'
        ? cityRaw.trim()
        : cityRaw != null
          ? String(cityRaw).trim()
          : '';
    const hasCity = city.length > 0;

    if (!Number.isFinite(clientType)) {
      return NextResponse.json(
        { error: 'clientType or client_type must be a number' },
        { status: 400 }
      );
    }

    let actorInput: Record<string, unknown>;
    if (hasCity) {
      actorInput = {
        city,
        instituteTypes: body?.instituteTypes,
        maxPerType: body?.maxPerType,
        clientType,
      };
    } else if (queries) {
      const maxPerType = Number(body?.maxPerType);
      actorInput = {
        queries,
        maxResultsPerQuery: maxPerType || 10,
      };
    } else {
      return NextResponse.json(
        {
          error:
            'Provide either city (with instituteTypes / maxPerType as needed) or queries (non-empty string[] or newline-separated string)',
        },
        { status: 400 }
      );
    }

    const token = process.env.APIFY_API_TOKEN;
    const actorId = process.env.APIFY_ACTOR_ID;

    if (!token || !actorId) {
      return NextResponse.json({ error: 'Missing APIFY_API_TOKEN or APIFY_ACTOR_ID' }, { status: 500 });
    }

    const apifyUrl = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs`);
    apifyUrl.searchParams.set('token', token);

    const apifyRes = await fetch(apifyUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actorInput),
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

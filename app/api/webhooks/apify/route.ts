import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { gunzip } from 'zlib';
import { promisify } from 'util';

const gunzipAsync = promisify(gunzip);

type ApifyDatasetItem = {
  title?: string;
  url?: string;
  snippet?: string;
  [key: string]: unknown;
};

type ApifyWebhookBody = {
  resource?: { id?: string };
  eventData?: { clientType?: number | string };
};

export async function POST(req: Request) {
  try {
    let body: ApifyWebhookBody;
    const contentEncoding = req.headers.get('content-encoding') || '';
    const rawBuffer = Buffer.from(await req.arrayBuffer());

    try {
      if (contentEncoding.includes('gzip') || contentEncoding.includes('br')) {
        const decompressed = await gunzipAsync(rawBuffer);
        body = JSON.parse(decompressed.toString('utf-8'));
      } else {
        body = JSON.parse(rawBuffer.toString('utf-8'));
      }
    } catch {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const runId = body?.resource?.id as string | undefined;
    const clientType = Number(body?.eventData?.clientType);

    if (!runId) {
      return NextResponse.json({ error: 'Missing resource.id' }, { status: 400 });
    }
    if (!Number.isFinite(clientType)) {
      return NextResponse.json({ error: 'Invalid eventData.clientType' }, { status: 400 });
    }

    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Missing APIFY_API_TOKEN' }, { status: 500 });
    }

    const url = `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: `Apify fetch failed: ${res.status}`, detail: t }, { status: 502 });
    }

    const items = (await res.json()) as ApifyDatasetItem[];
    const rows = items
      .map((item) => {
        const linkedin_url = typeof item.url === 'string' ? item.url : '';
        if (!linkedin_url) return null;
        return {
          name: typeof item.title === 'string' ? item.title : '',
          linkedin_url,
          notes: typeof item.snippet === 'string' ? item.snippet : '',
          source: 'google_search',
          client_type: clientType,
          status: 'new',
        };
      })
      .filter(Boolean) as Record<string, unknown>[];

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from('leads').upsert(rows, {
      onConflict: 'linkedin_url',
      ignoreDuplicates: true,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


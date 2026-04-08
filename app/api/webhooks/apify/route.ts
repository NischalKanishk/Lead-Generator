import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { gunzipSync } from 'zlib';

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
    // Handle gzip-compressed bodies from Apify
    const rawBuffer = Buffer.from(await req.arrayBuffer());
    let body: ApifyWebhookBody;
    try {
      // Try gunzip first (Apify compresses webhook bodies)
      const decompressed = gunzipSync(rawBuffer);
      body = JSON.parse(decompressed.toString('utf-8')) as ApifyWebhookBody;
    } catch {
      // Fall back to plain JSON
      try {
        body = JSON.parse(rawBuffer.toString('utf-8')) as ApifyWebhookBody;
      } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
      }
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
    const leads = items.map((item: ApifyDatasetItem) => {
      const url = typeof item.url === 'string' ? item.url : '';
      const src = item.source;
      const srcStr = typeof src === 'string' ? src : 'duckduckgo';
      const ct = Number(item.client_type);
      const head =
        String(item.name ?? item.title ?? '')
          .split('|')[0]
          .split('-')[0]
          .trim() || null;
      const snippet = typeof item.snippet === 'string' ? item.snippet : null;
      const allPhones = item.all_phones;
      let phonesLine: string | null = null;
      if (Array.isArray(allPhones)) {
        const joined = allPhones.map(String).filter(Boolean).join(', ');
        phonesLine = joined ? joined : null;
      } else if (typeof allPhones === 'string' && allPhones.trim()) {
        phonesLine = allPhones.trim();
      } else if (allPhones != null && allPhones !== '') {
        phonesLine = String(allPhones);
      }
      const notes =
        [snippet, phonesLine].filter(Boolean).join('\n\n') || null;
      return {
        name: head,
        title: typeof item.title === 'string' ? item.title : null,
        email: typeof item.email === 'string' ? item.email : null,
        phone: typeof item.phone === 'string' ? item.phone : null,
        linkedin_url: url && url.includes('linkedin.com') ? url : null,
        company_name: head,
        company_website: url && !url.includes('linkedin.com') ? url : null,
        city:
          (typeof item.location === 'string' && item.location) ||
          (typeof item.city === 'string' && item.city) ||
          null,
        notes,
        source: srcStr,
        client_type: ct || clientType,
        status: 'new' as const,
        apify_run_id: runId,
      };
    });

    if (leads.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from('leads').upsert(leads, {
      onConflict: 'company_website',
      ignoreDuplicates: true,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: leads.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


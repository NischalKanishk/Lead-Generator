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
    const leads = items.map((item: any) => {
      const cleanName = (item.name || item.title || '')
        .split('|')[0].split(' - ')[0].split('–')[0].trim()

      return {
        name: cleanName || null,
        title: item.title || null,
        email: item.email || null,
        phone: item.phone || null,
        linkedin_url: item.url && item.url.includes('linkedin.com/in/') ? item.url : null,
        company_name: cleanName || null,
        company_website: item.url && !item.url.includes('linkedin.com') ? item.url : null,
        company_city: null,
        notes: item.snippet || null,
        source: item.source || 'duckduckgo',
        client_type: item.client_type || clientType,
        status: 'new',
        apify_run_id: runId,
      }
    })

    if (leads.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    const supabase = getSupabase();
    const withEmail = leads.filter((l) => l.email);
    const withoutEmail = leads.filter((l) => !l.email);

    if (withEmail.length > 0) {
      const { error } = await supabase
        .from('leads')
        .upsert(withEmail, {
          onConflict: 'email',
          ignoreDuplicates: true,
        });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    if (withoutEmail.length > 0) {
      const { error } = await supabase.from('leads').insert(withoutEmail);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, count: leads.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


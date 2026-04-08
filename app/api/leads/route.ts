import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20)
    );
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = getSupabase();
    let q = supabase.from('leads').select('*', { count: 'exact' });

    const clientType = searchParams.get('client_type');
    if (clientType !== null && clientType !== '') {
      const n = Number(clientType);
      if (!Number.isNaN(n)) q = q.eq('client_type', n);
    }

    const status = searchParams.get('status');
    if (status) q = q.eq('status', status);

    const city = searchParams.get('city');
    if (city) q = q.ilike('city', `%${escapeIlike(city)}%`);

    const search = searchParams.get('search');
    if (search) {
      const s = escapeIlike(search);
      q = q.or(
        `name.ilike.%${s}%,company_name.ilike.%${s}%,title.ilike.%${s}%,email.ilike.%${s}%`
      );
    }

    const { data: leads, error, count } = await q
      .order('id', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      leads: leads ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = getSupabase();

    const row = {
      name: body.name ?? '',
      title: body.title ?? null,
      email: body.email || null,
      company_name: body.company_name ?? null,
      city: body.city ?? body.company_city ?? null,
      company_website: body.company_website || null,
      linkedin_url: body.linkedin_url || null,
      client_type: Number(body.client_type),
      status: body.status ?? 'new',
      notes: body.notes ?? null,
    };

    const { data, error } = await supabase
      .from('leads')
      .insert(row)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = body?.id;
    if (id === undefined || id === null) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const { id: _bodyId, ...updates } = body;
    void _bodyId;
    const supabase = getSupabase();
    const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

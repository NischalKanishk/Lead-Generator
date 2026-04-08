import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { generateText } from '@/lib/groq';

const BASE_PROMPTS: Record<number, string> = {
  1: `You write cold emails for OneMoment, a company that designs premium corporate offsite experiences in India. Target is Head of People or HR. Under 120 words. No fluff. One hook, one CTA. First name only.`,
  2: `You write cold emails for OneMoment, a corporate travel partner for companies in India managing flights, hotels, ground transport. Target is Office Manager or Admin. Under 100 words. Make it feel easy not salesy.`,
  3: `You write cold emails for OneMoment, organizing student educational trips and placement tours in India. Target is Placement Coordinator or Dean. Under 100 words. Simple language. Compliance-friendly.`,
};

type GenType = 'initial' | 'follow_up_1' | 'follow_up_2' | 'follow_up_3';

const FOLLOW_UP_META: Record<
  Exclude<GenType, 'initial'>,
  { n: number; hint: string }
> = {
  follow_up_1: { n: 1, hint: 'gentle bump' },
  follow_up_2: { n: 2, hint: 'add one new value point' },
  follow_up_3: { n: 3, hint: 'close the loop gracefully, leave door open' },
};

const COLUMN_BY_TYPE: Record<GenType, string> = {
  initial: 'generated_email',
  follow_up_1: 'follow_up_1',
  follow_up_2: 'follow_up_2',
  follow_up_3: 'follow_up_3',
};

function buildSystemPrompt(clientType: number, type: GenType): string {
  const base = BASE_PROMPTS[clientType];
  if (!base) {
    throw new Error(`Unknown client_type: ${clientType}`);
  }

  if (type === 'initial') return base;

  const { n, hint } = FOLLOW_UP_META[type];
  return `${base}

This is follow-up number ${n}. Previous email was ignored. Keep it under 60 words. ${hint}.`;
}

function buildUserPrompt(lead: Record<string, unknown>): string {
  const lines = [
    `Write the email body only (no subject line unless essential).`,
    `Lead name: ${lead.name ?? ''}`,
    `Company: ${lead.company_name ?? ''}`,
    `City: ${lead.city ?? ''}`,
    `Notes / context: ${lead.notes ?? ''}`,
    `LinkedIn: ${lead.linkedin_url ?? ''}`,
  ];
  return lines.join('\n');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const leadId = body?.leadId;
    const type = body?.type as GenType;

    const allowed: GenType[] = ['initial', 'follow_up_1', 'follow_up_2', 'follow_up_3'];
    if (leadId === undefined || leadId === null || !allowed.includes(type)) {
      return NextResponse.json({ error: 'Invalid leadId or type' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: lead, error: fetchErr } = await supabase.from('leads').select('*').eq('id', leadId).single();

    if (fetchErr || !lead) {
      return NextResponse.json({ error: fetchErr?.message ?? 'Lead not found' }, { status: 404 });
    }

    const clientType = Number(lead.client_type);
    if (![1, 2, 3].includes(clientType)) {
      return NextResponse.json({ error: 'Lead client_type must be 1, 2, or 3' }, { status: 400 });
    }

    const system = buildSystemPrompt(clientType, type);
    const user = buildUserPrompt(lead as Record<string, unknown>);
    const content = await generateText(system, user);

    const column = COLUMN_BY_TYPE[type];
    const { error: upErr } = await supabase
      .from('leads')
      .update({ [column]: content })
      .eq('id', leadId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const { data: updatedRow } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    return NextResponse.json({ content, lead: updatedRow ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

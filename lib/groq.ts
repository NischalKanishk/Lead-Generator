import Groq from 'groq-sdk'

export async function generateText(systemPrompt: string, userPrompt: string) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    max_tokens: 400,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  })
  return completion.choices[0]?.message?.content || ''
}
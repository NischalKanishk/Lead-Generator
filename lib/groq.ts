import "server-only";

import Groq from "groq-sdk";

const MODEL = "llama-3.1-8b-instant";

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  const completion = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 400,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

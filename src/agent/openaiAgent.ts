import { AgentContext, AgentDecision } from "../types/game";
import { fallbackDecision } from "./fallbackAgent";
import { buildAgentPrompt } from "./prompt";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const parseDecision = (text: string): AgentDecision | null => {
  const trimmed = text.trim();
  const blockMatch = trimmed.match(/\{[\s\S]*\}/);
  const json = blockMatch ? blockMatch[0] : trimmed;

  try {
    const parsed = JSON.parse(json) as AgentDecision;
    if (!parsed.action || !parsed.reasoning) return null;
    return {
      action: String(parsed.action),
      target: parsed.target ? String(parsed.target) : undefined,
      reasoning: String(parsed.reasoning),
    };
  } catch {
    return null;
  }
};

export const decideAction = async (ctx: AgentContext): Promise<AgentDecision> => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const fallback = fallbackDecision(ctx);
    return { ...fallback, reasoning: `${fallback.reasoning} (fallback: missing OPENAI_API_KEY)` };
  }

  const prompt = buildAgentPrompt(ctx);

  try {
    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are a strategic survival game agent. Return valid JSON only: {\"action\": string, \"target\": string|null, \"reasoning\": string}.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const fallback = fallbackDecision(ctx);
      return {
        ...fallback,
        reasoning: `${fallback.reasoning} (fallback: OpenAI ${response.status})`,
      };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = parseDecision(content);
    if (!parsed) {
      const fallback = fallbackDecision(ctx);
      return { ...fallback, reasoning: `${fallback.reasoning} (fallback: parse failure)` };
    }

    return parsed;
  } catch {
    const fallback = fallbackDecision(ctx);
    return { ...fallback, reasoning: `${fallback.reasoning} (fallback: request error)` };
  }
};

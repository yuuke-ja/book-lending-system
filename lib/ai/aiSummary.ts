import "server-only";
import { groq } from "@/lib/ai/groq";
import { db } from "@/lib/db";

type SummaryInput = {
  sourceType: "thread" | "comment";
  sourceId: string;
  content: string;
  updatedAt: string | Date;
};

export async function summary(input: SummaryInput) {
  const result = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
          あなたは文章要約システムです。
          以下の文章を推薦判断に使えるように短く要約してください。
          否定的な意見、注意点、不満、訂正は消さないでください。
          原文にない表現・数値・仕様を追加しないでください。
          数値や固有名詞は原文の表現をそのまま使ってください。
          200文字以内で要約してください。
          必ずJSONだけで返してください。
          形式:
          {
            "summary": "要約文"
          }
        `
      },
      {
        role: "user",
        content: input.content
      }
    ]
  });
  const content = result.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as { summary?: string };
  const summary = parsed.summary?.trim() ?? "";

  if (!summary) return null;

  if (input.sourceType === "thread") {
    await db.query(
      `UPDATE "Thread"
       SET "aiSummary" = $1,
           "aiSummarySourceUpdatedAt" = $2
       WHERE id = $3`,
      [summary, input.updatedAt, input.sourceId]
    );
  } else {
    await db.query(
      `UPDATE "ThreadComment"
       SET "aiSummary" = $1,
           "aiSummarySourceUpdatedAt" = $2
       WHERE id = $3`,
      [summary, input.updatedAt, input.sourceId]
    );
  }

  return summary;

}

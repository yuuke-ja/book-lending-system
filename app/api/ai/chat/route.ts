import { NextRequest, NextResponse } from "next/server";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { groq as groqModel } from "@ai-sdk/groq";
import { groq } from "@/lib/ai/groq";
import { searchBooks } from "@/lib/ai/search-books";
import { librarySystemDocument } from "@/lib/ai/librarySystemDocument";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";


type IntentResult = {
  intent?: string;
  searchQuery?: string;
  reply?: string;
};

type RecommendedBook = {
  recommendationId?: string;
  bookId?: string;
  title?: string;
  imageUrl?: string | null;
  reason?: string;
};

export const maxDuration = 30;

type AiMessageMetadata = {
  recommendedBooks?: RecommendedBook[];
};

type AiChatMessageRow = {
  id: string;
  userEmail: string;
  role: "user" | "assistant";
  content: string;
  metadata: AiMessageMetadata | null;
  createdAt: Date;
};

function getLastUserText(messages: UIMessage[]) {
  const lastUserMessage = messages.findLast((message) => message.role === "user");

  return lastUserMessage?.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim() ?? "";
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function createTextMessage(id: string, role: "user" | "assistant", content: string, metadata?: AiMessageMetadata): UIMessage {
  return {
    id,
    role,
    metadata,
    parts: content ? [{ type: "text", text: content }] : [],
  };
}

async function saveUserMessage(input: {
  message: UIMessage;
  userEmail: string;
  intent?: string;
  searchQuery?: string;
}) {
  //ユーザーのメッセージを保存する
  await db.query(
    `INSERT INTO "AiChatMessage"
       (id, "userEmail", role, content, metadata, intent, "searchQuery", "updatedAt")
     VALUES ($1, $2, 'user', $3, $4::jsonb, $5, $6, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE
     SET
       "userEmail" = EXCLUDED."userEmail",
       content = EXCLUDED.content,
       metadata = EXCLUDED.metadata,
       intent = EXCLUDED.intent,
       "searchQuery" = EXCLUDED."searchQuery",
       "updatedAt" = CURRENT_TIMESTAMP`,
    [
      input.message.id,
      input.userEmail,
      getMessageText(input.message),
      JSON.stringify(input.message.metadata ?? null),
      input.intent ?? null,
      input.searchQuery ?? null,
    ]
  );
}

async function saveAssistantMessage(input: {
  message: UIMessage;
  userEmail: string;
  intent?: string;
  searchQuery?: string;
  metadata?: AiMessageMetadata;
}) {
  const metadata = input.metadata ?? input.message.metadata ?? null;
  //AIの返答をDBに保存する関数。
  await db.query(
    `INSERT INTO "AiChatMessage"
       (id, "userEmail", role, content, metadata, intent, "searchQuery", "updatedAt")
     VALUES ($1, $2, 'assistant', $3, $4::jsonb, $5, $6, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE
     SET
       "userEmail" = EXCLUDED."userEmail",
       content = EXCLUDED.content,
       metadata = EXCLUDED.metadata,
       intent = EXCLUDED.intent,
       "searchQuery" = EXCLUDED."searchQuery",
       "updatedAt" = CURRENT_TIMESTAMP`,
    [
      input.message.id,
      input.userEmail,
      getMessageText(input.message),
      JSON.stringify(metadata),
      input.intent ?? null,
      input.searchQuery ?? null,
    ]
  );
}

export async function GET() {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  //そのユーザーのチャット履歴
  const messageResult = await db.query<AiChatMessageRow>(
    `SELECT *
	     FROM (
	       SELECT id, "userEmail", role, content, metadata, "createdAt"
	       FROM "AiChatMessage"
	       WHERE "userEmail" = $1
	       ORDER BY "createdAt" DESC, id DESC
       LIMIT 20
     ) recent_messages
     ORDER BY "createdAt" ASC, id ASC`,
    [userEmail]
  );

  return NextResponse.json(
    {
      messages: messageResult.rows
        .filter((message) => message.userEmail === userEmail)
        .map((message) =>
          createTextMessage(
            message.id,
            message.role,
            message.content,
            message.metadata ?? undefined
          )
        ),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  const body = await request.json();
  const messages = Array.isArray(body.messages) ? body.messages as UIMessage[] : null;
  const query = typeof body.query === "string" ? body.query : getLastUserText(messages ?? []);
  if (!query) {
    return NextResponse.json({ error: "クエリが必要です" }, { status: 400 });
  }
  const fallbackUserMessage = createTextMessage(randomUUID(), "user", query);
  const originalMessages = messages ?? [fallbackUserMessage];
  const lastUserMessage =
    originalMessages.findLast((message) => message.role === "user") ?? fallbackUserMessage;
  const modelMessages = messages
    ? await convertToModelMessages(originalMessages)
    : [{ role: "user" as const, content: query }];

  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
          あなたは図書推薦チャットの意図判定器です。
          ユーザー入力を次のどれかに分類してください。

          - book_search: 本を探している、おすすめ本を聞いている
          - smalltalk: 挨拶や雑談
          - System-questions : このプロマス図書のシステムの使い方に関する質問

          - need_more_info: おすすめしてほしいが条件が足りない
          - other: 図書推薦と関係ない依頼

          名前を聞かれた場合はsmalltalkに分類し、replyでは「プロマス図書AI」と名乗ってください。
          ChatGPTやOpenAIのアシスタントとは名乗らないでください。

          必ずJSONだけで返してください。
          形式:
          {
            "intent": "book_search | smalltalk | System-questions | need_more_info | other",
            "searchQuery": "book_searchのときの検索文",
            "reply": "book_search以外のときの返答"
          }
                  `,
      },
      {
        role: "user",
        content: query,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "{}";

  const r = JSON.parse(content) as IntentResult;
  await saveUserMessage({
    message: lastUserMessage,
    userEmail,
    intent: r.intent,
    searchQuery: r.searchQuery || query,
  });

  if (r.intent === "book_search") {
    const books = await searchBooks(r.searchQuery || query);
    const answer = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
            あなたは図書推薦チャットのアシスタントです。
            ユーザーの質問に対して、候補本の中からおすすめを選んでください。
            ルール:
            - 必ず候補本の中からだけおすすめしてください。
            - 候補にない本は出さないでください。
            - 候補本データは book と community に分かれています。
            - bookは本の登録情報です。
            - communityは他のユーザーが投稿した内容です。
            - 出力は bookReason と communityReason に完全に分けてください。
            - bookReasonにはbookのtitle/authors/descriptionに含まれる情報だけを書いてください。
            - bookReasonにはcommunityにしかない内容・単語・評価・注意点を絶対に入れないでください。
            - communityReasonにはcommunityに含まれる内容だけを書いてください。
            - communityが空、または推薦判断に使える内容がない場合、communityReasonは空文字にしてください。
            - communityをbookの情報として扱わないでください。
            - communityは事実とは限らないため、断定せず「コミュニティでは」「他のユーザーの投稿では」などの形で扱ってください。
            - community由来の内容を、本の客観情報やあなた自身の評価として書かないでください。community由来の内容は必ず「コミュニティでは」「他のユーザーの投稿では」と明示してください。
            - communityに肯定的な意見と否定的な意見の両方がある場合は、「コミュニティでは〜という声がある一方で、〜という指摘もあります」のようにcommunityReasonへ必ず両方を反映してください。片方だけに寄せないでください。
            - communityに否定・訂正・不満・注意点がある場合は、肯定的な理由に変換せず、注意点としてそのまま反映してください。
            - communityが本の説明やあなたの判断と矛盾する場合は、communityを無視せずcommunityReasonに「一方でコミュニティでは〜という指摘もあります」と書いてください。
            - communityに「〜ではない」「違う」「書かれていない」「古い」「難しい」「初心者向け」「実務向け」「分かりやすい」などの意見がある場合は、communityReasonに反映してください。
            - communityで否定されている内容を、推薦理由として断定しないでください。
            - 本情報やcommunityに書かれていない内容を補完してはいけません。特に対応言語、実装例、版の新しさについて推測で断定しないでください。
            - 対応言語については、book.descriptionに明記されていない限りbookReasonへ「本書はC++中心」「C++での解説が充実」などと書かないでください。communityにある場合はcommunityReasonへ「コミュニティでは〜という声があります」と書いてください。
            - 少数意見を全体の評価のように断定しないでください。
            - あまりにもcommunityの内容が多い場合は多くて5件程度に絞って反映してください。
            - 必ずJSONだけで返してください。
            形式:
            {
              "reply": "ユーザーへの返答",
              "recommendedBooks": [
                {
                  "bookId": "候補本のbook.id",
                  "bookReason": "bookだけを使ったおすすめ理由",
                  "communityReason": "communityだけを使った理由や注意点。なければ空文字"
                }
              ]
            }
          `,
        },
        {
          role: "user",
          content: `
            ユーザーの質問: ${query}
            候補本: ${JSON.stringify(
            books.map((b) => ({
              book: {
                id: b.id,
                title: b.title,
                authors: b.authors,
                description: b.description,
                distance: b.distance,
              },
              community: b.community,

            }))
          )}
          `,
        },
      ],
    });
    const answerContent = answer.choices[0]?.message?.content ?? "{}";
    const parsedAnswer = JSON.parse(answerContent);
    const recommendedBooks: RecommendedBook[] = [];

    if (Array.isArray(parsedAnswer.recommendedBooks)) {
      for (const recommendedBook of parsedAnswer.recommendedBooks) {
        if (!recommendedBook.bookId) continue;

        const book = books.find((book) => book.id === recommendedBook.bookId);
        if (!book) continue;

        const bookReason =
          typeof recommendedBook.bookReason === "string"
            ? recommendedBook.bookReason.trim()
            : "";
        const communityReason =
          typeof recommendedBook.communityReason === "string"
            ? recommendedBook.communityReason.trim()
            : "";
        const reasonParts = [bookReason, communityReason].filter(Boolean);

        recommendedBooks.push({
          bookId: recommendedBook.bookId,
          title: book.title,
          imageUrl: book.thumbnail,
          reason: reasonParts.join("\n") || recommendedBook.reason || "",
        });
      }
    }
    const assistantMessageId = randomUUID();
    const assistantMetadata: AiMessageMetadata = {
      recommendedBooks,
    };

    for (const [index, book] of recommendedBooks.entries()) {
      if (!book.bookId) continue;
      const result = await db.query(
        `INSERT INTO "AiRecommendation" 
        ("bookId", "userEmail", "query", "reason", "rank", "userMessageId")
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING "id"
          `,
        [
          book.bookId,
          userEmail,
          r.searchQuery || query,
          book.reason ?? "",
          index + 1,
          lastUserMessage.id,
        ]
      )
      recommendedBooks[index].recommendationId = result.rows[0]?.id;
    }
    assistantMetadata.recommendedBooks = recommendedBooks;

    const result = streamText({
      model: groqModel("openai/gpt-oss-20b"),
      messages: modelMessages,
      system: `
        あなたは図書推薦チャットのアシスタントです。
        名前を聞かれた場合だけ「プロマス図書AI」と名乗ってください。
        名前を聞かれていない場合は名乗らず、回答本文から始めてください。
        ChatGPTやOpenAIのアシスタントとは名乗らないでください。
        ユーザーと同じ言語で返答してください。
        必ず候補本の中からだけおすすめしてください。
        候補にない本は出さないでください。
        おすすめする本のタイトルと理由を短く説明してください。

        検索文: ${r.searchQuery || query}
        候補本: ${JSON.stringify(
        books.map((book) => ({
          id: book.id,
          title: book.title,
          authors: book.authors,
          description: book.description,
          distance: book.distance,
        }))
      )}
        選定済みのおすすめ: ${JSON.stringify(recommendedBooks)}
        参考返答: ${parsedAnswer.reply ?? ""}
      `,
    });

    if (recommendedBooks.length > 0) {
      return result.toUIMessageStreamResponse({
        originalMessages,
        generateMessageId: () => assistantMessageId,
        messageMetadata: () => assistantMetadata,
        onFinish: async ({ responseMessage }) => {
          await saveAssistantMessage({
            message: responseMessage,
            userEmail,
            intent: r.intent,
            searchQuery: r.searchQuery || query,
            metadata: assistantMetadata,
          });
        },
      });
    }

    return result.toUIMessageStreamResponse({
      originalMessages,
      generateMessageId: () => assistantMessageId,
      onFinish: async ({ responseMessage }) => {
        await saveAssistantMessage({
          message: responseMessage,
          userEmail,
          intent: r.intent,
          searchQuery: r.searchQuery || query,
        });
      },
    });
  } else if (r.intent === "System-questions") {
    const assistantMessageId = randomUUID();
    const result = streamText({
      model: groqModel("openai/gpt-oss-20b"),
      messages: modelMessages,
      system: `
        あなたはプロマス図書のシステム質問に答えるアシスタントです。
        ユーザーの質問に対して、プロマス図書の使い方を説明してください。
        必ずドキュメントに書いてある内容だけで答えてください。
        回答にはドキュメントの該当箇所に書かれている内容だけを使ってください。
        ドキュメントにない仕様は絶対に言わないでください。
        ドキュメントの内容を言い換えるのは許可しますが、手順や道具や完了条件を勝手に追加しないでください。
        ドキュメントにない数値や事実は作らないでください。
        ドキュメントに書いていないものは「その情報は確認できません」と答えてください。
        名前を聞かれた場合だけ「プロマス図書AI」と名乗ってください。
        名前を聞かれていない場合は名乗らず、回答本文から始めてください。
        ChatGPTやOpenAIのアシスタントとは名乗らないでください。
        ユーザーと同じ言語で短く返答してください。
        ドキュメント:${librarySystemDocument}
      `,
    });
    return result.toUIMessageStreamResponse({
      originalMessages,
      generateMessageId: () => assistantMessageId,
      onFinish: async ({ responseMessage }) => {
        await saveAssistantMessage({
          message: responseMessage,
          userEmail,
          intent: r.intent,
          searchQuery: r.searchQuery || query,
        });
      },
    });
  } else {
    const assistantMessageId = randomUUID();
    const result = streamText({
      model: groqModel("openai/gpt-oss-20b"),
      messages: modelMessages,
      system: `
        あなたは図書推薦チャットです。
        名前を聞かれた場合だけ「プロマス図書AI」と名乗ってください。
        名前を聞かれていない場合は名乗らず、回答本文から始めてください。
        ChatGPTやOpenAIのアシスタントとは名乗らないでください。
        ユーザーと同じ言語で短く返答してください。
        本の推薦ではない場合は、登録済みの本のおすすめやプロマス図書システムに関する質問なら対応できると伝えてください。
        参考返答: ${r.reply ?? ""}
      `,
    });

    return result.toUIMessageStreamResponse({
      originalMessages,
      generateMessageId: () => assistantMessageId,
      onFinish: async ({ responseMessage }) => {
        await saveAssistantMessage({
          message: responseMessage,
          userEmail,
          intent: r.intent,
          searchQuery: r.searchQuery || query,
        });
      },
    });
  }
}

"use client";

import { useEffect, useState } from "react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { cn } from "@/lib/utils";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";

type RecommendedBook = {
  recommendationId?: string;
  bookId?: string;
  title?: string;
  imageUrl?: string | null;
  reason?: string;
};

type AiMessageMetadata = {
  recommendedBooks?: RecommendedBook[];
};

type AiChatHistoryResponse = {
  messages: UIMessage[];
};

type AiBookChatProps = {
  className?: string;
};

function aiBookLinkClick(bookId: string | undefined, sourceId: string | undefined) {
  if (!bookId || !sourceId) return;

  fetch("/api/ai/book-link-click", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventType: "book_link_click",
      bookId,
      sourceType: "ai_chat",
      sourceId,
    }),
    keepalive: true,
  }).catch((error) => {
    console.error("AIおすすめ本リンククリックログの送信に失敗:", error);
  });
}


function AiBookChatInner({
  initialMessages,
  className,
}: {
  initialMessages: UIMessage[];
  className?: string;
}) {
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div
      className={cn(
        "flex h-[600px] min-h-0 flex-col overflow-hidden rounded-xl border bg-white",
        className
      )}
    >
      <Conversation className="min-h-0">
        <ConversationContent>
          {messages.map((message) => {
            const metadata = message.metadata as AiMessageMetadata | undefined;
            const recommendedBooks = metadata?.recommendedBooks ?? [];
            return (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {recommendedBooks.length > 0 ? (
                    <div className="space-y-4">
                      {recommendedBooks.map((book) => (
                        <div key={book.bookId}>
                          {book.title ? (
                            <p className="font-semibold">{book.title}</p>
                          ) : null}
                          {book.reason ? (
                            <p className="mt-1">{book.reason}</p>
                          ) : null}
                          {book.imageUrl ? (
                            <a
                              href={`/book/${book.bookId}`}
                              onClick={() => aiBookLinkClick(book.bookId, book.recommendationId)}
                            >
                              <img
                                src={book.imageUrl}
                                alt={book.title ?? "おすすめ本"}
                                className="mt-2 h-32 w-24 rounded border border-zinc-200 object-contain"
                              />
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    message.parts.map((part, index) =>
                      part.type === "text" ? (
                        <MessageResponse key={index}>
                          {part.text}
                        </MessageResponse>
                      ) : null
                    )
                  )}
                </MessageContent>
              </Message>
            );
          })}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-4">
        <PromptInput
          onSubmit={() => {
            if (!input.trim() || isLoading) return;

            sendMessage({ text: input });
            setInput("");
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="おすすめの本を聞く"
            />
          </PromptInputBody>

          <PromptInputFooter>
            <PromptInputSubmit
              status={status}
              disabled={!input.trim() || isLoading}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export default function AiBookChat({ className }: AiBookChatProps) {
  const [history, setHistory] = useState<AiChatHistoryResponse | null>(null);

  useEffect(() => {
    let ignore = false;

    fetch("/api/ai/chat", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("AIチャット履歴の取得に失敗しました");
        return response.json() as Promise<AiChatHistoryResponse>;
      })
      .then((data) => {
        if (!ignore) setHistory(data);
      })
      .catch((error) => {
        console.error("AIチャット履歴の取得に失敗:", error);
        if (!ignore) setHistory({ messages: [] });
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (!history) {
    return (
      <div
        className={cn(
          "flex h-[600px] min-h-0 items-center justify-center rounded-xl border bg-white text-sm text-zinc-500",
          className
        )}
      >
        読み込み中...
      </div>
    );
  }

  return <AiBookChatInner initialMessages={history.messages} className={className} />;
}

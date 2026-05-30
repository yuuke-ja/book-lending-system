import "server-only";

type EmbeddingInputType = "query" | "passage";

type EmbeddingApiResponse = {
  embedding?: unknown;
};

export async function createEmbedding(
  input: string | unknown[],
  type: EmbeddingInputType
): Promise<number[]> {
  const embeddingApiUrl = process.env.EMBEDDING_API_URL?.replace(/\/$/, "");
  const hfToken = process.env.HF_TOKEN;

  if (!embeddingApiUrl) {
    throw new Error("EMBEDDING_API_URL が設定されていません");
  }

  if (!hfToken) {
    throw new Error("HF_TOKEN が設定されていません");
  }

  const normalizedInput = Array.isArray(input)
    ? input.filter(Boolean).map(String)
    : input;

  const response = await fetch(`${embeddingApiUrl}/embedding`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${hfToken}`,
    },
    body: JSON.stringify({
      input: normalizedInput,
      type,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Embedding API failed: ${response.status} ${message.slice(0, 300)}`
    );
  }

  const data = (await response.json()) as EmbeddingApiResponse;

  if (
    !Array.isArray(data.embedding) ||
    !data.embedding.every((value) => typeof value === "number")
  ) {
    throw new Error("Embedding API returned an invalid embedding");
  }

  return data.embedding;
}

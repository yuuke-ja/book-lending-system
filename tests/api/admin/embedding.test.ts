import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmbedding } from "@/app/api/admin/book-embeddings/embedding";

vi.mock("server-only", () => ({}));

describe("createEmbedding", () => {
  const originalEmbeddingApiUrl = process.env.EMBEDDING_API_URL;
  const originalHfToken = process.env.HF_TOKEN;
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.EMBEDDING_API_URL = "https://embedding.example.com/";
    process.env.HF_TOKEN = "hf_test";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    process.env.EMBEDDING_API_URL = originalEmbeddingApiUrl;
    process.env.HF_TOKEN = originalHfToken;
    vi.unstubAllGlobals();
  });

  it("Embedding APIで文章をベクトル化する", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ embedding: [1, 2, 3] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const embedding = await createEmbedding(
      ["React入門", "", "Web,JavaScript"],
      "passage"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://embedding.example.com/embedding",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer hf_test",
        },
        body: JSON.stringify({
          input: ["React入門", "Web,JavaScript"],
          type: "passage",
        }),
        cache: "no-store",
      })
    );
    expect(embedding).toEqual([1, 2, 3]);
  });
});

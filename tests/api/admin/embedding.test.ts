import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmbedding } from "@/app/api/admin/book-embeddings/embedding";
import { pipeline } from "@huggingface/transformers";

const extractorMock = vi.hoisted(() => vi.fn());
const pipelineMock = vi.hoisted(() =>
  vi.fn(() => Promise.resolve(extractorMock))
);

vi.mock("@huggingface/transformers", () => ({
  pipeline: pipelineMock,
}));

vi.mock("server-only", () => ({}));

describe("createEmbedding", () => {
  beforeEach(() => {
    extractorMock.mockClear();
  });

  it("Transformers.jsで文章をベクトル化する", async () => {
    extractorMock.mockResolvedValueOnce({
      data: new Float32Array([1, 2, 3]),
    });

    const embedding = await createEmbedding(
      ["React入門", "", "Web,JavaScript"],
      "passage"
    );

    expect(pipeline).toHaveBeenCalledWith(
      "feature-extraction",
      "Xenova/multilingual-e5-small"
    );
    expect(extractorMock).toHaveBeenCalledWith(
      "passage: React入門\nWeb,JavaScript",
      {
        pooling: "mean",
        normalize: true,
      }
    );
    expect(embedding).toEqual([1, 2, 3]);
  });
});

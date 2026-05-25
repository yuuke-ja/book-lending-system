import "server-only";
import { pipeline } from "@huggingface/transformers";

type EmbeddingInputType = "query" | "passage";

const extractorPromise = pipeline(
  "feature-extraction",
  "Xenova/multilingual-e5-small"
);

export async function createEmbedding(
  input: string | unknown[],
  type: EmbeddingInputType
): Promise<number[]> {
  const text = Array.isArray(input) ? input.filter(Boolean).join("\n") : input;
  const extractor = await extractorPromise;
  const output = await extractor(`${type}: ${text}`, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data as Float32Array);
}

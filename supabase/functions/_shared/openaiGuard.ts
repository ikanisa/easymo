export type EmbeddingLikeResponse = {
  data?: Array<{ embedding?: number[] | null } | null> | null
}

export type ChatChoiceLikeResponse = {
  choices?: Array<{ message?: { content?: string | null } | null } | null> | null
}

export function requireEmbedding(
  response: EmbeddingLikeResponse | null | undefined,
  context = "OpenAI embeddings"
): number[] {
  const embedding = response?.data?.[0]?.embedding
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(`${context} response missing embedding data`)
  }
  return embedding
}

export function requireFirstChoice(
  response: ChatChoiceLikeResponse | null | undefined,
  context = "OpenAI chat completion"
) {
  const choice = response?.choices?.[0]
  if (!choice) {
    throw new Error(`${context} response missing choices[0]`)
  }
  return choice
}

export function requireFirstMessageContent(
  response: ChatChoiceLikeResponse | null | undefined,
  context = "OpenAI chat completion"
): string {
  const choice = requireFirstChoice(response, context)
  const content = choice?.message?.content
  if (typeof content !== "string" || content.length === 0) {
    throw new Error(`${context} response missing message content`)
  }
  return content
}

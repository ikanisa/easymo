export function requireEmbedding(response, context = "OpenAI embeddings") {
    const embedding = response?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error(`${context} response missing embedding data`);
    }
    return embedding;
}
export function requireFirstChoice(response, context = "OpenAI chat completion") {
    const choice = response?.choices?.[0];
    if (!choice) {
        throw new Error(`${context} response missing choices[0]`);
    }
    return choice;
}
export function requireFirstMessageContent(response, context = "OpenAI chat completion") {
    const choice = requireFirstChoice(response, context);
    const content = choice?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
        throw new Error(`${context} response missing message content`);
    }
    return content;
}

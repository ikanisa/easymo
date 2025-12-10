export type EmbeddingLikeResponse = {
    data?: Array<{
        embedding?: number[] | null;
    } | null> | null;
};
export type ChatChoiceLikeResponse = {
    choices?: Array<{
        message?: {
            content?: string | null;
        } | null;
    } | null> | null;
};
export declare function requireEmbedding(response: EmbeddingLikeResponse | null | undefined, context?: string): number[];
export declare function requireFirstChoice(response: ChatChoiceLikeResponse | null | undefined, context?: string): {
    message?: {
        content?: string | null;
    } | null;
};
export declare function requireFirstMessageContent(response: ChatChoiceLikeResponse | null | undefined, context?: string): string;
//# sourceMappingURL=openaiGuard.d.ts.map
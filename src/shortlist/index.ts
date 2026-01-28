/**
 * Shortlist Module — Public API
 *
 * Re-exports all public functions and types for external consumption.
 */

// Types
export type {
    ShortlistRankConfig,
    ShortlistCandidate,
    ClientConstraints,
    ShortlistPack,
    FormattedVendorEntry,
    FormattedShortlist,
    CloseoutResult,
} from './types';

export { DEFAULT_RANK_CONFIG } from './types';

// Scoring
export { scoreVendorReply, rankCandidates, applyOutOfStockConstraint } from './scoring';

// Pack Builder
export { buildShortlistPack } from './buildShortlistPack';

// WhatsApp Formatter
export {
    formatShortlistForWhatsApp,
    buildWaMeLink,
    isValidWaMePhone,
} from './formatForWhatsApp';

// Closeout
export {
    performCloseout,
    cancelPendingOutreach,
    isRequestHandedOff,
} from './closeout';

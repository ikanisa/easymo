/**
 * Vendor Outreach Module
 * 
 * Barrel export for all vendor outreach components.
 */

// Vendor selection
export {
    selectVendors,
    getAlreadyContactedVendorIds,
    type VendorSelectionParams,
    type SelectedVendor
} from './vendorSelector';

// Outreach scheduling
export {
    scheduleOutreachBatch,
    getOutreachCount,
    type OutreachSchedulerParams,
    type OutreachResult
} from './outreachScheduler';

// Reply parsing
export { parseVendorReply } from './replyParser';

// Stop/expand control
export {
    evaluateStopExpand,
    applyStopExpandDecision,
    getRequestCreatedAt,
    type StopConditions,
    type EvaluationParams
} from './stopExpandController';

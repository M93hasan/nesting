import type { Document } from '../../model';

/** Preserve the existing automatic run budget (59 seconds when unset). */
export const wallClockLimitSeconds=(doc:Document)=>doc.settings.timeLimitSeconds??59;

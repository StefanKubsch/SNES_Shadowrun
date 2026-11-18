// The routine table of the live game: the NMI callbacks, the only entries the live code
// looks up (src/system/nmi-call.mjs). The outer owner, title cycle, attract demo and main
// loop compose their callees directly; the former tables are in proof/.
import { FRONTEND_NMI_ROUTINES } from './main-frontend-nmi.mjs';
export const FRONTEND_ROUTINES = new Map(FRONTEND_NMI_ROUTINES);

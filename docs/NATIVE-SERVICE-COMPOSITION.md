# Native game services

The ordinary script-native boundary passes memory, devices, settings and task
services. Waiting natives use the same service interface as synchronous leaves;
they allocate no CPU context, script accessor or dialog register helpers.
One service object is reused per active nesting depth. A suspended native keeps
its own observation cursor and returns its shared result word exactly once.

GameLoop selects this interface for its direct frame-job intervals. Recorded
interrupt comparisons retain TaskAccessor and dialogAccess, including their
register, return and observation checks. Direct service calls require direct
frame jobs; they never silently enter a recorded interrupt adapter.

Menu list numbers and hotkeys obtain the data bank through dataBankOf. Ordinary
services supply it explicitly; reference callers retain their original bank,
including unusual banks and cross-bank reads. Instant text reads its callback
from the shared memory boundary rather than CPU accessor methods.
The health cheat reads the same state boundary before damage. Sound-effect
calls retain their bank result through the service bank or the recorded register;
the sound commands and save-menu chronology remain unchanged.

Tests compare direct services and compatibility callers across synchronous and
budgeted waits, actual confirmation and window jobs, repeated completion and
observation failures. The golden traces and original caller comparisons remain
binding. Boot/reset and recorded instruction adapters remain separate phase 4
boundaries.

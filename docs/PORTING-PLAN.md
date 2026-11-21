# Historical porting plan

This file remains a stable entry point for the original plan. That plan
predates the general interpreter, browser output and state-model rebuild;
it is not the current backlog or a statement of completion.

Use [STRATEGY.md](STRATEGY.md) for direction and decisions,
[STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md) for active rebuild phases,
[PROJECT-STATUS.json](PROJECT-STATUS.json) for current work and
[WORKFLOW.md](WORKFLOW.md) for verification and delivery. The previous detailed
plan is in Git history; commit 20c7b6c9 contains the original German version
under its former filename, PORTIERUNGSPLAN.md.

The lasting goal is native browser execution of the original game's behavior,
with game-script interpretation but no CPU emulator in the product. Original
comparisons must establish the claimed scope: decoded assets or static script
coverage alone do not prove a complete game, display, audio or playthrough.

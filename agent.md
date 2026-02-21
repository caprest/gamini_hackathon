# Agent Workflow Rules

1. Always create changes on a dedicated feature branch.
2. Always open a Pull Request for every feature/fix; do not push direct changes to `main`.
3. Always track `main` as the integration base.
4. Before creating or updating a PR, sync the feature branch with the latest `origin/main`.
5. Resolve conflicts on the feature branch before requesting review.
6. Never create a PR with known merge conflicts.

## Game Balance Parameter Design

1. Keep gameplay tuning values in a text-editable config file (`game/gameBalance.json`).
2. Adjust values such as `meleeRecoveryMs` in the JSON first; avoid hardcoding balance numbers in scene logic.
3. Treat `types/game.ts` (`DEFAULT_GAME_CONFIG`) as a typed adapter that reads JSON values and applies safe numeric fallbacks.
4. Keep runtime logic (e.g. `game/scenes/GameScene.ts`) focused on behavior and read tuning values only through `DEFAULT_GAME_CONFIG`.
5. When adding a new tunable parameter, add it to `game/gameBalance.json` and `GameConfig` together so it remains discoverable and type-safe.

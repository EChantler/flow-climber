# TODO

## Design

- Rework skipped-platform handling:
  - Stop penalizing players for skipping platforms.
  - Reward players for successful skips instead.
  - Add skipped-platform count/metadata to the 10-second telemetry window.
  - Decide whether rewards should scale with number of platforms skipped, difficulty, or both.
  - Reasoning: skipping platforms can reflect skill, confidence, speed, and risk-taking rather than failure. If the game should support flow and mastery, successful skips should likely be rewarded and measured instead of treated as missed objectives.

## Cleanup and maintenance

- Split `game.js` into smaller modules once the study behavior stabilizes:
  - scene/menu UI
  - player movement and collision
  - platform generation
  - difficulty/model logic
  - telemetry window collection
  - Reasoning: `game.js` currently mixes many responsibilities. Splitting it too early could slow iteration, but once study behavior stabilizes, smaller modules will reduce regression risk and make future changes easier to review.

- Extract challenge-label models into a dedicated module with unit-testable pure functions.
  - Reasoning: Train mode and Flow heuristic mode must share the same heuristic logic. Keeping model code separate and pure will make that sharing explicit and easier to test.

- Extract telemetry window payload construction into a dedicated module or helper to reduce scene complexity.
  - Reasoning: telemetry is study-critical and now spans top-level columns plus JSON metadata. Isolating payload construction will make schema changes safer and easier to test.

- Replace string literals for modes/model names/labels with shared constants.
  - Reasoning: values like `train`, `flow-heuristic`, `flow-ML`, `under_challenged`, and `over_challenged` are study/schema labels. Constants reduce typo risk and keep UI, telemetry, and model logic aligned.

- Review touch and keyboard input handling for duplicated counter logic.
  - Reasoning: both input paths update telemetry counters. Duplication increases the chance that keyboard and touch behavior diverge when one path changes.

- Add more focused behavioral tests around telemetry window counters, especially movement, deaths, new-platform landings, and input press counts.
  - Reasoning: current tests verify schema and ordering, but not all counter semantics. These counters are important for analysis and should be protected from regressions.

- Consider documenting the telemetry schema in a dedicated markdown file after the schema settles.
  - Reasoning: the schema is important for Supabase maintenance and study analysis. Waiting until it stabilizes avoids maintaining stale documentation during rapid iteration.

- Review whether `score`, `deathPenalty`, and skipped-platform logic should be renamed/reworked once skipping becomes a reward.
  - Reasoning: if skipping changes from penalty to reward, current names and score calculations may become misleading. This should be revisited together with the skipped-platform design change.

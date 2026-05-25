# TODO

## Design

- Review whether skipped-platform rewards should eventually scale by difficulty as well as skipped count.
  - Reasoning: skipped platforms are currently rewarded linearly by count. Difficulty-scaled rewards may better reflect risk, but should be evaluated after observing telemetry.

## Cleanup and maintenance

- Continue splitting `game.js` into smaller modules once additional seams are stable:
  - scene/menu UI
  - player movement and collision
  - platform generation
  - input handling
  - Reasoning: challenge-label models and telemetry payload construction are now extracted. Further splitting should happen incrementally to avoid destabilizing gameplay while continuing to reduce scene complexity.

- Add more focused behavioral tests around in-scene telemetry counters, especially movement, deaths, new-platform landings, and input press counts.
  - Reasoning: pure helper tests now cover model and payload behavior, but Phaser scene counter semantics still rely mostly on static tests. These counters are important for analysis and should be protected from regressions.

- Evaluate the promoted LogisticRegression ONNX model against real telemetry and decide whether LogisticRegression, LinearSVC, or GaussianNB should be used for Flow ML.
  - Reasoning: the current promoted ONNX model was generated from synthetic data to validate the pipeline. It should be retrained and selected with real study data before drawing conclusions.

- Review whether `score`, `deathPenalty`, and `skipReward` should be wrapped in a clearer scoring model.
  - Reasoning: scoring now combines flag collection, death penalties, and skipped-platform rewards. A focused scoring helper would make future design tuning easier.

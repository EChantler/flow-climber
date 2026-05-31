# FlowClimb ML Training Notes

## Note-taking process

After each training run, present the metrics, suggest possible learnings, and ask what should be added here before updating these training notes.

## Initial smaller dataset — preprocessing/model update

On the initial smaller processed dataset (`2026-05-30-21-02`, train-mode only), we saw the following after dropping identifier/leakage-prone columns (`session_id`, `token_used`, `metric_value`), one-hot encoding `device_type`, switching the SVM candidate to an RBF kernel with scaled features, adding stronger logistic-regression regularization, and setting Gaussian NB `var_smoothing`:

- `rbf_svc` validation performance improved relative to the previous linear SVM candidate.
- `logistic_regression` validation performance dipped slightly after the preprocessing/model changes.
- `gaussian_nb` remained behind the SVM/logistic-regression candidates.

This is an early signal from a small initial dataset, not a final model-selection conclusion. Re-check these trends as larger exports are added and after final held-out test evaluation.

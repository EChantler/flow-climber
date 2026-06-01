# FlowClimb ML Training Notes

## Note-taking process

After each training run, present the metrics, suggest possible learnings, and ask what should be added here before updating these training notes.

## Initial smaller dataset — preprocessing/model update

On the initial smaller processed dataset (`2026-05-30-21-02`, train-mode only), we saw the following after dropping identifier/leakage-prone columns (`session_id`, `token_used`, `metric_value`), one-hot encoding `device_type`, switching the SVM candidate to an RBF kernel with scaled features, adding stronger logistic-regression regularization, and setting Gaussian NB `var_smoothing`:

- `rbf_svc` validation performance improved relative to the previous linear SVM candidate.
- `logistic_regression` validation performance dipped slightly after the preprocessing/model changes.
- `gaussian_nb` remained behind the SVM/logistic-regression candidates.

This is an early signal from a small initial dataset, not a final model-selection conclusion. Re-check these trends as larger exports are added and after final held-out test evaluation.

## 2026-05-31-18-58 dataset — larger train-mode export

After preprocessing `2026-05-31-18-58` with the current pipeline, the dataset contained 820 complete rows with 573 training rows, 123 validation rows, and 124 held-out test rows. Training still used only the train and validation splits.

Validation metrics:

| Model | Val Accuracy | Val Balanced Acc | Val F1 Macro | Val F1 Weighted | Train Acc |
|---|---:|---:|---:|---:|---:|
| logistic_regression | 0.8537 | 0.8837 | 0.8646 | 0.8522 | 0.8778 |
| rbf_svc | 0.8455 | 0.8615 | 0.8501 | 0.8444 | 0.8796 |
| gaussian_nb | 0.7561 | 0.7777 | 0.7494 | 0.7536 | 0.7714 |

Learnings:

- With the larger dataset, `logistic_regression` edged out `rbf_svc` on validation accuracy, balanced accuracy, macro F1, and weighted F1.
- `rbf_svc` remained competitive, but the larger export weakened the earlier small-dataset signal that RBF SVC was clearly ahead.
- `gaussian_nb` continued to trail both discriminative models.
- The train/validation gap stayed modest for logistic regression and RBF SVC, suggesting no obvious overfit signal from these summary metrics.
- Keep the held-out test split untouched for final model evaluation before promoting a model.

## 2026-06-01-20-38 dataset — larger train-mode export

After preprocessing `2026-06-01-20-38` with the current pipeline, the dataset contained 1,103 complete rows with 773 training rows, 166 validation rows, and 164 held-out test rows. Training still used only the train and validation splits.

Validation metrics:

| Model | Val Accuracy | Val Balanced Acc | Val F1 Macro | Val F1 Weighted | Train Acc |
|---|---:|---:|---:|---:|---:|
| logistic_regression | 0.8434 | 0.8826 | 0.8558 | 0.8425 | 0.8538 |
| rbf_svc | 0.8133 | 0.8411 | 0.8204 | 0.8127 | 0.8706 |
| gaussian_nb | 0.7349 | 0.7471 | 0.7234 | 0.7322 | 0.7426 |

Learnings:

- `logistic_regression` remained the strongest validation performer on the larger dataset.
- `rbf_svc` had higher train accuracy than logistic regression but lower validation metrics, suggesting possible overfitting relative to logistic regression.
- `gaussian_nb` continued to trail both discriminative models.
- Logistic regression's balanced accuracy remained strong despite class imbalance.
- This is the second larger export where logistic regression outperformed RBF SVC on validation metrics, weakening the earlier small-dataset signal in favor of RBF SVC.
- Keep the held-out test split untouched for final model evaluation before promoting a model.

## Deaths/height-only diagnostic

Using only `deaths_delta` and `height_delta` on the `2026-06-01-20-38` train/validation split, `rbf_svc` reached ~99.4% validation accuracy. This confirms the labels are almost entirely explained by the known heuristic inputs. Logistic regression and Gaussian NB were lower because the rule is threshold/interaction based and the `appropriately_challenged` class occupies disconnected regions. A small decision tree or explicit rule baseline should reconstruct the heuristic most directly.

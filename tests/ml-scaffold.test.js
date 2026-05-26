const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
test('ml scaffold defines conda environment with training dependencies', () => {
  const environment = fs.readFileSync('ml/environment.yml', 'utf8')
  for (const dependency of ['python=3.11', 'pandas', 'scikit-learn', 'mlflow', 'onnx', 'onnxruntime', 'skl2onnx']) {
    assert.match(environment, new RegExp(dependency.replace('.', '\\.')))
  }
})

test('ml training script targets the interchangeable model candidates', () => {
  execFileSync('python3', ['-m', 'py_compile', 'ml/scripts/train_models.py'], { stdio: 'pipe' })
  execFileSync('python3', ['-m', 'py_compile', 'ml/scripts/promote_model.py'], { stdio: 'pipe' })
  execFileSync('python3', ['-m', 'py_compile', 'ml/scripts/mlflow_ui.py'], { stdio: 'pipe' })
  const script = fs.readFileSync('ml/scripts/train_models.py', 'utf8')
  assert.match(script, /"logistic_regression": LogisticRegression/)
  assert.match(script, /"linear_svc": LinearSVC/)
  assert.match(script, /"gaussian_nb": GaussianNB/)
  assert.match(script, /manifest\.json/)
  assert.match(script, /feature_columns/)
  assert.match(script, /mlflow\.set_experiment/)

  const promoteScript = fs.readFileSync('ml/scripts/promote_model.py', 'utf8')
  assert.match(promoteScript, /active\.onnx/)
  assert.match(promoteScript, /active\.metadata\.json/)
  assert.match(promoteScript, /active_model/)

  const mlflowUiScript = fs.readFileSync('ml/scripts/mlflow_ui.py', 'utf8')
  assert.match(mlflowUiScript, /Starting MLflow UI at/)
  assert.match(mlflowUiScript, /backend-store-uri/)
})

test('generated ml artifacts and local csv exports are ignored', () => {
  const gitignore = fs.readFileSync('.gitignore', 'utf8')
  for (const pattern of ['ml/data/*.csv', 'ml/models/*.onnx', 'ml/models/*.json', 'ml/mlruns/']) {
    assert.ok(gitignore.includes(pattern), `missing ignore pattern ${pattern}`)
  }
})

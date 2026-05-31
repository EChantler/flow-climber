const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
test('ml scaffold defines conda environment with training dependencies', () => {
  const environment = fs.readFileSync('ml/environment.yml', 'utf8')
  for (const dependency of ['python=3.11', 'pandas', 'scikit-learn', 'matplotlib', 'mlflow', 'onnx', 'onnxruntime', 'skl2onnx']) {
    assert.match(environment, new RegExp(dependency.replace('.', '\\.')))
  }
})

test('ml training script targets the interchangeable model candidates', () => {
  execFileSync('python3', ['-m', 'py_compile', 'ml/scripts/train_models.py'], { stdio: 'pipe' })
  execFileSync('python3', ['-m', 'py_compile', 'ml/scripts/preprocess_telemetry.py'], { stdio: 'pipe' })
  execFileSync('python3', ['-m', 'py_compile', 'ml/scripts/promote_model.py'], { stdio: 'pipe' })
  execFileSync('python3', ['-m', 'py_compile', 'ml/scripts/mlflow_ui.py'], { stdio: 'pipe' })
  const script = fs.readFileSync('ml/scripts/train_models.py', 'utf8')
  assert.match(script, /"logistic_regression": LogisticRegression/)
  assert.match(script, /C=0\.5/)
  assert.match(script, /l1_ratio=0\.0/)
  assert.match(script, /"rbf_svc": SVC/)
  assert.match(script, /kernel="rbf"/)
  assert.match(script, /StandardScaler/)
  assert.match(script, /"gaussian_nb": GaussianNB\(var_smoothing=/)
  assert.match(script, /manifest\.json/)
  assert.match(script, /feature_columns/)
  assert.match(script, /mlflow\.set_experiment/)
  assert.match(script, /balanced_accuracy_score/)
  assert.match(script, /precision_macro/)
  assert.match(script, /f1_weighted/)
  assert.match(script, /confusion_matrix/)
  assert.match(script, /class_distribution/)
  assert.match(script, /save_confusion_matrix_plot/)
  assert.match(script, /validation_metrics\.png/)
  assert.match(script, /model_validation_metric_comparison\.png/)
  assert.match(script, /train_data_path/)
  assert.match(script, /validation_data_path/)
  assert.doesNotMatch(script, /test_data_path/)

  const preprocessScript = fs.readFileSync('ml/scripts/preprocess_telemetry.py', 'utf8')
  assert.match(preprocessScript, /pd\.json_normalize/)
  assert.match(preprocessScript, /failed_jump_counts/)
  assert.match(preprocessScript, /dropna\(axis=0, how="any"\)/)
  assert.match(preprocessScript, /DEFAULT_GAME_MODE = "train"/)
  assert.match(preprocessScript, /DEFAULT_DROPPED_COLUMNS/)
  assert.match(preprocessScript, /DEFAULT_VALIDATION_SHARE/)
  assert.match(preprocessScript, /split_frame/)
  assert.match(preprocessScript, /pd\.get_dummies/)

  const promoteScript = fs.readFileSync('ml/scripts/promote_model.py', 'utf8')
  assert.match(promoteScript, /active\.onnx/)
  assert.match(promoteScript, /active\.metadata\.json/)
  assert.match(promoteScript, /active_model/)

  const mlflowUiScript = fs.readFileSync('ml/scripts/mlflow_ui.py', 'utf8')
  assert.match(mlflowUiScript, /Starting MLflow UI at/)
  assert.match(mlflowUiScript, /backend-store-uri/)
  assert.match(mlflowUiScript, /allowed-hosts/)
  assert.match(mlflowUiScript, /cors-allowed-origins/)
})

test('ml telemetry preprocessor flattens metadata and drops incomplete rows', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowclimb-preprocess-'))
  const inputPath = path.join(tempDir, 'raw.csv')
  const outputPath = path.join(tempDir, 'processed.csv')
  fs.writeFileSync(inputPath, [
    'id,session_id,token_used,metric_value,event_type,created_at,game_version,game_mode,window_started_at,window_ended_at,data_schema_version,deployment_context,challenge_label,device_type,metadata,score',
    '1,s1,t1,0.1,telemetry_window,2026-01-01T00:00:00Z,v0.1.0,train,2026-01-01T00:00:00Z,2026-01-01T00:00:10Z,6,deployed,appropriately_challenged,mobile,"{""a"":1,""b"":""x"",""failed_jump_counts"":{""Space"":2}}",10',
    '2,s2,t2,0.2,telemetry_window,2026-01-01T00:00:10Z,v0.1.0,flow-ML,2026-01-01T00:00:10Z,2026-01-01T00:00:20Z,6,deployed,over_challenged,desktop,"{""a"":2,""b"":""y"",""failed_jump_counts"":{}}",20',
    '3,s3,t3,0.3,telemetry_window,2026-01-01T00:00:20Z,v0.1.0,train,2026-01-01T00:00:20Z,2026-01-01T00:00:30Z,,deployed,under_challenged,mobile,"{""a"":3,""b"":""z""}",30',
  ].join('\n') + '\n')

  execFileSync('python3', [
    'ml/scripts/preprocess_telemetry.py',
    '--input', inputPath,
    '--output', outputPath,
  ], { stdio: 'pipe' })

  const processed = fs.readFileSync(outputPath, 'utf8').trim().split('\n')
  assert.equal(processed.length, 2)
  assert.match(processed[0], /meta_a/)
  assert.match(processed[0], /meta_b/)
  for (const droppedColumn of ['id', 'session_id', 'token_used', 'metric_value', 'event_type', 'created_at', 'game_version', 'game_mode', 'window_started_at', 'window_ended_at', 'data_schema_version', 'deployment_context', 'device_type', 'meta_logged_at', 'meta_window_duration_ms', 'meta_platform_height_avg_px', 'meta_platform_height_max_px', 'meta_platform_height_min_px']) {
    assert.doesNotMatch(processed[0], new RegExp(`(^|,)${droppedColumn}(,|$)`))
  }
  assert.doesNotMatch(processed[0], /failed_jump_counts/)
  assert.match(processed[0], /device_type_mobile/)
  assert.match(processed[1], /^appropriately_challenged,10,1,x,1$/)
  for (const splitName of ['train', 'validation', 'test']) {
    assert.ok(fs.existsSync(outputPath.replace(/\.csv$/, `.${splitName}.csv`)))
  }
})

test('generated ml artifacts and local csv exports are ignored', () => {
  const gitignore = fs.readFileSync('.gitignore', 'utf8')
  for (const pattern of ['ml/data/*.csv', 'ml/models/*.onnx', 'ml/models/*.json', 'ml/models/*.png', 'ml/mlruns/']) {
    assert.ok(gitignore.includes(pattern), `missing ignore pattern ${pattern}`)
  }
})

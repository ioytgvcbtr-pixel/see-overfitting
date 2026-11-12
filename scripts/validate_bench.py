"""Matched-seed validation of real-data teaching experiments."""
import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.bench import BenchParameters, run
from backend.datasets import catalog


def main():
    started = time.perf_counter()
    records = []
    for dataset in catalog():
        for seed in (42, 43, 44):
            for model, depth in [('ridge', 5)] + [(model, depth) for model in ('tree', 'forest') for depth in (2, 5, 12)]:
                params = BenchParameters(dataset=dataset['id'], model=model, depth=depth, seed=seed)
                result = run(params)
                records.append({'dataset': dataset['id'], 'model': model, 'depth': depth, 'seed': seed,
                                'metrics': result['metrics'], 'split': result['split'], 'fingerprint': result['fingerprint']})
    for dataset in catalog():
        for seed in (42, 43, 44):
            fingerprints = {row['fingerprint'] for row in records if row['dataset']==dataset['id'] and row['seed']==seed}
            assert len(fingerprints) == 1
    code_hash = hashlib.sha256(b''.join((ROOT / 'backend' / name).read_bytes() for name in ('bench.py', 'datasets.py'))).hexdigest()
    record = {'started_at_utc': datetime.now(timezone.utc).isoformat(), 'elapsed_seconds': round(time.perf_counter()-started, 3),
              'git_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(), 'compute_code_sha256': code_hash,
              'protocol': 'Grouped holdout; 50% of training pool; matched seeds 42/43/44; training-only preprocessing; validation metrics only.',
              'hypotheses': ['Identical feature groups never cross splits.', 'Depth changes may improve training while validation can worsen.', 'The winning model may depend on the split; inspect all paired runs.'],
              'contribution': 'Existing estimators transferred into an evidence-driven interactive learning protocol; no novel estimator claim.',
              'records': records}
    destination = ROOT / 'experiments' / 'improvement' / 'real-data-v1'
    destination.mkdir(parents=True, exist_ok=True)
    (destination / 'results.json').write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print({'paired_runs': len(records), 'elapsed_seconds': record['elapsed_seconds'], 'test_metrics_used': False})


if __name__ == '__main__':
    main()

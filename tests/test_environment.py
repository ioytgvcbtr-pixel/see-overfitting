import importlib.util
import json
from pathlib import Path

SPEC=importlib.util.spec_from_file_location('environment_check',Path(__file__).resolve().parents[1]/'scripts/check_environment.py')
module=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def test_missing_packages_and_bad_snapshots_produce_fixes_without_crashing(tmp_path,monkeypatch):
    (tmp_path/'requirements.txt').write_text('missing-package==1.0\n',encoding='utf-8')
    (tmp_path/'package.json').write_text(json.dumps({'dependencies':{'next':'1'}}),encoding='utf-8')
    def missing(name):raise module.importlib.metadata.PackageNotFoundError(name)
    monkeypatch.setattr(module.importlib.metadata,'version',missing)
    monkeypatch.setattr(module.shutil,'which',lambda _:None)
    result=module.inspect_environment(tmp_path)
    assert not result['ok']
    failed={row['id']:row for row in result['checks'] if not row['ok']}
    assert {'package-missing-package','node','npm','frontend','datasets'} <= failed.keys()
    assert all(row['fix'] for row in failed.values())
    assert str(tmp_path) not in json.dumps(result)

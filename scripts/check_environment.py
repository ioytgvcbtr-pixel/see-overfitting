"""Offline setup checks with actionable, path-free diagnostics."""
import argparse
import hashlib
import importlib.metadata
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def inspect_environment(root=ROOT):
    checks = []
    def add(key, label, ok, detail, fix=''):
        checks.append({'id':key,'label':label,'ok':bool(ok),'detail':detail,'fix':fix if not ok else ''})
    add('python','Python环境',sys.version_info >= (3,13),'.'.join(map(str,sys.version_info[:3])),
        '使用Python 3.13，并通过FITLAB_PYTHON或启动参数选择解释器。')
    required = {}
    for line in (root/'requirements.txt').read_text(encoding='utf-8').splitlines():
        if '==' in line:
            name, version = line.strip().split('==',1)
            required[name]=version
    for name, wanted in required.items():
        try: actual=importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError: actual='未安装'
        add('package-'+name,name,actual==wanted,actual,'运行 python -m pip install -r requirements.txt 安装项目锁定依赖。')
    node=shutil.which('node')
    version='未安装'
    if node:
        try: version=subprocess.run([node,'--version'],capture_output=True,text=True,timeout=5,check=True).stdout.strip()
        except (OSError,subprocess.SubprocessError): version='无法运行'
    match=re.fullmatch(r'v(\d+)\.(\d+)\.(\d+)',version)
    numbers=tuple(map(int,match.groups())) if match else (0,0,0)
    supported=(numbers[0]==22 and numbers[1]>=18) or numbers[0]>=24 or (numbers[0]==23 and numbers[1]>=6)
    add('node','Node.js',supported,version,'安装Node.js 22.18+或24+，兼顾应用运行与前端验证。')
    npm=bool(shutil.which('npm') or shutil.which('npm.cmd'))
    add('npm','npm',npm,'可用' if npm else '未找到','重新安装包含npm的Node.js。')
    package=json.loads((root/'package.json').read_text(encoding='utf-8'))
    try: actual=json.loads((root/'node_modules'/'next'/'package.json').read_text(encoding='utf-8'))['version']
    except (OSError,ValueError,KeyError): actual='未安装'
    add('frontend','前端依赖',actual==package['dependencies']['next'],actual,'在项目目录运行 npm.cmd ci。')
    failures=[]
    for relative in ('data/public','data/public/classification'):
        folder=root/relative
        try:
            for item in json.loads((folder/'manifest.json').read_text(encoding='utf-8')):
                path=folder/item['file']
                if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=item['csv_sha256']:
                    failures.append(item['file'])
        except (OSError,ValueError,KeyError): failures.append(relative+'/manifest.json')
    add('datasets','公开数据快照',not failures,'5组快照校验通过' if not failures else '、'.join(failures),'从仓库恢复data/public下的原始快照，不需要重新下载数据。')
    return {'ok':all(c['ok'] for c in checks),'checks':checks}

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--json',action='store_true')
    args=parser.parse_args()
    result=inspect_environment()
    if args.json: print(json.dumps(result,ensure_ascii=False))
    else:
        for check in result['checks']:
            print(('通过' if check['ok'] else '待处理')+' · '+check['label']+'：'+check['detail'])
            if check['fix']: print('  '+check['fix'])
        print('环境已就绪。' if result['ok'] else '请处理上述项目后重新检查。')
    raise SystemExit(0 if result['ok'] else 1)

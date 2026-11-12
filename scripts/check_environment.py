import importlib.metadata
import json
import sys

packages = ('fastapi', 'uvicorn', 'numpy', 'scipy', 'scikit-learn', 'pydantic', 'httpx')
versions = {name: importlib.metadata.version(name) for name in packages}
print(json.dumps({'python': sys.executable, 'version': sys.version.split()[0], 'packages': versions}, indent=2))

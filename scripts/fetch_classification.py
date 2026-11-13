"""Freeze two attributed UCI classification snapshots; no runtime downloads."""
import csv
import hashlib
import io
import json
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'data' / 'public' / 'classification'


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for name, number, member in [('iris', 53, 'iris.data'), ('seeds', 236, 'seeds_dataset.txt')]:
        url = f'https://archive.ics.uci.edu/static/public/{number}/{name}.zip'
        raw = urllib.request.urlopen(url, timeout=30).read()
        archive = zipfile.ZipFile(io.BytesIO(raw))
        payload = archive.read(next(path for path in archive.namelist() if path == member or path.endswith('/'+member))).decode('utf-8')
        if name == 'iris':
            mapping = {'Iris-setosa': 0, 'Iris-versicolor': 1, 'Iris-virginica': 2}
            rows = [[*map(float, row[:4]), mapping[row[4]]] for row in csv.reader(io.StringIO(payload)) if len(row) == 5]
            header = ['sepal_length', 'sepal_width', 'petal_length', 'petal_width', 'class']
            citation = 'Fisher, R. (1936). Iris. UCI. DOI:10.24432/C56C76.'
            transformation = 'UCI iris.data variant; four features preserved; labels mapped to 0/1/2; historical errata not applied separately.'
        else:
            rows = [[*map(float, line.split()[:7]), int(line.split()[7])-1] for line in payload.splitlines() if line.strip()]
            header = ['area', 'perimeter', 'compactness', 'length', 'width', 'asymmetry', 'groove_length', 'class']
            citation = 'Charytanowicz, M. et al. (2010). Seeds. UCI. DOI:10.24432/C5H30K.'
            transformation = 'Seven original features preserved; whitespace normalized to CSV; labels 1/2/3 mapped to 0/1/2.'
        buffer = io.StringIO(newline='')
        writer = csv.writer(buffer, lineterminator='\n')
        writer.writerow(header)
        writer.writerows(rows)
        normalized = buffer.getvalue().encode('utf-8')
        (ROOT / f'{name}.csv').write_bytes(normalized)
        manifest.append({'id': name, 'file': f'{name}.csv', 'rows': len(rows), 'features': len(header)-1,
                         'source': f'https://archive.ics.uci.edu/dataset/{number}/{name}', 'download': url,
                         'citation': citation, 'license': 'CC BY 4.0', 'license_url': 'https://creativecommons.org/licenses/by/4.0/',
                         'raw_archive_sha256': hashlib.sha256(raw).hexdigest(), 'csv_sha256': hashlib.sha256(normalized).hexdigest(),
                         'transformation': transformation})
        print({'dataset': name, 'rows': len(rows), 'features': len(header)-1})
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


if __name__ == '__main__':
    main()

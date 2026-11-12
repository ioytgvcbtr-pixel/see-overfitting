"""Fetch attributed UCI datasets and freeze numeric CSV snapshots."""
import csv
import hashlib
import io
import json
import shlex
import urllib.request
import zipfile
from pathlib import Path

import xlrd

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'data' / 'public'
LICENSE = 'https://creativecommons.org/licenses/by/4.0/'


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    definitions = [
        ('wine', 'https://archive.ics.uci.edu/static/public/186/wine%2Bquality.zip', 'winequality-red.csv'),
        ('auto', 'https://archive.ics.uci.edu/static/public/9/auto%2Bmpg.zip', 'auto-mpg.data'),
        ('concrete', 'https://archive.ics.uci.edu/static/public/165/concrete%2Bcompressive%2Bstrength.zip', 'Concrete_Data.xls'),
    ]
    manifest = []
    for dataset_id, url, filename in definitions:
        raw = urllib.request.urlopen(url, timeout=30).read()
        archive = zipfile.ZipFile(io.BytesIO(raw))
        member = next(name for name in archive.namelist() if name.endswith(filename))
        payload = archive.read(member)
        omitted = 0
        if dataset_id == 'wine':
            records = list(csv.reader(io.StringIO(payload.decode('utf-8-sig')), delimiter=';'))
            header, rows = records[0], records[1:]
            citation = 'Cortez, P. et al. (2009). Wine Quality. UCI. DOI:10.24432/C56S3T.'
            source = 'https://archive.ics.uci.edu/dataset/186/wine+quality'
        elif dataset_id == 'auto':
            header = ['cylinders', 'displacement', 'horsepower', 'weight', 'acceleration', 'model_year', 'origin', 'mpg']
            rows = []
            for line in payload.decode().splitlines():
                values = shlex.split(line)
                if '?' in values[:8]:
                    omitted += 1
                    continue
                rows.append(values[1:8] + [values[0]])
            citation = 'Quinlan, R. (1993). Auto MPG. UCI. DOI:10.24432/C5859H.'
            source = 'https://archive.ics.uci.edu/dataset/9/auto+mpg'
        else:
            sheet = xlrd.open_workbook(file_contents=payload).sheet_by_index(0)
            header = ['cement', 'slag', 'fly_ash', 'water', 'superplasticizer', 'coarse_aggregate', 'fine_aggregate', 'age', 'strength']
            rows = [sheet.row_values(index) for index in range(1, sheet.nrows)]
            citation = 'Yeh, I. (1998). Concrete Compressive Strength. UCI. DOI:10.24432/C5PK67.'
            source = 'https://archive.ics.uci.edu/dataset/165/concrete+compressive+strength'
        buffer = io.StringIO(newline='')
        writer = csv.writer(buffer, lineterminator='\n'); writer.writerow(header); writer.writerows(rows)
        normalized = buffer.getvalue().encode('utf-8')
        (DESTINATION / f'{dataset_id}.csv').write_bytes(normalized)
        manifest.append({'id': dataset_id, 'file': f'{dataset_id}.csv', 'rows': len(rows), 'features': len(header)-1,
                         'removed_missing_rows': omitted, 'source': source, 'download': url, 'citation': citation,
                         'license': 'CC BY 4.0', 'license_url': LICENSE,
                         'raw_archive_sha256': hashlib.sha256(raw).hexdigest(), 'csv_sha256': hashlib.sha256(normalized).hexdigest(),
                         'transformation': 'Numeric CSV; target last; identifiers excluded; Auto MPG rows with missing horsepower omitted.'})
        print({'dataset': dataset_id, 'rows': len(rows), 'features': len(header)-1, 'missing_removed': omitted})
    (DESTINATION / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()

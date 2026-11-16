"""Freeze the additional classroom sources; never overwrite legacy snapshots."""
import csv,hashlib,io,json,shlex,urllib.request,zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'data'/'planet'


def request(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'ModelPlanet-classroom/1.0'}),timeout=60).read()


def xlsx(raw):
    z=zipfile.ZipFile(io.BytesIO(raw));ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    strings=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        strings=[''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)]
    rows=[]
    for r in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//m:sheetData/m:row',ns):
        values=[]
        for c in r.findall('m:c',ns):
            value=c.find('m:v',ns)
            v=value.text if value is not None else ''
            values.append(strings[int(v)] if c.attrib.get('t')=='s' and v else v)
        if values:rows.append(values)
    return rows


def main():
    DEST.mkdir(parents=True,exist_ok=True);manifest=[]
    def save(key,raw,url,headers,rows,source,kind='实测/实验采集',license='CC BY 4.0'):
        output=io.StringIO(newline='');w=csv.writer(output,lineterminator='\n');w.writerow(headers);w.writerows(rows)
        data=output.getvalue().encode();(DEST/f'{key}.csv').write_bytes(data)
        manifest.append(dict(id=key,file=f'{key}.csv',rows=len(rows),columns=headers,source=source,download=url,kind=kind,license=license,
            raw_sha256=hashlib.sha256(raw).hexdigest(),csv_sha256=hashlib.sha256(data).hexdigest()))
        print({'id':key,'rows':len(rows),'columns':len(headers)})
    u='https://raw.githubusercontent.com/allisonhorst/palmerpenguins/main/inst/extdata/penguins.csv'
    raw=request(u);r=list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))))
    save('penguins',raw,u,r[0],r[1:],'https://allisonhorst.github.io/palmerpenguins/',license='CC0')
    definitions=[('banknote',267,'banknote+authentication'),('energy',242,'energy+efficiency'),('bike',275,'bike+sharing+dataset'),('auto_raw',9,'auto+mpg')]
    for key,ident,slug in definitions:
        u=f'https://archive.ics.uci.edu/static/public/{ident}/{slug.replace("+","%2B")}.zip';raw=request(u);z=zipfile.ZipFile(io.BytesIO(raw))
        if key=='banknote':
            member=next(n for n in z.namelist() if n.endswith('data_banknote_authentication.txt'))
            rows=list(csv.reader(io.StringIO(z.read(member).decode())));headers=['variance','skewness','curtosis','entropy','class']
        elif key=='energy':
            member=next(n for n in z.namelist() if n.endswith('.xlsx'));r=xlsx(z.read(member));headers=['compactness','surface','wall','roof','height','orientation','glazing','glazing_distribution','heating','cooling']
            rows=[v[:10] for v in r[1:] if len(v)>=10 and all(v[:10])]
        elif key=='bike':
            member=next(n for n in z.namelist() if n.endswith('day.csv'));r=list(csv.reader(io.StringIO(z.read(member).decode())));headers=r[0];rows=r[1:]
        else:
            member=next(n for n in z.namelist() if n.endswith('auto-mpg.data'));rows=[]
            for line in z.read(member).decode().splitlines():
                v=shlex.split(line);rows.append(v[1:8]+[v[0]])
            headers=['cylinders','displacement','horsepower','weight','acceleration','model_year','origin','mpg']
        save(key,raw,u,headers,rows,f'https://archive.ics.uci.edu/dataset/{ident}/{slug}',kind='公开物理仿真' if key=='energy' else '实测/实验采集')
    (DEST/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':main()

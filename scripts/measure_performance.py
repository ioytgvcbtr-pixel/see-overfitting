"""Measure HTTP timings without credentials or machine-specific identifiers."""
import argparse
import json
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path
import httpx


def measure(origin, repeats=12):
    groups=[]
    with httpx.Client(base_url=origin,timeout=90,trust_env=False) as client:
        for name,method,path,body in [
            ('health','GET','/health',None),
            ('garden','POST','/concepts/run',{'panel':'regularization','seed':2718,'samples':12,'noise':.22,'degree':12,'alpha':.1}),
            ('forest','POST','/classification/run',{'dataset':'xor','seed':44,'model':'svm'})]:
            values=[]
            for _ in range(repeats+1):
                start=time.perf_counter()
                r=client.request(method,path,json=body)
                r.raise_for_status()
                values.append(round((time.perf_counter()-start)*1000,3))
            warm=sorted(values[1:])
            groups.append({'case':name,'first_request_ms':values[0],'warm_samples_ms':values[1:],
                'warm_p50_ms':statistics.median(warm),'warm_p95_ms':warm[min(len(warm)-1,int(.95*len(warm)))]})
    return {'measured_at':datetime.now(timezone.utc).isoformat(),'unit':'ms','scope':'Loopback HTTP, single client, repeated identical requests; first request is not a guaranteed process-cold computation. AI not timed.',
            'measurements':groups}


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--origin',default='http://127.0.0.1:8002')
    p.add_argument('--output',default='artifacts/local/performance-v15.json')
    args=p.parse_args()
    result=measure(args.origin)
    path=Path(args.output);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False))

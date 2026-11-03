"""Smoke-test OMR classification using synthetic bubble intensity samples only."""
import json
from pathlib import Path
cases = [
    ('clear', [0.82, 0.05, 0.04, 0.06], [0.9, 0.08, 0.07, 0.08]),
    ('multiple', [0.71, 0.67, 0.05, 0.04], [0.8, 0.76, 0.06, 0.05]),
    ('blank', [0.04, 0.03, 0.05, 0.02], [0.06, 0.04, 0.06, 0.04]),
    ('uncertain', [0.40, 0.12, 0.07, 0.04], [0.46, 0.18, 0.09, 0.07]),
]
def classify(dark, faint):
    ranked = sorted(enumerate(dark), key=lambda p: p[1], reverse=True)
    (top_i, top), (_, runner) = ranked[:2]
    strong = sum(v >= 0.52 for v in dark)
    secondary_faint = max(v for i,v in enumerate(faint) if i != top_i)
    if strong > 1 or runner >= 0.30: return 'multiple'
    if top < 0.20 and max(faint) < 0.32: return 'blank'
    if top >= 0.52 and top-runner >= 0.22 and runner < 0.18 and secondary_faint < 0.28: return 'clear'
    return 'uncertain'
results=[{'expected':label,'actual':classify(d,f)} for label,d,f in cases]
Path('reports').mkdir(exist_ok=True)
Path('reports/nafs-omr-sample-check.json').write_text(json.dumps({'synthetic_only':True,'real_pages_processed':0,'grades_changed':0,'results':results},indent=2))
assert all(x['expected']==x['actual'] for x in results)
print('Synthetic OMR classification smoke test passed; no student records touched.')

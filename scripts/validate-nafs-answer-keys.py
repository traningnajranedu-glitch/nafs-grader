import json
from pathlib import Path
p=Path("data/nafs-answer-keys-2026.json")
data=json.loads(p.read_text(encoding="utf-8"))
assert data["approval_policy"]=="reference_only_no_auto_approval"
assert set(data["stages"])=={"primary3","middle3","primary6"}
valid={"أ","ب","ج","د"}
counts={}
for stage,entry in data["stages"].items():
    assert len(entry["sha256"])==64
    assert set(entry["subjects"])=={"لغتي","رياضيات","علوم"}
    counts[stage]={}
    for subject,answers in entry["subjects"].items():
        assert len(answers)==10
        assert all(answer in valid or answer is None for answer in answers)
        counts[stage][subject]=sum(answer is not None for answer in answers)
assert counts["primary3"]["علوم"]==0, "Never infer missing primary-3 science key"
assert sum(sum(s.values()) for s in counts.values())==80
print(json.dumps({"status":"valid","answer_counts":counts,"student_rows_changed":0,"approved":0},ensure_ascii=False))

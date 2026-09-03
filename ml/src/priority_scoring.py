"""
AEDIRS v2 — Priority & Severity scoring.

Design decision (documented in the master plan, Sec 4.3): no clean public dataset
exists for "priority level" as a label, so training a supervised model on a proxy
label would be building confidence on noise. Instead we build a transparent,
rule-blended score from three real signals we DO have:

  1. classification_confidence — how sure the Sprint-2 model is that this is a
     genuine disaster report (model.predict_proba)
  2. severity_keywords          — curated lexicon of high-urgency terms
     (weighted, not just counted — "dead"/"trapped" outweigh "damage"/"delay")
  3. structural signals          — exclamation marks, ALL-CAPS words (shouting/urgency)

This mirrors exactly what the original AEDIRS slide called "rule-based, auditable"
severity logic — every score can be traced back to which words/signals fired,
which is what you want in a system authorities have to trust.

Output: priority in {"Critical", "High", "Medium", "Low"} + a severity_score in [0,100]
so both a coarse bucket (for sorting the dashboard) and a fine-grained number
(for tie-breaking) are available.
"""
import re
from dataclasses import dataclass

# Weighted severity lexicon — weight reflects how life-threatening/urgent the term is.
# Curated from HumAID's own category names (Injured/Dead, Rescue, Displaced, Infrastructure)
# so this lexicon is consistent with the real taxonomy we'll train the multiclass model on.
SEVERITY_LEXICON = {
    # Critical (weight 10) — life-threatening, immediate response
    "dead": 10, "died": 10, "killed": 10, "trapped": 10, "dying": 10,
    "collapsed": 9, "drowning": 10, "unconscious": 9, "critical": 9,
    # High (weight 6-8) — urgent, likely injuries or major damage
    "injured": 8, "injuries": 8, "bleeding": 8, "fire": 7, "explosion": 8,
    "flooding": 7, "flood": 6, "earthquake": 7, "rescue": 7, "stranded": 7,
    "evacuate": 6, "evacuation": 6, "emergency": 7, "missing": 7,
    # Medium (weight 3-5) — significant but not immediately life-threatening
    "damage": 4, "damaged": 4, "power": 3, "outage": 3, "blocked": 3,
    "shelter": 4, "displaced": 5, "warning": 4, "storm": 4,
    # Low (weight 1-2) — informational / minor
    "delay": 2, "inconvenience": 1, "closed": 2, "advisory": 2,
}

CAPS_WORD_RE = re.compile(r"\b[A-Z]{3,}\b")


@dataclass
class PriorityResult:
    severity_score: float       # 0-100
    priority: str                # Critical / High / Medium / Low
    matched_terms: list           # which lexicon words fired (for auditability)


def score_severity(raw_text: str, classification_confidence: float) -> PriorityResult:
    """
    raw_text: the ORIGINAL (uncleaned) report text — we deliberately score on raw text
               because ALL-CAPS and '!' signals get destroyed by the cleaning pipeline
               used for TF-IDF, but they carry real urgency information here.
    classification_confidence: P(this is a real disaster report) from the classifier, 0-1.
    """
    text_lower = raw_text.lower()
    words = re.findall(r"[a-zA-Z']+", text_lower)

    matched = [w for w in words if w in SEVERITY_LEXICON]
    lexicon_score = sum(SEVERITY_LEXICON[w] for w in matched)
    # Cap and normalize: 3+ severe words already means "as severe as it gets" —
    # we don't want a report with 10 keyword hits to blow the scale relative to one with 3.
    lexicon_score_norm = min(lexicon_score, 30) / 30 * 60   # lexicon contributes up to 60 points

    caps_words = len(CAPS_WORD_RE.findall(raw_text))
    exclaim_count = raw_text.count("!")
    urgency_boost = min(caps_words * 3 + exclaim_count * 2, 10)  # up to 10 points

    confidence_component = classification_confidence * 30        # up to 30 points

    severity_score = round(lexicon_score_norm + urgency_boost + confidence_component, 1)
    severity_score = min(severity_score, 100.0)

    if severity_score >= 75:
        priority = "Critical"
    elif severity_score >= 50:
        priority = "High"
    elif severity_score >= 25:
        priority = "Medium"
    else:
        priority = "Low"

    return PriorityResult(severity_score=severity_score, priority=priority, matched_terms=matched)


if __name__ == "__main__":
    # Quick sanity-check demo against a few realistic report texts.
    samples = [
        ("People trapped under collapsed building, need rescue NOW!!!", 0.95),
        ("Minor power outage reported in the area, expected to be fixed soon.", 0.6),
        ("Just saw a nice sunset, love this weather", 0.05),
        ("URGENT: flooding rising fast, several families stranded on rooftops", 0.9),
    ]
    for text, conf in samples:
        result = score_severity(text, conf)
        print(f"TEXT: {text}")
        print(f"  -> severity={result.severity_score}  priority={result.priority}  matched={result.matched_terms}\n")

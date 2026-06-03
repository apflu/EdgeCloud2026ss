"""LLM enrichment for engine-derived alerts.

The rule/state engine has ALREADY decided each alert and its severity. This
module's only job is narration: turn an alert's machine-readable reasons and
triggers into human-friendly text and a calm spoken line for the assistance
robot. It must never re-score, second-guess, or invent clinical facts — that
keeps a non-deterministic model strictly out of the safety-critical decision.

If the LLM call fails or returns unparseable output, enrich_alert() degrades
gracefully to a deterministic fallback built from the alert's own reasons, so
the pipeline never blocks on the model.
"""

from __future__ import annotations

import json

from config import LLM_DEFAULT_MODEL
from llm_client import ask_llm
from logger import log

SYSTEM_GUIDANCE = (
    "You are a clinical-operations assistant for a hospital patient-monitoring "
    "dashboard. An automated rule engine has ALREADY decided the alert below and "
    "its severity. Do NOT change, question, or re-score the severity. Do NOT "
    "invent vital signs, diagnoses, or facts beyond the data given. Your only job "
    "is to explain the alert clearly to a human operator and suggest one safe, "
    "non-diagnostic next step, plus a short calm line the assistance robot can say "
    "to the patient."
)


def build_prompt(alert: dict) -> str:
    return (
        f"{SYSTEM_GUIDANCE}\n\n"
        f"Alert (JSON):\n{json.dumps(alert, ensure_ascii=False, indent=2)}\n\n"
        "Reply with ONLY a JSON object (no markdown, no code fences) with exactly "
        "these string keys:\n"
        '{\n'
        '  "summary": "1-2 sentences: what is happening and why it triggered",\n'
        '  "recommendedAction": "one short, concrete, non-diagnostic next step for staff",\n'
        '  "robotSpeech": "a short, calm spoken line addressed to the patient"\n'
        '}'
    )


def _strip_fences(text: str) -> str:
    """Tolerate models that wrap JSON in ```json ... ``` fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[1] if cleaned.count("```") >= 2 else cleaned.strip("`")
        if cleaned.lstrip().startswith("json"):
            cleaned = cleaned.lstrip()[4:]
    return cleaned.strip()


def _fallback(alert: dict) -> dict:
    """Deterministic narration when the LLM is unavailable or unparseable."""
    reasons = alert.get("reasons", [])
    summary = " ".join(reasons) if reasons else f"{alert.get('severity', 'Alert')} risk detected."
    return {
        "summary": summary,
        "recommendedAction": "Check on the patient and confirm their status.",
        "robotSpeech": "Hello, I am checking on you. Are you alright?",
    }


def enrich_alert(alert: dict) -> dict:
    """Return {summary, recommendedAction, robotSpeech, model} for one alert."""
    raw = ask_llm(build_prompt(alert))

    enriched: dict
    if raw.startswith("LLM error:"):
        log.warning("Enrichment fell back to deterministic text: {}", raw)
        enriched = _fallback(alert)
    else:
        try:
            parsed = json.loads(_strip_fences(raw))
            enriched = {
                "summary": str(parsed.get("summary", "")).strip() or _fallback(alert)["summary"],
                "recommendedAction": str(parsed.get("recommendedAction", "")).strip()
                or _fallback(alert)["recommendedAction"],
                "robotSpeech": str(parsed.get("robotSpeech", "")).strip()
                or _fallback(alert)["robotSpeech"],
            }
        except (json.JSONDecodeError, TypeError):
            log.warning("LLM returned non-JSON enrichment; using fallback. Raw: {}", raw[:200])
            enriched = _fallback(alert)

    enriched["model"] = LLM_DEFAULT_MODEL
    return enriched

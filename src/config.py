"""Chemins et configuration communs à tous les modules."""
from pathlib import Path
import subprocess

import yaml

ROOT = Path(__file__).resolve().parents[1]
CFG = yaml.safe_load(open(ROOT / "config.yaml"))
SEED = CFG["seed"]
RUNS = ROOT / "runs"
MODELS = RUNS / "models"
FIG = ROOT / "figures"

FEATURES = [c for groupe in ["news", "price", "macro", "fx"] for c in CFG["features"][groupe]]
REGIME = CFG["features"]["regime"]
COLONNES = FEATURES + [c for c in REGIME if c not in FEATURES]
CIBLES = {"nikkei": "y_baisse", "couverture": "y_non_couvert"}


def commit_courant() -> str:
    """Hash court du commit Git en cours (pour le journal des essais)."""
    sortie = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True)
    return sortie.stdout.strip() or "inconnu"

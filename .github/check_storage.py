"""Affected Storage source regression set; owner invokes through build FIFO."""
from pathlib import Path
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
NODE = os.environ.get("NODE_BINARY", "node")
commands = [
    [NODE, "--check", "ha-storage-monitor.js"],
    [NODE, "--check", "custom_components/ha_storage_monitor/www/storage-panel.js"],
    [NODE, "--test", "--test-concurrency=1", *[str(p.relative_to(ROOT)) for p in sorted((ROOT/"tests").glob("*.test.cjs"))]],
    [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_storage_*.py"],
    [NODE, "tests/test_review_rendering.js"],
    [sys.executable, "tests/test_review_requirements.py"],
    [sys.executable, "tests/test_persistence_isolation.py"],
    [NODE, ".github/smoke.cjs"],
]
failures = []
for command in commands:
    print("CHECK " + " ".join(command[:3]), flush=True)
    result = subprocess.run(command, cwd=ROOT, check=False)
    if result.returncode:
        failures.append({"command": command[:3], "exit_code": result.returncode})
print("FAILED_CHECKS", failures, flush=True)
sys.exit(bool(failures))

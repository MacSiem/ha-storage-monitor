"""Keep the standalone HACS card and integration-served card byte-identical."""
from pathlib import Path
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    source = ROOT / "ha-storage-monitor.js"
    target = ROOT / "custom_components/ha_storage_monitor/www/ha-storage-monitor.js"
    version = json.loads((target.parent.parent / "manifest.json").read_text())["version"]
    data = source.read_bytes()
    text = data.decode("utf-8")
    if f"ha-storage-monitor v{version} " not in text or f"%c v{version} " not in text:
        raise SystemExit("Frontend version does not match the integration manifest")
    if args.check:
        if not target.is_file() or target.read_bytes() != data:
            raise SystemExit("Integration frontend is missing or stale; run python3 .github/sync_frontend.py")
    else:
        target.write_bytes(data)
    print(f"Storage frontend {version}: {len(data)} bytes, parity OK")


if __name__ == "__main__":
    main()

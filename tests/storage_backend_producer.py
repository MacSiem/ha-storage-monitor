"""Synthetic DTOs from the actual Python runtime for the JS consumer bridge."""
import asyncio
import importlib
from pathlib import Path
import sys
import time
import types
import json

package = types.ModuleType("storage_bridge_backend")
package.__path__ = [str(Path(__file__).resolve().parents[1] / "custom_components/ha_storage_monitor")]
package.__spec__ = importlib.machinery.ModuleSpec(package.__name__, loader=None, is_package=True)
package.__spec__.submodule_search_locations = package.__path__
sys.modules[package.__name__] = package
StorageRuntime = importlib.import_module(f"{package.__name__}.runtime").StorageRuntime


async def main():
    end = int(time.time())-1
    current = end-86400
    index = 0
    async def sampler(binding):
        used = 40_000_000_000 + index * 125_000_000
        return {"timestamp": current, "identity": "bridge-mount", "used_bytes": used,
                "total_bytes": 100_000_000_000, "free_bytes": 98_000_000_000-used,
                "reserved_bytes": 2_000_000_000}
    async def save(payload):
        pass
    engine = StorageRuntime([{"source_uuid": "bridge-disk", "binding_revision": "1",
                              "mountpoint": "/qa", "label": "QA synthetic filesystem"}],
                            sampler, save, clock=lambda: current)
    await engine.start(None, file_exists=False)
    for index in range(49):
        current = end-86400+index*1800
        await engine.refresh()
    status = engine.status()
    status["entry_id"] = "bridge-entry"
    history = engine.history("bridge-disk", "1", 30)
    history.update(entry_id="bridge-entry", binding_revision="1", page_offset=0,
                   total_rows=len(history["rows"]), next_offset=None)
    assert abs(status["sources"][0]["forecast"]["full_in_days"]-52/6) < 1e-9
    print(json.dumps({"status": status, "history": history}))
    await engine.stop()


asyncio.run(main())

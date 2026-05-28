#!/usr/bin/env python3
"""
Launch the exact Lovable-built Gentle Dose UI as a desktop-style app window.

Instead of rebuilding the React screen in Tkinter, this script serves the
already-built `dist/` folder and opens it in Edge/Chrome app mode so the UI is
the real one from Lovable without visual drift.
"""

from __future__ import annotations

import asyncio
import argparse
import contextlib
import json
import re
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

try:
    from winrt.windows.devices.bluetooth import (
        BluetoothConnectionStatus,
        BluetoothDevice,
        BluetoothLEDevice,
    )
except Exception:
    BluetoothConnectionStatus = None
    BluetoothDevice = None
    BluetoothLEDevice = None


PROJECT_DIR = Path(__file__).resolve().parent
DIST_DIR = PROJECT_DIR / "dist"
NATIVE_BLUETOOTH_CACHE_SECONDS = 0.5
NATIVE_BLUETOOTH_SERVER_PORT = 8765
BLUETOOTH_ADDRESS_PATTERNS = (
    re.compile(r"BLUETOOTHDEVICE_([0-9A-F]{12})", re.IGNORECASE),
    re.compile(r"DEV_([0-9A-F]{12})", re.IGNORECASE),
    re.compile(r"&0&([0-9A-F]{12})_C", re.IGNORECASE),
)
IGNORED_BLUETOOTH_NAMES = (
    "MICROSOFT BLUETOOTH",
    "REALTEK BLUETOOTH ADAPTER",
    "GENERIC ACCESS PROFILE",
    "GENERIC ATTRIBUTE SERVICE",
    "BLUETOOTH DEVICE (RFCOMM PROTOCOL TDI)",
    "HEADSET AUDIO GATEWAY SERVICE",
    "PERSONAL AREA NETWORK",
    "OBJECT PUSH SERVICE",
    "PHONEBOOK ACCESS",
    "SIM ACCESS SERVICE",
    "TRANSPORT",
    "ENUMERATOR",
    "PROFILE",
    "SERVICE",
    "ADAPTER",
)
BROWSER_CANDIDATES = (
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
)
WINDOW_PRESETS = {
    "desktop": {
        "label": "Desktop",
        "size": (1320, 900),
        "position": (40, 40),
    },
    "mobile-portrait": {
        "label": "Mobile Portrait",
        "size": (430, 860),
        "position": (140, 90),
    },
    "mobile-landscape": {
        "label": "Mobile Landscape",
        "size": (620, 430),
        "position": (220, 140),
    },
}


def current_timestamp() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def build_bridge_snapshot(
    *,
    supported: bool,
    devices: list[dict[str, object]] | None = None,
    error: str | None = None,
) -> dict[str, object]:
    snapshot: dict[str, object] = {
        "supported": supported,
        "devices": devices or [],
        "updatedAt": current_timestamp(),
    }
    if error:
        snapshot["error"] = error
    return snapshot


def extract_bluetooth_address(instance_id: str) -> str | None:
    for pattern in BLUETOOTH_ADDRESS_PATTERNS:
        match = pattern.search(instance_id)
        if match:
            return match.group(1).upper()
    return None


def is_user_bluetooth_device(name: str) -> bool:
    normalized = name.strip().upper()
    if not normalized:
        return False
    return not any(fragment in normalized for fragment in IGNORED_BLUETOOTH_NAMES)


def load_bluetooth_inventory() -> list[dict[str, str]]:
    command = (
        "Get-PnpDevice -Class Bluetooth | "
        "Select-Object FriendlyName, InstanceId, Status | "
        "ConvertTo-Json -Compress"
    )
    result = subprocess.run(
        ["powershell", "-NoProfile", "-Command", command],
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return []

    payload = json.loads(result.stdout)
    rows = [payload] if isinstance(payload, dict) else payload

    devices_by_address: dict[str, dict[str, str]] = {}
    for row in rows:
        name = (row.get("FriendlyName") or "").strip()
        instance_id = (row.get("InstanceId") or "").strip()
        if not name or not instance_id or not is_user_bluetooth_device(name):
            continue

        address = extract_bluetooth_address(instance_id)
        if not address:
            continue

        existing = devices_by_address.get(address)
        if existing is None or len(name) < len(existing["name"]):
            devices_by_address[address] = {"name": name, "address": address}

    return list(devices_by_address.values())


async def query_native_bluetooth_state_async() -> dict[str, object]:
    if not BluetoothConnectionStatus or not BluetoothDevice or not BluetoothLEDevice:
        return build_bridge_snapshot(
            supported=False,
            error="Python WinRT Bluetooth support is not available.",
        )

    devices: list[dict[str, object]] = []
    for candidate in load_bluetooth_inventory():
        address_hex = candidate["address"]
        address_int = int(address_hex, 16)
        name = candidate["name"]
        connected = False
        source = "unknown"

        try:
            classic_device = await BluetoothDevice.from_bluetooth_address_async(address_int)
        except Exception:
            classic_device = None

        if classic_device is not None:
            name = classic_device.name or name
            if classic_device.connection_status == BluetoothConnectionStatus.CONNECTED:
                connected = True
                source = "bluetooth-classic"

        try:
            ble_device = await BluetoothLEDevice.from_bluetooth_address_async(address_int)
        except Exception:
            ble_device = None

        if ble_device is not None:
            name = ble_device.name or name
            if ble_device.connection_status == BluetoothConnectionStatus.CONNECTED:
                connected = True
                source = "bluetooth-le"

        devices.append(
            {
                "name": name,
                "address": address_hex,
                "connected": connected,
                "source": source,
            }
        )

    return build_bridge_snapshot(supported=True, devices=devices)


class NativeBluetoothBridge:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cached_snapshot: dict[str, object] | None = None
        self._cached_at = 0.0

    def get_snapshot(self) -> dict[str, object]:
        now = time.time()
        with self._lock:
            if self._cached_snapshot and (now - self._cached_at) < NATIVE_BLUETOOTH_CACHE_SECONDS:
                return self._cached_snapshot

        try:
            snapshot = asyncio.run(query_native_bluetooth_state_async())
        except Exception as exc:
            snapshot = build_bridge_snapshot(supported=False, error=str(exc))

        with self._lock:
            self._cached_snapshot = snapshot
            self._cached_at = time.time()

        return snapshot


class QuietStaticHandler(SimpleHTTPRequestHandler):
    """Serve built assets without noisy terminal logs."""

    def log_message(self, _format: str, *_args) -> None:
        return

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/native-bluetooth/status":
            self.serve_native_bluetooth_status()
            return
        super().do_GET()

    def serve_native_bluetooth_status(self) -> None:
        bridge = getattr(self.server, "native_bluetooth_bridge", None)
        payload = bridge.get_snapshot() if bridge else {"supported": False, "devices": []}
        encoded = json.dumps(payload).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.end_headers()
        self.wfile.write(encoded)


def find_free_port() -> int:
    with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.bind(("127.0.0.1", 0))
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return int(sock.getsockname()[1])


def find_browser() -> Path | None:
    for browser_path in BROWSER_CANDIDATES:
        if browser_path.exists():
            return browser_path
    return None


def start_static_server() -> tuple[ThreadingHTTPServer, str]:
    port = NATIVE_BLUETOOTH_SERVER_PORT
    handler = partial(QuietStaticHandler, directory=str(DIST_DIR))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    except OSError:
        port = find_free_port()
        server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    server.daemon_threads = True
    server.native_bluetooth_bridge = NativeBluetoothBridge()

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    return server, f"http://127.0.0.1:{port}/"


def build_browser_args(url: str, mode: str) -> list[str]:
    preset = WINDOW_PRESETS[mode]
    width, height = preset["size"]
    pos_x, pos_y = preset["position"]
    return [
        f"--app={url}",
        "--new-window",
        f"--window-size={width},{height}",
        f"--window-position={pos_x},{pos_y}",
    ]


def open_exact_ui(url: str, mode: str) -> None:
    browser_path = find_browser()
    if browser_path is None:
        webbrowser.open(url)
        return

    subprocess.Popen(
        [str(browser_path), *build_browser_args(url, mode)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def ensure_build_exists() -> None:
    if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
        return

    raise SystemExit(
        "Built UI not found.\n"
        "Run `npm.cmd run build` inside the React project first so this launcher\n"
        "can open the exact Lovable UI from `dist/`."
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Launch the exact Gentle Dose Lovable UI in a desktop/mobile app window."
    )
    parser.add_argument(
        "--mode",
        choices=("desktop", "mobile-portrait", "mobile-landscape"),
        default="desktop",
        help="Which window preset to open. Default: desktop",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    ensure_build_exists()
    server, url = start_static_server()
    preset = WINDOW_PRESETS[args.mode]

    print("Serving exact Lovable UI")
    print(f"Project: {PROJECT_DIR}")
    print(f"Dist:    {DIST_DIR}")
    print(f"URL:     {url}")
    width, height = preset["size"]
    print(f"Opening {preset['label']} window: {width}x{height}")

    open_exact_ui(url, args.mode)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping local server...")
    finally:
        server.shutdown()
        server.server_close()

    return 0


if __name__ == "__main__":
    sys.exit(main())

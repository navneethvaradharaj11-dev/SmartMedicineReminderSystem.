#!/usr/bin/env python3
"""
Launch the exact Lovable-built Gentle Dose UI as a desktop-style app window.

Instead of rebuilding the React screen in Tkinter, this script serves the
already-built `dist/` folder and opens it in Edge/Chrome app mode so the UI is
the real one from Lovable without visual drift.
"""

from __future__ import annotations

import argparse
import contextlib
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
DIST_DIR = PROJECT_DIR / "dist"
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


class QuietStaticHandler(SimpleHTTPRequestHandler):
    """Serve built assets without noisy terminal logs."""

    def log_message(self, _format: str, *_args) -> None:
        return


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
    port = 8765
    handler = partial(QuietStaticHandler, directory=str(DIST_DIR))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    except OSError:
        port = find_free_port()
        server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    server.daemon_threads = True

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

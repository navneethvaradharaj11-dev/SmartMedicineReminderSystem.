#!/usr/bin/env python3
"""
Smart Pill Box BLE desktop app using Tkinter + Bleak.

What this example covers
------------------------
1. "Use Paired Windows Device" reconnects to the last BLE device address
   that this app successfully connected to.
2. "Scan Nearby Devices" performs a real BLE scan with BleakScanner.
3. Selecting a scanned device connects with BleakClient and updates the UI.
4. Connection state is refreshed from client.is_connected and disconnects are
   handled through Bleak's disconnected callback.
5. The last connected device address/name is stored in JSON and reused.

Why this works better than relying on the Windows paired list
-------------------------------------------------------------
Bleak is a cross-platform GATT library. It can scan nearby BLE advertisements
and connect to BLE devices, but it does not expose the full Windows Bluetooth
settings "paired devices" list in a generic way.

Important Windows limitations:
- Windows Bluetooth settings can show both Classic Bluetooth and BLE devices.
- Bleak only works with BLE / GATT devices.
- A device being "paired" in Windows does NOT mean your app has an active
  GATT connection.
- Many devices will not appear unless they are advertising when you scan.
- The safest app pattern is to remember the last successful BLE address and
  reconnect to that address directly, with a scan fallback if needed.
"""

from __future__ import annotations

import asyncio
import json
import threading
from concurrent.futures import Future
from dataclasses import asdict, dataclass
from pathlib import Path
from tkinter import END, BOTH, LEFT, RIGHT, VERTICAL, Y, Listbox, StringVar, Tk, messagebox
from tkinter import ttk
from typing import Callable

from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice


APP_DIR = Path(__file__).resolve().parent
STATE_FILE = APP_DIR / "last_ble_device.json"

SCAN_TIMEOUT_SECONDS = 5.0
CONNECT_TIMEOUT_SECONDS = 10.0

# Replace this with your real characteristic if you want send_command() support.
BLE_WRITE_CHAR_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb"


@dataclass
class SavedDevice:
    address: str
    name: str = ""


def load_saved_device() -> SavedDevice | None:
    if not STATE_FILE.exists():
        return None

    try:
        payload = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        address = (payload.get("address") or "").strip()
        if not address:
            return None
        return SavedDevice(address=address, name=payload.get("name") or "")
    except Exception:
        return None


def save_saved_device(device: SavedDevice) -> None:
    STATE_FILE.write_text(json.dumps(asdict(device), indent=2), encoding="utf-8")


class BLEManager:
    """Runs Bleak in a background asyncio loop and pushes results to Tkinter."""

    def __init__(
        self,
        ui_dispatch: Callable[[Callable[[], None]], None],
        on_status: Callable[[str], None],
        on_scan_results: Callable[[list[BLEDevice]], None],
        on_connected: Callable[[SavedDevice], None],
        on_disconnected: Callable[[str], None],
        on_log: Callable[[str], None],
    ) -> None:
        self.ui_dispatch = ui_dispatch
        self.on_status = on_status
        self.on_scan_results = on_scan_results
        self.on_connected = on_connected
        self.on_disconnected = on_disconnected
        self.on_log = on_log

        self.saved_device = load_saved_device()
        self.client: BleakClient | None = None
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def _run_loop(self) -> None:
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    def _dispatch(self, callback: Callable, *args) -> None:
        self.ui_dispatch(lambda: callback(*args))

    def _submit(
        self,
        coro,
        on_success: Callable | None = None,
        on_error: Callable[[Exception], None] | None = None,
    ) -> Future:
        future = asyncio.run_coroutine_threadsafe(coro, self.loop)

        def _done(done_future: Future) -> None:
            try:
                result = done_future.result()
                if on_success is not None:
                    self._dispatch(on_success, result)
            except Exception as exc:  # noqa: BLE001 - surface real BLE errors to UI
                if on_error is not None:
                    self._dispatch(on_error, exc)
                else:
                    self._dispatch(self.on_status, f"Error: {exc}")
                    self._dispatch(self.on_log, f"Error: {exc}")

        future.add_done_callback(_done)
        return future

    async def _scan_devices(self) -> list[BLEDevice]:
        devices = await BleakScanner.discover(timeout=SCAN_TIMEOUT_SECONDS)
        unique: dict[str, BLEDevice] = {}
        for device in devices:
            unique.setdefault(device.address, device)
        return list(unique.values())

    def scan_devices(self) -> None:
        self._dispatch(self.on_status, "Scanning nearby BLE devices...")
        self._dispatch(self.on_log, "Starting BLE scan")
        self._submit(
            self._scan_devices(),
            on_success=self._handle_scan_success,
            on_error=lambda exc: self._handle_error("Scan failed", exc),
        )

    def _handle_scan_success(self, devices: list[BLEDevice]) -> None:
        if devices:
            self.on_status(f"Found {len(devices)} BLE device(s)")
            self.on_log(f"Scan complete: {len(devices)} device(s)")
        else:
            self.on_status("No BLE devices found")
            self.on_log("Scan complete: no devices found")
        self.on_scan_results(devices)

    def connect_saved_device(self) -> None:
        if not self.saved_device:
            self._dispatch(self.on_status, "No saved BLE device yet")
            self._dispatch(self.on_log, "Reconnect skipped: no saved device")
            return

        self._dispatch(
            self.on_status,
            f"Trying saved device: {self.saved_device.name or self.saved_device.address}",
        )
        self._dispatch(self.on_log, f"Reconnect saved device: {self.saved_device.address}")
        self._submit(
            self._connect_saved_device(),
            on_success=self.on_connected,
            on_error=lambda exc: self._handle_error("Saved device reconnect failed", exc),
        )

    async def _connect_saved_device(self) -> SavedDevice:
        if not self.saved_device:
            raise RuntimeError("No saved BLE device")

        try:
            return await self._connect_target(self.saved_device.address, self.saved_device.name)
        except Exception as first_exc:  # noqa: BLE001 - want fallback behavior
            scanned = await self._scan_devices()
            match = next(
                (device for device in scanned if device.address.lower() == self.saved_device.address.lower()),
                None,
            )
            if match is None:
                raise RuntimeError(
                    f"Saved device {self.saved_device.address} is not advertising nearby"
                ) from first_exc
            return await self._connect_target(match, self.saved_device.name)

    def connect_device(self, device: BLEDevice) -> None:
        name = device.name or device.address
        self._dispatch(self.on_status, f"Connecting to {name}...")
        self._dispatch(self.on_log, f"Connecting to scanned device: {device.address}")
        self._submit(
            self._connect_target(device, device.name or ""),
            on_success=self.on_connected,
            on_error=lambda exc: self._handle_error("Connection failed", exc),
        )

    async def _connect_target(self, target: BLEDevice | str, preferred_name: str = "") -> SavedDevice:
        await self._disconnect_if_needed()

        client = BleakClient(
            target,
            disconnected_callback=lambda _client: self._handle_disconnect_from_bleak(),
        )
        await client.connect(timeout=CONNECT_TIMEOUT_SECONDS)
        self.client = client

        if isinstance(target, BLEDevice):
            saved = SavedDevice(address=target.address, name=target.name or preferred_name or target.address)
        else:
            saved = SavedDevice(address=target, name=preferred_name or target)

        self.saved_device = saved
        save_saved_device(saved)
        self._dispatch(self.on_status, f"Connected to {saved.name}")
        self._dispatch(self.on_log, f"Connected: {saved.address}")
        return saved

    async def _disconnect_if_needed(self) -> None:
        if self.client and self.client.is_connected:
            try:
                await self.client.disconnect()
            finally:
                self.client = None

    def disconnect(self) -> None:
        self._dispatch(self.on_status, "Disconnecting...")
        self._submit(
            self._disconnect(),
            on_success=lambda _result: self.on_disconnected("Disconnected"),
            on_error=lambda exc: self._handle_error("Disconnect failed", exc),
        )

    async def _disconnect(self) -> None:
        await self._disconnect_if_needed()

    def _handle_disconnect_from_bleak(self) -> None:
        self.client = None
        self._dispatch(self.on_disconnected, "Device disconnected")
        self._dispatch(self.on_log, "Disconnected callback from Bleak")

    def send_command(self, command: str) -> None:
        if not self.is_connected():
            self._dispatch(self.on_status, "Not connected")
            return

        self._submit(
            self._write_command(command),
            on_success=lambda _result: self.on_log(f"Sent command: {command}"),
            on_error=lambda exc: self._handle_error("Write failed", exc),
        )

    async def _write_command(self, command: str) -> None:
        if not self.client or not self.client.is_connected:
            raise RuntimeError("No active BLE connection")
        await self.client.write_gatt_char(BLE_WRITE_CHAR_UUID, command.encode("utf-8"))

    def is_connected(self) -> bool:
        return bool(self.client and self.client.is_connected)

    def shutdown(self) -> None:
        try:
            disconnect_future = asyncio.run_coroutine_threadsafe(self._disconnect_if_needed(), self.loop)
            disconnect_future.result(timeout=5)
        except Exception:
            pass
        finally:
            self.loop.call_soon_threadsafe(self.loop.stop)

    def _handle_error(self, title: str, exc: Exception) -> None:
        self.on_status(f"{title}: {exc}")
        self.on_log(f"{title}: {exc}")


class SmartPillBoxApp:
    def __init__(self, root: Tk) -> None:
        self.root = root
        self.root.title("Smart Pill Box BLE")
        self.root.geometry("760x560")
        self.root.minsize(700, 500)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        self.status_var = StringVar(value="Not connected")
        self.saved_var = StringVar(value="Saved device: none")
        self.connection_var = StringVar(value="Connection state: disconnected")

        self.scanned_devices: list[BLEDevice] = []

        self.manager = BLEManager(
            ui_dispatch=self._dispatch_to_ui,
            on_status=self.set_status,
            on_scan_results=self.show_scan_results,
            on_connected=self.handle_connected,
            on_disconnected=self.handle_disconnected,
            on_log=self.append_log,
        )

        self._build_ui()
        self._refresh_saved_summary()
        self._refresh_connection_state()

    def _dispatch_to_ui(self, callback: Callable[[], None]) -> None:
        self.root.after(0, callback)

    def _build_ui(self) -> None:
        self.root.configure(bg="#edf7f6")

        container = ttk.Frame(self.root, padding=18)
        container.pack(fill=BOTH, expand=True)

        title = ttk.Label(container, text="Smart Pill Box Connection", font=("Segoe UI", 20, "bold"))
        title.pack(anchor="w")

        ttk.Label(container, textvariable=self.status_var, font=("Segoe UI", 12)).pack(anchor="w", pady=(8, 0))
        ttk.Label(container, textvariable=self.connection_var, font=("Segoe UI", 11)).pack(anchor="w", pady=(4, 0))
        ttk.Label(container, textvariable=self.saved_var, font=("Segoe UI", 11)).pack(anchor="w", pady=(4, 14))

        button_row = ttk.Frame(container)
        button_row.pack(fill="x", pady=(0, 10))

        ttk.Button(button_row, text="Use Paired Windows Device", command=self.manager.connect_saved_device).pack(
            side=LEFT, padx=(0, 10)
        )
        ttk.Button(button_row, text="Scan Nearby Devices", command=self.manager.scan_devices).pack(side=LEFT)
        ttk.Button(button_row, text="Connect Selected", command=self.connect_selected_device).pack(side=LEFT, padx=10)
        ttk.Button(button_row, text="Disconnect", command=self.manager.disconnect).pack(side=LEFT)

        results_frame = ttk.LabelFrame(container, text="Scanned BLE devices", padding=10)
        results_frame.pack(fill=BOTH, expand=True)

        self.device_list = Listbox(results_frame, height=12)
        self.device_list.pack(side=LEFT, fill=BOTH, expand=True)

        scrollbar = ttk.Scrollbar(results_frame, orient=VERTICAL, command=self.device_list.yview)
        scrollbar.pack(side=RIGHT, fill=Y)
        self.device_list.configure(yscrollcommand=scrollbar.set)

        actions = ttk.Frame(container)
        actions.pack(fill="x", pady=(10, 10))
        ttk.Button(actions, text="Send TAKEN", command=lambda: self.manager.send_command("TAKEN")).pack(side=LEFT)
        ttk.Button(actions, text="Send SNOOZE", command=lambda: self.manager.send_command("SNOOZE")).pack(
            side=LEFT, padx=10
        )

        log_frame = ttk.LabelFrame(container, text="Event log", padding=10)
        log_frame.pack(fill=BOTH, expand=True)

        self.log_list = Listbox(log_frame, height=8)
        self.log_list.pack(fill=BOTH, expand=True)

    def set_status(self, text: str) -> None:
        self.status_var.set(text)

    def append_log(self, text: str) -> None:
        self.log_list.insert(END, text)
        self.log_list.yview_moveto(1.0)

    def show_scan_results(self, devices: list[BLEDevice]) -> None:
        self.scanned_devices = devices
        self.device_list.delete(0, END)

        for device in devices:
            name = device.name or "Unnamed BLE device"
            self.device_list.insert(END, f"{name}  [{device.address}]")

    def connect_selected_device(self) -> None:
        selection = self.device_list.curselection()
        if not selection:
            messagebox.showinfo("Select device", "Choose a scanned BLE device first.", parent=self.root)
            return

        device = self.scanned_devices[selection[0]]
        self.manager.connect_device(device)

    def handle_connected(self, saved: SavedDevice) -> None:
        self.status_var.set(f"Connected to {saved.name}")
        self.append_log(f"Saved last device: {saved.address}")
        self._refresh_saved_summary()

    def handle_disconnected(self, reason: str) -> None:
        self.status_var.set(reason)
        self.append_log(reason)
        self._refresh_connection_state()

    def _refresh_saved_summary(self) -> None:
        saved = self.manager.saved_device
        if saved:
            label = saved.name or saved.address
            self.saved_var.set(f"Saved device: {label} [{saved.address}]")
        else:
            self.saved_var.set("Saved device: none")

    def _refresh_connection_state(self) -> None:
        if self.manager.is_connected():
            saved = self.manager.saved_device
            label = saved.name if saved else "BLE device"
            self.connection_var.set(f"Connection state: connected to {label}")
        else:
            self.connection_var.set("Connection state: disconnected")
        self.root.after(1000, self._refresh_connection_state)

    def on_close(self) -> None:
        self.manager.shutdown()
        self.root.destroy()


def main() -> None:
    root = Tk()
    app = SmartPillBoxApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()

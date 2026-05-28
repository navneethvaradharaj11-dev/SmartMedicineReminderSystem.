#!/usr/bin/env python3
"""
Temporary HC-05 medicine reminder controller.

Protocol expected from Arduino:
- Arduino sends: BT|ALERT|Dose N|HH:MM
- Arduino sends: BT|CONFIRMED|Dose N|Button press|HH:MM:SS
- Arduino sends: BT|CONFIRMED|Dose N|Box opened|HH:MM:SS
- Arduino sends: BT|MISSED|Dose N|Caregiver alert|HH:MM:SS
Legacy messages are still accepted:
- Arduino sends: TIME:HH:MM:SS
- Arduino sends: BTN:PRESSED

Run examples:
  python hardware_reminder_controller.py --address 00:25:12:00:23:35
  python hardware_reminder_controller.py --address 00:25:12:00:23:35 --reminder 19:15
"""

from __future__ import annotations

import argparse
import re
import socket
import sys
import threading
import time


DEFAULT_HC05_MAC_ADDRESS = "00:25:12:00:23:35"
DEFAULT_RFCOMM_PORT = 1
TIME_PATTERN = re.compile(r"^\d{2}:\d{2}$")
DOSE_PATTERN = re.compile(r"dose\s+(\d+)", re.IGNORECASE)


class ReminderState:
    def __init__(self, reminder_time: str = "") -> None:
        self.reminder_time = reminder_time
        self.medicine_taken = False
        self.alarm_triggered_today = False
        self.lock = threading.Lock()

    def set_reminder(self, reminder_time: str) -> None:
        with self.lock:
            self.reminder_time = reminder_time
            self.medicine_taken = False
            self.alarm_triggered_today = False

    def mark_taken(self) -> None:
        with self.lock:
            self.medicine_taken = True

    def reset_day(self) -> None:
        with self.lock:
            self.medicine_taken = False
            self.alarm_triggered_today = False

    def status_line(self, current_time: str) -> str:
        with self.lock:
            reminder = self.reminder_time or "Not Set"
            taken = "Yes" if self.medicine_taken else "No"
        return f"\r[Arduino Time]: {current_time} | Reminder: {reminder} | Taken: {taken}  "

    def should_start_alarm(self, current_time: str) -> bool:
        with self.lock:
            if not self.reminder_time or self.medicine_taken or self.alarm_triggered_today:
                return False

            current_hm = current_time[:5]
            if current_hm != self.reminder_time:
                return False

            self.alarm_triggered_today = True
            return True


def send_line(sock: socket.socket, line: str) -> None:
    sock.sendall(f"{line}\n".encode("utf-8"))


def receive_messages(sock: socket.socket, state: ReminderState, stop_event: threading.Event) -> None:
    buffer = ""
    while not stop_event.is_set():
        try:
            data = sock.recv(1024)
            if not data:
                print("\nBluetooth disconnected.")
                stop_event.set()
                break

            buffer += data.decode("utf-8", errors="replace")

            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                handle_arduino_line(sock, state, line.strip())
        except OSError as exc:
            if not stop_event.is_set():
                print(f"\nBluetooth receive error: {exc}")
            stop_event.set()
            break
        except Exception as exc:  # noqa: BLE001 - this is a temporary hardware bridge
            print(f"\nError receiving data: {exc}")
            stop_event.set()
            break


def handle_arduino_line(sock: socket.socket, state: ReminderState, line: str) -> None:
    if not line:
        return

    if line.startswith("BT|"):
        handle_bt_event(sock, state, line)
        return

    if line.startswith("TIME:"):
        current_time = line.split("TIME:", 1)[1].strip()
        sys.stdout.write(state.status_line(current_time))
        sys.stdout.flush()

        if current_time == "00:00:00":
            state.reset_day()
            print("\nMidnight reset: variables reset for a new day.")

        if state.should_start_alarm(current_time):
            print("\n\nTIME TO TAKE MEDICINE!")
            send_line(sock, "ALARM:START")
        return

    if line == "BTN:PRESSED":
        print("\n\nMedicine taken from hardware button.")
        state.mark_taken()
        send_line(sock, "ALARM:STOP")
        return

    print(f"\n[Arduino]: {line}")


def handle_bt_event(sock: socket.socket, state: ReminderState, line: str) -> None:
    parts = [part.strip() for part in line.split("|")]
    if len(parts) < 3:
        print(f"\n[Arduino]: {line}")
        return

    event = parts[1].upper()
    dose_label = parts[2]
    detail = parts[3] if len(parts) > 3 else ""
    event_time = parts[4] if len(parts) > 4 else detail
    dose_match = DOSE_PATTERN.search(dose_label)
    dose_number = dose_match.group(1) if dose_match else dose_label

    if event == "ALERT":
        with state.lock:
            state.alarm_triggered_today = True
        print(f"\n\nTIME TO TAKE MEDICINE! {dose_label} at {event_time}")
        return

    if event == "CONFIRMED":
        state.mark_taken()
        try:
            send_line(sock, "ALARM:STOP")
        except OSError as exc:
            print(f"\nCould not send stop acknowledgement: {exc}")
        print(f"\n\nMedicine taken from hardware. Dose {dose_number} confirmed via {detail or 'hardware'}.")
        return

    if event == "MISSED":
        print(f"\n\nMISSED DOSE: Dose {dose_number}. {detail or 'Caregiver alert'} at {event_time}.")
        return

    print(f"\n[Arduino]: {line}")


def create_bluetooth_socket() -> socket.socket:
    if not hasattr(socket, "AF_BLUETOOTH") or not hasattr(socket, "BTPROTO_RFCOMM"):
        raise RuntimeError(
            "This Python build does not expose AF_BLUETOOTH/RFCOMM. "
            "Use Python 3.9+ on Windows/Linux with Bluetooth socket support, "
            "or connect HC-05 through a COM port and adapt this script to serial."
        )

    return socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)


def connect_hc05(address: str, port: int) -> socket.socket:
    print(f"Connecting to HC-05 at {address} on RFCOMM channel {port}...")
    sock = create_bluetooth_socket()
    sock.connect((address, port))
    print("Connected to Bluetooth successfully.")
    return sock


def validate_reminder_time(value: str) -> str:
    value = value.strip()
    if not TIME_PATTERN.match(value):
        raise argparse.ArgumentTypeError("Reminder must be HH:MM, for example 19:15")

    hour = int(value[:2])
    minute = int(value[3:])
    if hour > 23 or minute > 59:
        raise argparse.ArgumentTypeError("Reminder must be a valid 24-hour time, HH:MM")

    return value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Temporary HC-05 medicine reminder controller.")
    parser.add_argument(
        "--address",
        default=DEFAULT_HC05_MAC_ADDRESS,
        help=f"HC-05 MAC address. Default: {DEFAULT_HC05_MAC_ADDRESS}",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_RFCOMM_PORT,
        help=f"RFCOMM channel. Default: {DEFAULT_RFCOMM_PORT}",
    )
    parser.add_argument(
        "--reminder",
        type=validate_reminder_time,
        default="",
        help="Optional startup reminder time in 24-hour HH:MM format.",
    )
    return parser.parse_args()


def run_console(sock: socket.socket, state: ReminderState, stop_event: threading.Event) -> None:
    time.sleep(1)

    while not stop_event.is_set():
        try:
            command = input("\nCommands: [r] Set Reminder | [t] Mark Taken | [s] Stop Alarm | [q] Quit\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nDisconnecting...")
            stop_event.set()
            break

        if command.lower() == "r":
            reminder_time = input("Enter reminder time (HH:MM): ").strip()
            try:
                state.set_reminder(validate_reminder_time(reminder_time))
                print(f"Reminder time updated to {reminder_time}")
            except argparse.ArgumentTypeError as exc:
                print(f"Invalid format: {exc}")
        elif command.lower() == "t":
            state.mark_taken()
            send_line(sock, "ALARM:STOP")
            print("Medicine marked as taken from Python console.")
        elif command.lower() == "s":
            send_line(sock, "ALARM:STOP")
            print("Alarm stop command sent.")
        elif command.lower() == "q":
            print("Disconnecting...")
            stop_event.set()
            break
        elif command:
            print("Unknown command.")


def main() -> int:
    args = parse_args()
    state = ReminderState(args.reminder)
    stop_event = threading.Event()

    print("Python Medicine Reminder Controller")
    print("-----------------------------------")
    if state.reminder_time:
        print(f"Startup reminder: {state.reminder_time}")

    try:
        sock = connect_hc05(args.address, args.port)
    except Exception as exc:  # noqa: BLE001 - show friendly hardware setup message
        print(f"Failed to connect: {exc}")
        print("Make sure the HC-05 is powered on, paired in Windows Bluetooth settings, and the MAC address is correct.")
        return 1

    receiver = threading.Thread(target=receive_messages, args=(sock, state, stop_event), daemon=True)
    receiver.start()

    try:
        run_console(sock, state, stop_event)
    finally:
        stop_event.set()
        try:
            send_line(sock, "ALARM:STOP")
        except Exception:
            pass
        sock.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

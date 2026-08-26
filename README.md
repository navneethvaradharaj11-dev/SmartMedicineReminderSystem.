# 💊 Smart Medicine Reminder System (Gentle Dose)

[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://smart-medicine-reminder-system.vercel.app)  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

Modern, cross-platform medication adherence system combining a React + TypeScript web dashboard with a lightweight Python BLE gateway and Arduino firmware for an IoT smart pillbox.

Live demo: https://smart-medicine-reminder-system.vercel.app

---

## Table of Contents

- [About](#about)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Install & Run (Frontend)](#install--run-frontend)
  - [Python BLE Gateway](#python-ble-gateway)
  - [Arduino Firmware](#arduino-firmware)
- [Configuration](#configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## About

Gentle Dose is an intelligent medication reminder and adherence analytics platform that pairs a web-based dashboard with a physical IoT smart pillbox. The system supports voice reminders (English & Tamil), BLE communication to the pillbox, a dose history log, caregiver profiles, and accessibility-focused audio feedback.

This repository contains three main components:
1. Web dashboard (Vite + React + TypeScript)
2. Python BLE serial gateway (local bridge to hardware)
3. Arduino firmware for the pillbox

---

## Key Features

- Adherence analytics and visual dashboards
- Multi-language voice reminders and accessibility support
- Bluetooth Low Energy (BLE) integration with a physical pillbox
- Local Python gateway to expose a secure API to the frontend
- Offline-safe design with local device pairing and status monitoring
- Hardware diagnostics for buzzer, LEDs, and buttons

---

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend / Gateway: Python (BLE / serial bridge)
- Firmware: Arduino (C/C++)
- CI / CD: GitHub Actions, Vercel for frontend hosting

---

## System Architecture

The frontend communicates with a local Python BLE gateway via HTTP/websockets. The gateway connects to the Arduino-based pillbox over a serial/Bluetooth link and relays hardware events and commands.

(High-level)

- Frontend (Vite + React) <--> Python BLE Gateway (localhost:8765) <--> Arduino (HC-05 / Serial)

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or bun
- Python 3.10+
- Arduino IDE (for uploading firmware)

### Install & Run (Frontend)

1. Clone the repo:

```bash
git clone https://github.com/navneethvaradharaj11-dev/SmartMedicineReminderSystem.git
cd SmartMedicineReminderSystem
```

2. Install dependencies and run the dev server:

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:5173 to view the dashboard.

### Python BLE Gateway

The Python gateway provides a local API (default: http://127.0.0.1:8765) to bridge BLE/serial communications with the frontend.

Run the gateway (example):

```bash
# from project root
python gentle_dose.py
```

Check gateway options and environment variables in the repository files.

### Arduino Firmware

1. Open `arduino/smart_medicine_reminder/smart_medicine_reminder.ino` in the Arduino IDE.
2. Configure pins and the Bluetooth serial parameters (HC-05) as required.
3. Upload to your board (Nano/Uno/ESP32 as applicable).

---

## Configuration

- The repository includes a `.env.example` (recommended). Copy it to `.env` locally and populate secrets/keys.
- Important environment variables (examples):
  - VITE_API_URL (default: http://127.0.0.1:8765)
  - HC05_BT_ADDRESS
  - SERIAL_PORT / SERIAL_BAUD

Do NOT commit real secrets to the repository. Remove any accidental secret leaks and rotate keys if needed.

---

## Testing

Run the test suite (Vitest):

```bash
npm run test
```

Run linters and type checks before committing:

```bash
npm run lint
npm run build
```

---

## Deployment

The frontend is configured for Vercel deployment (see `vercel.json`). To deploy manually, connect the repository to Vercel and set required environment variables in the Vercel dashboard.

---

## Security

- Secrets must live in environment variables or a secrets manager. If you’ve accidentally pushed `.env`, remove it and rotate all exposed keys immediately.
- Use `.env.example` to document required variables without exposing values.

---

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository and create a feature branch: `git checkout -b feat/your-feature`
2. Make changes and run tests/linting locally
3. Open a pull request describing the change and context

Please adhere to the existing code style and include tests for new behavior.

---

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.

---

## Contact

Navneeth Varadharaj — https://github.com/navneethvaradharaj11-dev

For critical security issues, open an issue and mark it as confidential or contact the repository owner directly.

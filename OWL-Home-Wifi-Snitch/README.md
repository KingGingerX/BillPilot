# OWL — Home WiFi Snitch

Always-on home network monitor. Scans every 60 seconds, identifies devices, alerts on newcomers.

## Setup

1. Install [Npcap](https://npcap.com/#download) (required for ARP scanning on Windows)
2. `pip install -r requirements.txt`
3. Copy `.env.example` to `.env` and fill in your Telegram credentials
4. `python setup.py` — downloads OUI database, creates owl.db, registers Windows startup task
5. `python main.py` — start OWL (or it starts automatically on next boot)

## Dashboard

Open http://localhost:5000

## Getting Telegram credentials

1. Message @BotFather on Telegram → /newbot → copy the token
2. Message @userinfobot on Telegram → copy your chat ID

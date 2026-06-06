"""Scheduling automation for AFF LAUNCHER on Windows."""
import argparse
import subprocess
import sys
from config import ROOT
from logger import setup_logger

logger = setup_logger("scheduler")

TASK_NAME = "AFF_Launcher_AutoLaunch"


def install_windows_task(
    product_json: str,
    interval_hours: int = 24,
) -> None:
    """Create a Windows Scheduled Task to run agent.py launch periodically."""
    python_exe = sys.executable
    agent_script = ROOT / "agent.py"
    action = f"'{python_exe}' '{agent_script}' launch --product '{product_json}'"

    # Delete existing task silently
    subprocess.run(
        ["schtasks", "/delete", "/tn", TASK_NAME, "/f"],
        capture_output=True,
    )

    create_cmd = [
        "schtasks",
        "/create",
        "/tn", TASK_NAME,
        "/tr", action,
        "/sc", "hourly",
        "/mo", str(interval_hours),
        "/rl", "highest",
        "/f",
    ]
    result = subprocess.run(create_cmd, capture_output=True, text=True)
    if result.returncode == 0:
        logger.info(
            "Scheduled task created: %s every %s hours",
            TASK_NAME,
            interval_hours,
        )
        print(f"[OK] Task '{TASK_NAME}' scheduled every {interval_hours} hours.")
    else:
        logger.error("schtasks failed: %s", result.stderr)
        print(f"[FAIL] {result.stderr}")
        sys.exit(1)


def remove_windows_task() -> None:
    result = subprocess.run(
        ["schtasks", "/delete", "/tn", TASK_NAME, "/f"],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        logger.info("Scheduled task removed: %s", TASK_NAME)
        print(f"[OK] Task '{TASK_NAME}' removed.")
    else:
        print(f"[INFO] {result.stderr.strip()}")


def list_windows_task() -> None:
    result = subprocess.run(
        ["schtasks", "/query", "/tn", TASK_NAME, "/fo", "list"],
        capture_output=True,
        text=True,
    )
    print(result.stdout if result.returncode == 0 else result.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Manage Windows Scheduled Tasks for AFF LAUNCHER"
    )
    parser.add_argument(
        "action", choices=["install", "remove", "list"]
    )
    parser.add_argument(
        "--product", help="Path to product JSON (required for install)"
    )
    parser.add_argument(
        "--interval-hours", type=int, default=24, help="Run interval in hours"
    )
    args = parser.parse_args()

    if args.action == "install":
        if not args.product:
            parser.error("--product is required for install")
        install_windows_task(args.product, args.interval_hours)
    elif args.action == "remove":
        remove_windows_task()
    else:
        list_windows_task()


if __name__ == "__main__":
    main()

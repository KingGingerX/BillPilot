"""
AFF LAUNCHER — Deploy a product to all configured affiliate platforms.
Usage:
  python aff_launcher.py launch              # interactive wizard
  python aff_launcher.py launch --quick      # pass all args as flags
  python aff_launcher.py status             # show configured platforms
"""
import concurrent.futures
import getpass
import json
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

from alerts import AlertConfig, alert_launch_failure
from logger import setup_logger
from platforms import ALL_PLATFORMS
from platforms.base import PlatformStatus, ProductSpec
from validators import ValidationError
from vault import list_configured_platforms, load_vault

app = typer.Typer(
    add_completion=False,
    help="AFF LAUNCHER — one command deploys to every affiliate platform",
)
console = Console()
logger = setup_logger("aff_launcher")


def _get_password() -> str:
    return getpass.getpass("Vault master password: ")


def _prompt_product() -> ProductSpec:
    console.print(
        Panel("[bold cyan]NEW PRODUCT SETUP[/bold cyan]", expand=False)
    )
    name = typer.prompt("Product name")
    description = typer.prompt(
        "Description (sales copy, supports multi-line — "
        "paste and hit Enter twice)"
    )
    price = float(typer.prompt("Price (USD)", default="97"))
    commission = int(typer.prompt("Commission % for affiliates", default="50"))
    sales_page = typer.prompt("Sales page URL")
    thank_you = typer.prompt("Thank you / delivery page URL")
    refund_days = int(typer.prompt("Refund window (days)", default="30"))
    return ProductSpec(
        name=name,
        description=description,
        price_usd=price,
        commission_pct=commission,
        sales_page_url=sales_page,
        thank_you_url=thank_you,
        refund_days=refund_days,
    )


def _run_platform(platform_name: str, creds: dict, product: ProductSpec):
    cls = ALL_PLATFORMS[platform_name]
    instance = cls(creds)
    return instance.launch(product)


@app.command()
def launch(
    name: Optional[str] = typer.Option(
        None, "--name", "-n", help="Product name"
    ),
    description: Optional[str] = typer.Option(
        None, "--desc", "-d", help="Product description"
    ),
    price: Optional[float] = typer.Option(
        None, "--price", "-p", help="Price in USD"
    ),
    commission: Optional[int] = typer.Option(
        None, "--commission", "-c", help="Affiliate commission %"
    ),
    sales_url: Optional[str] = typer.Option(
        None, "--sales-url", help="Sales page URL"
    ),
    thank_you_url: Optional[str] = typer.Option(
        None, "--ty-url", help="Thank you page URL"
    ),
    refund_days: int = typer.Option(
        30, "--refund-days", help="Refund window in days"
    ),
    platforms: Optional[str] = typer.Option(
        None, "--platforms", help="Comma-separated platforms (default: all configured)"
    ),
    parallel: bool = typer.Option(
        True, "--parallel/--sequential", help="Run platforms in parallel"
    ),
):
    """Deploy product to all configured affiliate platforms."""
    if all(
        [
            name,
            description,
            price is not None,
            commission is not None,
            sales_url,
            thank_you_url,
        ]
    ):
        product = ProductSpec(
            name=name,
            description=description,
            price_usd=price,
            commission_pct=commission,
            sales_page_url=sales_url,
            thank_you_url=thank_you_url,
            refund_days=refund_days,
        )
    else:
        product = _prompt_product()

    # Validate before touching vault
    try:
        from validators import validate_commission, validate_price, validate_url

        validate_url(product.sales_page_url, "sales_page_url")
        if product.thank_you_url:
            validate_url(product.thank_you_url, "thank_you_url")
        validate_price(product.price_usd, "price_usd")
        validate_commission(product.commission_pct, "commission_pct")
    except ValidationError as exc:
        console.print(f"[red]Validation error: {exc}[/red]")
        raise typer.Exit(1)

    password = _get_password()
    try:
        vault = load_vault(password)
    except ValueError as exc:
        console.print(f"[red]Vault error: {exc}[/red]")
        raise typer.Exit(1)

    configured = list(vault.keys())
    if not configured:
        console.print(
            "[yellow]No platforms configured. Run: python setup_creds.py[/yellow]"
        )
        raise typer.Exit(1)

    target_platforms = platforms.split(",") if platforms else configured
    target_platforms = [p.strip().lower() for p in target_platforms]
    unknown = [p for p in target_platforms if p not in ALL_PLATFORMS]
    if unknown:
        console.print(
            f"[red]Unknown platforms: {unknown}. "
            f"Valid: {list(ALL_PLATFORMS.keys())}[/red]"
        )
        raise typer.Exit(1)

    missing_creds = [p for p in target_platforms if p not in vault]
    if missing_creds:
        console.print(
            f"[yellow]No credentials for: {missing_creds}. "
            "Add via setup_creds.py[/yellow]"
        )
        target_platforms = [
            p for p in target_platforms if p not in missing_creds
        ]

    if not target_platforms:
        console.print("[red]No valid platforms to launch to.[/red]")
        raise typer.Exit(1)

    console.print(
        Panel(
            f"[bold]LAUNCHING:[/bold] {product.name}\n"
            f"Price: ${product.price_usd} | Commission: {product.commission_pct}%\n"
            f"Platforms: {', '.join(target_platforms)}",
            title="[bold green]AFF LAUNCHER[/bold green]",
        )
    )
    logger.info(
        "Launching %s to %s", product.name, ", ".join(target_platforms)
    )

    results = []

    if parallel and len(target_platforms) > 1:
        spinner = SpinnerColumn()
        text = TextColumn("[progress.description]{task.description}")
        with Progress(spinner, text, console=console) as progress:
            tasks = {
                p: progress.add_task(f"[cyan]{p}...", total=None)
                for p in target_platforms
            }
            max_workers = min(len(target_platforms), 4)
            with concurrent.futures.ThreadPoolExecutor(
                max_workers=max_workers
            ) as executor:
                futures = {
                    executor.submit(_run_platform, p, vault[p], product): p
                    for p in target_platforms
                }
                for future in concurrent.futures.as_completed(futures):
                    p = futures[future]
                    progress.update(
                        tasks[p],
                        completed=True,
                        description=f"[green]{p} done",
                    )
                    try:
                        result = future.result()
                    except Exception as exc:
                        logger.exception("Platform %s crashed", p)
                        from platforms.base import LaunchResult

                        result = LaunchResult(
                            platform=p,
                            status=PlatformStatus.FAILED,
                            error=str(exc),
                        )
                    results.append(result)
    else:
        for p in target_platforms:
            console.print(f"  → {p}...")
            try:
                result = _run_platform(p, vault[p], product)
            except Exception as exc:
                logger.exception("Platform %s crashed", p)
                from platforms.base import LaunchResult

                result = LaunchResult(
                    platform=p,
                    status=PlatformStatus.FAILED,
                    error=str(exc),
                )
            results.append(result)

    # Results table
    table = Table(title="LAUNCH RESULTS", show_lines=True)
    table.add_column("Platform", style="bold")
    table.add_column("Status")
    table.add_column("URL / ID")
    table.add_column("Notes")

    success_count = 0
    for r in results:
        if r.status == PlatformStatus.SUCCESS:
            status_str = "[green]✓ SUCCESS[/green]"
            success_count += 1
        elif r.status == PlatformStatus.NEEDS_REVIEW:
            status_str = "[yellow]⚠ REVIEW[/yellow]"
            success_count += 1
        else:
            status_str = "[red]✗ FAILED[/red]"

        url_or_id = r.product_url or r.product_id or ""
        notes = r.error if r.error else r.message

        table.add_row(r.platform, status_str, url_or_id[:60], notes[:80])

    console.print(table)
    console.print(
        f"\n[bold]Done:[/bold] {success_count}/{len(results)} "
        "platforms launched successfully."
    )
    logger.info(
        "Launch complete: %s/%s successful", success_count, len(results)
    )

    # Revenue tracking
    from revenue_tracker import record_launch

    record_launch(
        product_name=product.name,
        platforms=target_platforms,
        price_usd=product.price_usd,
        commission_pct=product.commission_pct,
        status="success" if success_count == len(results) else "partial",
        notes=f"{success_count}/{len(results)} platforms succeeded",
    )

    # Alerting on failures
    alert_config = AlertConfig(
        slack_webhook="",
        email_webhook="",
    )
    for r in results:
        if r.status == PlatformStatus.FAILED and r.error:
            alert_launch_failure(
                alert_config,
                product.name,
                r.platform,
                r.error,
            )

    # Save results to JSON
    output = {
        "product": product.name,
        "price": product.price_usd,
        "commission_pct": product.commission_pct,
        "results": [
            {
                "platform": r.platform,
                "status": r.status.value,
                "product_url": r.product_url,
                "product_id": r.product_id,
                "message": r.message,
                "error": r.error,
            }
            for r in results
        ],
    }
    from config import RUNS_DIR

    RUNS_DIR.mkdir(exist_ok=True)
    last_launch_path = RUNS_DIR / "last_launch.json"
    with open(last_launch_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    console.print(f"[dim]Results saved to {last_launch_path}[/dim]")


@app.command()
def status():
    """Show which platforms are configured in vault."""
    password = _get_password()
    try:
        configured = list_configured_platforms(password)
    except ValueError as exc:
        console.print(f"[red]{exc}[/red]")
        raise typer.Exit(1)

    table = Table(title="CONFIGURED PLATFORMS")
    table.add_column("Platform")
    table.add_column("Status")

    for name in ALL_PLATFORMS:
        if name in configured:
            table.add_row(name, "[green]✓ Configured[/green]")
        else:
            table.add_row(name, "[dim]Not configured[/dim]")

    console.print(table)
    console.print("\nAdd platforms: [cyan]python setup_creds.py[/cyan]")


@app.command()
def last():
    """Show results from last launch."""
    from config import RUNS_DIR

    last_launch_path = RUNS_DIR / "last_launch.json"
    try:
        with open(last_launch_path, encoding="utf-8") as f:
            data = json.load(f)
        console.print_json(json.dumps(data, indent=2))
    except FileNotFoundError:
        console.print("[yellow]No previous launch found.[/yellow]")


if __name__ == "__main__":
    app()

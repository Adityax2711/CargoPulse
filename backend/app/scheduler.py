import time
import argparse
import logging
from app.database import get_db_ctx, init_db
from app.services.alerts_service import run_scan_gap_check

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ShipGuardScheduler")

def execute_scan_gap_cycle():
    logger.info("Executing scan gap evaluation cycle...")
    try:
        with get_db_ctx() as conn:
            result = run_scan_gap_check(conn)
            logger.info(
                f"Evaluation completed. Evaluated: {result['total_active_evaluated']} active shipments. "
                f"Newly marked lost: {len(result['newly_marked_lost'])}, "
                f"Active warnings: {len(result['active_warnings'])}"
            )
            return result
    except Exception as e:
        logger.error(f"Error during scan gap cycle: {e}", exc_info=True)
        return None

def start_scheduler_loop(interval_seconds: int = 3600):
    logger.info(f"ShipGuard Hourly Background Scheduler started. Running every {interval_seconds} seconds.")
    # Run once immediately on start
    execute_scan_gap_cycle()
    while True:
        try:
            time.sleep(interval_seconds)
            execute_scan_gap_cycle()
        except KeyboardInterrupt:
            logger.info("Scheduler received shutdown signal. Exiting.")
            break
        except Exception as e:
            logger.error(f"Unexpected error in scheduler loop: {e}")
            time.sleep(10)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ShipGuard Background Scan-Gap & Loss Scheduler")
    parser.add_argument("--once", action="store_true", help="Run once and exit (for cron or manual run)")
    parser.add_argument("--interval", type=int, default=3600, help="Loop interval in seconds (default 3600 / 1 hour)")
    args = parser.parse_args()

    init_db()
    if args.once:
        execute_scan_gap_cycle()
    else:
        start_scheduler_loop(args.interval)


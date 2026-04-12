"""Centralized logging configuration based on loguru.

Usage in any module:
    from logger import log
    log.info("hello {}", name)

Environment variables:
    LOG_LEVEL   – minimum severity (default: INFO)
    LOG_FILE    – path for rotating file log (default: logs/edgecloud.log)
"""

import os
import sys

from loguru import logger

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
LOG_FILE = os.environ.get("LOG_FILE", "logs/edgecloud.log")

# ── Remove loguru's default stderr handler and re-add with our settings ──
logger.remove()

# Console: colored, human-readable
logger.add(
    sys.stderr,
    level=LOG_LEVEL,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
           "<level>{level: <8}</level> | "
           "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
           "<level>{message}</level>",
)

# File: rotating log with retention
logger.add(
    LOG_FILE,
    level=LOG_LEVEL,
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} | {message}",
    rotation="10 MB",
    retention="7 days",
    compression="gz",
    encoding="utf-8",
)

# Intercept stdlib logging so third-party libs (paho-mqtt, openai) also
# flow through loguru with proper level mapping.
import logging


class _InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        # Map stdlib level to loguru level
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno
        # Find caller from where the logged message originated
        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1
        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


logging.basicConfig(handlers=[_InterceptHandler()], level=0, force=True)

# Public API: other modules just do `from logger import log`
log = logger

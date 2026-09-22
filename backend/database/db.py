"""
SQLAlchemy database setup for ReconAI.
Uses SQLite for hackathon simplicity.
"""
import logging
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

logger = logging.getLogger(__name__)

DB_PATH = os.environ.get("DATABASE_URL", "sqlite:///./reconai.db")

engine = create_engine(
    DB_PATH,
    connect_args={"check_same_thread": False},  # Required for SQLite + FastAPI
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dependency for FastAPI routes — provides a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Columns to add via safe idempotent migration.
# Format: (table, column_name, column_definition)
_MIGRATIONS = [
    (
        "reconciliation_records",
        "action_status",
        "VARCHAR DEFAULT 'OPEN'",
    ),
    (
        "reconciliation_records",
        "action_actor",
        "VARCHAR",
    ),
    (
        "reconciliation_records",
        "action_reason",
        "TEXT",
    ),
    (
        "reconciliation_records",
        "action_at",
        "DATETIME",
    ),
]


def _run_migrations():
    """
    Safely add new columns to existing tables.

    SQLite does not support IF NOT EXISTS on ALTER TABLE ADD COLUMN,
    so we check PRAGMA table_info first and only issue the ALTER when
    the column is genuinely absent.  This is fully idempotent — safe
    to run on every startup.
    """
    with engine.connect() as conn:
        for table, column, definition in _MIGRATIONS:
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            existing = {row[1] for row in rows}  # row[1] is column name
            if column not in existing:
                conn.execute(
                    text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
                )
                conn.commit()
                logger.info(f"Migration: added column '{column}' to '{table}'.")
            else:
                logger.debug(f"Migration: column '{column}' already exists in '{table}', skipping.")


def init_db():
    """Create all tables on startup, then run safe column migrations."""
    from backend.database import models as db_models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _run_migrations()

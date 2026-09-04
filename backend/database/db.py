"""
SQLAlchemy database setup for ReconAI.
Uses SQLite for hackathon simplicity.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

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


def init_db():
    """Create all tables on startup."""
    from backend.database import models as db_models  # noqa: F401
    Base.metadata.create_all(bind=engine)

import os
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import inspect, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cinetator.db")
engine = create_engine(DATABASE_URL, echo=False,
                       connect_args={"check_same_thread": False})


def _add_missing_columns():
    """Lightweight auto-migration: create_all() only adds brand-new tables, it
    never adds columns to a table that already exists. This app has no formal
    migration tool, so a model field added later (e.g. Upload.day_number) would
    otherwise 500 forever against an existing db file. On SQLite (the default,
    and what local/dev use), patch any missing columns onto the live tables."""
    if engine.dialect.name != "sqlite":
        return
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table_name, table in SQLModel.metadata.tables.items():
            if not inspector.has_table(table_name):
                continue
            existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
            for col in table.columns:
                if col.name in existing_cols:
                    continue
                col_type = col.type.compile(engine.dialect)
                conn.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{col.name}" {col_type}'))


def init_db():
    SQLModel.metadata.create_all(engine)
    _add_missing_columns()


def get_session():
    with Session(engine) as session:
        yield session

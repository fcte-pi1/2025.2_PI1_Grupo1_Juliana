import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Use SQLite in memory for tests
if os.environ.get("TESTING") == "1":
    DATABASE_URL = "sqlite:///:memory:"
    connect_args = {"check_same_thread": False}
    engine_kwargs = {"connect_args": connect_args, "poolclass": StaticPool}
else:
    # Production settings
    ENCODED_PASSWORD = "vwKegP%23%40n8%21S2RB"
    DEFAULT_DATABASE_URL = f"postgresql://postgres:{ENCODED_PASSWORD}@db.wbxgeqrsrlatgzxloifp.supabase.co:5432/postgres"
    DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    
    # Local SQLite fallback
    if DATABASE_URL.lower() == "sqlite":
        DATABASE_URL = "sqlite:///./local_dev.db"
        connect_args = {"check_same_thread": False}
    else:
        connect_args = {}

engine = create_engine(DATABASE_URL, **engine_kwargs if os.environ.get("TESTING") == "1" else {"connect_args": connect_args})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
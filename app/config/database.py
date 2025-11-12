import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Carrega variáveis de ambiente de um arquivo .env se existir
load_dotenv()

# Permite configurar a URL do banco via env; fallback para SQLite local para desenvolvimento/teste
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Fallback local para evitar falhas quando sem rede ou sem Supabase
    DATABASE_URL = "sqlite:///./dev.db"


def _create_engine(url: str):
    if url.startswith("sqlite"): 
        return create_engine(url, connect_args={"check_same_thread": False})
    return create_engine(url)


engine = _create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
from typing import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config.database import Base, get_db
from main import app


# Engine de testes (SQLite em memória) compartilhando a mesma conexão
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db() -> Generator:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Criar tabelas uma vez por sessão de testes
Base.metadata.create_all(bind=engine)

# Override de dependência do FastAPI para usar a sessão de teste
app.dependency_overrides[get_db] = override_get_db


def get_client() -> TestClient:
    return TestClient(app)

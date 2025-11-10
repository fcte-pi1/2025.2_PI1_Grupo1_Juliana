from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Numeric,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import INTERVAL as PGInterval

from app.config.database import Base


class Execution(Base):
    __tablename__ = "execucao"

    id_execucao = Column(Integer, primary_key=True, index=True)
    id_carrinho = Column(Integer, ForeignKey("carrinho.id_carrinho"), nullable=False)
    id_circuito = Column(Integer, ForeignKey("circuito.id_circuito"), nullable=False)
    data_inicio = Column(DateTime(timezone=True))
    data_fim = Column(DateTime(timezone=True))
    status = Column(String(50))
    # Substituído por String para compatibilidade com SQLite em dev.
    # Em Postgres, pode-se usar INTERVAL. Para portabilidade, manteremos string aqui.
    tempo_estimado = Column(String(50))

    logs = relationship(
        "ExecutionLog",
        back_populates="execution",
        cascade="all, delete-orphan"
    )


class ExecutionLog(Base):
    __tablename__ = "execucao_log"

    id_log = Column(Integer, primary_key=True, index=True)
    id_execucao = Column(Integer, ForeignKey("execucao.id_execucao"), nullable=False)
    timestamp = Column("timestamp", DateTime(timezone=True), server_default=func.now())
    posicao_atual = Column(String(255))
    velocidade = Column(Numeric(10, 2))
    posicao_x = Column(Numeric(10, 2))
    posicao_y = Column(Numeric(10, 2))
    orientacao = Column(Numeric(10, 2))
    observacao = Column(Text)

    execution = relationship("Execution", back_populates="logs")

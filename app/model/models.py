from sqlalchemy import (
    Column, Integer, String, ForeignKey
)
from sqlalchemy.orm import relationship
from app.config.database import Base 


# --- Novos modelos alinhados ao schema do Supabase ---
class Circuito(Base):
    __tablename__ = "circuito"

    id_circuito = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False)

    # Relacionamento com trechos do circuito
    trechos = relationship(
        "Trecho",
        back_populates="circuito",
        cascade="all, delete-orphan",
        order_by="Trecho.ordem",
    )


class Trecho(Base):
    __tablename__ = "trecho"

    id_trecho = Column(Integer, primary_key=True, index=True)
    id_circuito = Column(Integer, ForeignKey("circuito.id_circuito"), nullable=False)
    ordem = Column(Integer, nullable=False)
    comando = Column(String(100))
    parametro = Column(String(255))

    circuito = relationship("Circuito", back_populates="trechos")


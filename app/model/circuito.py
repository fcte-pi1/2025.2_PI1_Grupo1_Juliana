from pydantic import BaseModel, Field
from typing import List, Optional


class TrechoCreate(BaseModel):
    comando: str = Field(..., description="Tipo de comando, ex: move/rotate/release")
    parametro: float = Field(..., description="Parâmetro numérico, ex: ângulo em graus")
    ordem: int = Field(..., ge=0)


class TrechoRead(BaseModel):
    id_trecho: int
    comando: str
    parametro: float
    ordem: int

    class Config:
        from_attributes = True


class CircuitoCreate(BaseModel):
    nome: str
    trechos: List[TrechoCreate]


class CircuitoRead(BaseModel):
    id_circuito: int
    nome: str
    trechos: List[TrechoRead]

    class Config:
        from_attributes = True


class CircuitoStats(BaseModel):
    total_saved: int
    total_executed: int


# Updates
class CircuitoUpdate(BaseModel):
    nome: Optional[str] = None


class TrechoUpdate(BaseModel):
    comando: Optional[str] = None
    parametro: Optional[float] = None
    ordem: Optional[int] = Field(default=None, ge=0)

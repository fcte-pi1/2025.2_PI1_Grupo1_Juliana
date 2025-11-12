from pydantic import BaseModel, Field
from typing import Optional


class ExecutionStart(BaseModel):
    id_circuito: int
    id_carrinho: int
    tempo_estimado: Optional[str] = Field(
        default=None, description="Duração estimada livre, ex: '5m', '00:10:00'"
    )


class ExecutionLogCreate(BaseModel):
    posicao_atual: Optional[str] = None
    velocidade: Optional[float] = None
    posicao_x: Optional[float] = None
    posicao_y: Optional[float] = None
    orientacao: Optional[float] = None
    observacao: Optional[str] = None


class ExecutionStatusUpdate(BaseModel):
    status: str = Field(pattern=r"^(running|completed|error|stopped)$")

from sqlalchemy.orm import Session
from app.model.execution import Execution, ExecutionLog
from app.model.models import Circuito
from app.model.carrinho_model import CarrinhoORM
from typing import Iterable, Optional, List
from datetime import datetime
import csv
import io

CSV_COLUMNS = [
    "id_log",
    "timestamp",
    "posicao_atual",
    "velocidade",
    "posicao_x",
    "posicao_y",
    "orientacao",
    "observacao",
]


def get_execution_logs(db: Session, id_execucao: int) -> list[ExecutionLog]:
    """Retorna todos os logs de uma execução ordenados por timestamp."""
    return (
        db.query(ExecutionLog)
        .filter(ExecutionLog.id_execucao == id_execucao)
        .order_by(ExecutionLog.timestamp.asc())
        .all()
    )


def logs_to_csv(logs: Iterable[ExecutionLog]) -> str:
    """Converte uma lista de logs em CSV (string)."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)
    for log in logs:
        writer.writerow([
            log.id_log,
            log.timestamp.isoformat() if log.timestamp else "",
            log.posicao_atual or "",
            f"{log.velocidade}" if log.velocidade is not None else "",
            f"{log.posicao_x}" if log.posicao_x is not None else "",
            f"{log.posicao_y}" if log.posicao_y is not None else "",
            f"{log.orientacao}" if log.orientacao is not None else "",
            (log.observacao or "").replace("\n", " "),
        ])
    return output.getvalue()


# ----------------- Listagem e detalhes -----------------
def list_executions(db: Session, status: Optional[str] = None, limit: int = 50, offset: int = 0) -> List[Execution]:
    q = db.query(Execution).order_by(Execution.id_execucao.desc())
    if status:
        q = q.filter(Execution.status == status)
    return q.offset(offset).limit(min(limit, 200)).all()


def get_recent_logs(db: Session, id_execucao: int, limit: int = 100) -> List[ExecutionLog]:
    return (
        db.query(ExecutionLog)
        .filter(ExecutionLog.id_execucao == id_execucao)
        .order_by(ExecutionLog.timestamp.desc())
        .limit(min(limit, 1000))
        .all()
    )


def execution_to_dict(e: Execution) -> dict:
    return {
        "id_execucao": e.id_execucao,
        "id_carrinho": e.id_carrinho,
        "id_circuito": e.id_circuito,
        "data_inicio": e.data_inicio,
        "data_fim": e.data_fim,
        "status": e.status,
        "tempo_estimado": e.tempo_estimado,
    }


def log_to_dict(l: ExecutionLog) -> dict:
    return {
        "id_log": l.id_log,
        "id_execucao": l.id_execucao,
        "timestamp": l.timestamp,
        "posicao_atual": l.posicao_atual,
        "velocidade": float(l.velocidade) if l.velocidade is not None else None,
        "posicao_x": float(l.posicao_x) if l.posicao_x is not None else None,
        "posicao_y": float(l.posicao_y) if l.posicao_y is not None else None,
        "orientacao": float(l.orientacao) if l.orientacao is not None else None,
        "observacao": l.observacao,
    }


def get_execution_summary(db: Session, id_execucao: int) -> Optional[dict]:
    e = db.query(Execution).filter(Execution.id_execucao == id_execucao).first()
    if not e:
        return None
    total_logs = db.query(ExecutionLog).filter(ExecutionLog.id_execucao == id_execucao).count()
    last_log = (
        db.query(ExecutionLog)
        .filter(ExecutionLog.id_execucao == id_execucao)
        .order_by(ExecutionLog.timestamp.desc())
        .first()
    )
    data = execution_to_dict(e)
    data.update({
        "total_logs": total_logs,
        "ultimo_log": log_to_dict(last_log) if last_log else None,
    })
    return data


# ----------------- Funções de criação/execução -----------------
def get_or_create_carrinho_simulado(db: Session, nome: str = "Carrinho Simulado") -> CarrinhoORM:
    carrinho = db.query(CarrinhoORM).filter(CarrinhoORM.nome == nome).first()
    if carrinho:
        return carrinho
    carrinho = CarrinhoORM(nome=nome)
    db.add(carrinho)
    db.commit()
    db.refresh(carrinho)
    return carrinho


def get_or_create_circuito_simulado(db: Session, nome: str = "Circuito Simulado") -> Circuito:
    circuito = db.query(Circuito).filter(Circuito.nome == nome).first()
    if circuito:
        return circuito
    circuito = Circuito(nome=nome)
    db.add(circuito)
    db.commit()
    db.refresh(circuito)
    return circuito


def create_execution(db: Session, id_carrinho: int, id_circuito: int, status: str = "running") -> Execution:
    execution = Execution(
        id_carrinho=id_carrinho,
        id_circuito=id_circuito,
        data_inicio=datetime.now().astimezone(),
        status=status,
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)
    return execution


def add_execution_log(
    db: Session,
    id_execucao: int,
    posicao_atual: Optional[str] = None,
    velocidade: Optional[float] = None,
    posicao_x: Optional[float] = None,
    posicao_y: Optional[float] = None,
    orientacao: Optional[float] = None,
    observacao: Optional[str] = None,
) -> ExecutionLog:
    log = ExecutionLog(
        id_execucao=id_execucao,
        posicao_atual=posicao_atual,
        velocidade=velocidade,
        posicao_x=posicao_x,
        posicao_y=posicao_y,
        orientacao=orientacao,
        observacao=observacao,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def finish_execution(db: Session, id_execucao: int, status: str = "completed") -> Execution:
    execution = db.query(Execution).filter(Execution.id_execucao == id_execucao).first()
    if not execution:
        return None
    execution.data_fim = datetime.now().astimezone()
    execution.status = status
    db.commit()
    db.refresh(execution)
    return execution


def simulate_run(db: Session, steps: int = 5) -> Execution:
    """Cria carrinho e circuito simulados, inicia uma execução e registra logs de telemetria."""
    carrinho = get_or_create_carrinho_simulado(db)
    circuito = get_or_create_circuito_simulado(db)
    execution = create_execution(db, carrinho.id_carrinho, circuito.id_circuito, status="running")

    for i in range(steps):
        x = float(i)
        y = float(i) * 0.5
        orient = float(i) * 15.0
        vel = 1.0 + i * 0.1
        add_execution_log(
            db,
            id_execucao=execution.id_execucao,
            posicao_atual=f"Ponto {i}",
            velocidade=vel,
            posicao_x=x,
            posicao_y=y,
            orientacao=orient,
            observacao="simulado",
        )

    finish_execution(db, execution.id_execucao, status="completed")
    return execution

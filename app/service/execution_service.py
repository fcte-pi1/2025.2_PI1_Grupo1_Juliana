from sqlalchemy.orm import Session
from app.model.execution import Execution, ExecutionLog
from app.model.models import Circuito
from app.model.carrinho_model import CarrinhoORM
from typing import Iterable, Optional, List
from datetime import datetime
from app.model.execution_payloads import (
    ExecutionStart,
    ExecutionLogCreate,
    ExecutionStatusUpdate,
)
from io import BytesIO
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
def list_executions(
    db: Session,
    status: Optional[str] = None,
    id_circuito: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Execution]:
    q = db.query(Execution).order_by(Execution.id_execucao.desc())
    if status:
        q = q.filter(Execution.status == status)
    if id_circuito is not None:
        q = q.filter(Execution.id_circuito == id_circuito)
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


def create_execution(
    db: Session,
    id_carrinho: int,
    id_circuito: int,
    status: str = "running",
    tempo_estimado: Optional[str] = None,
) -> Execution:
    execution = Execution(
        id_carrinho=id_carrinho,
        id_circuito=id_circuito,
        data_inicio=datetime.now().astimezone(),
        status=status,
        tempo_estimado=tempo_estimado or "",
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


# ----------------- Execução "real" (controlada pelo carrinho) -----------------
def start_real_execution(db: Session, payload: ExecutionStart) -> dict:
    execution = create_execution(
        db,
        id_carrinho=payload.id_carrinho,
        id_circuito=payload.id_circuito,
        status="running",
        tempo_estimado=payload.tempo_estimado,
    )
    return {
        "id_execucao": execution.id_execucao,
        "status": execution.status,
        "data_inicio": execution.data_inicio,
    }


def add_real_log(db: Session, id_execucao: int, payload: ExecutionLogCreate) -> dict:
    log = add_execution_log(
        db,
        id_execucao=id_execucao,
        posicao_atual=payload.posicao_atual,
        velocidade=payload.velocidade,
        posicao_x=payload.posicao_x,
        posicao_y=payload.posicao_y,
        orientacao=payload.orientacao,
        observacao=payload.observacao,
    )
    return {"id_log": log.id_log, "timestamp": log.timestamp}


def update_execution_status(db: Session, id_execucao: int, payload: ExecutionStatusUpdate) -> Optional[dict]:
    execution = db.query(Execution).filter(Execution.id_execucao == id_execucao).first()
    if not execution:
        return None
    execution.status = payload.status
    if payload.status in ("completed", "error", "stopped"):
        execution.data_fim = datetime.now().astimezone()
    db.commit()
    db.refresh(execution)
    return {
        "id_execucao": execution.id_execucao,
        "status": execution.status,
        "data_fim": execution.data_fim,
    }


def stop_execution(db: Session, id_execucao: int) -> Optional[dict]:
    return update_execution_status(db, id_execucao, ExecutionStatusUpdate(status="stopped"))


def generate_route_plot(db: Session, id_execucao: int) -> Optional[bytes]:
    """
    Gera um gráfico PNG do percurso (posicao_x vs posicao_y) para uma execução.
    Retorna bytes do PNG ou None se não houver dados suficientes.
    """
    # Import lazy para evitar dependência em caminhos que não usam o gráfico
    try:
        import matplotlib
        matplotlib.use("Agg")  # backend headless
        import matplotlib.pyplot as plt
    except Exception:  # pragma: no cover - fallback se matplotlib não estiver instalado
        return None

    logs = (
        db.query(ExecutionLog)
        .filter(ExecutionLog.id_execucao == id_execucao)
        .order_by(ExecutionLog.timestamp.asc())
        .all()
    )
    xs: List[float] = []
    ys: List[float] = []
    for l in logs:
        if l.posicao_x is not None and l.posicao_y is not None:
            # Numeric pode vir como Decimal; converter para float
            try:
                xs.append(float(l.posicao_x))
                ys.append(float(l.posicao_y))
            except Exception:
                continue

    if len(xs) < 2:
        return None

    fig, ax = plt.subplots(figsize=(6, 6))
    ax.plot(xs, ys, "-o", linewidth=2, markersize=3, color="#1f77b4")
    ax.set_title(f"Percurso Execução {id_execucao}")
    ax.set_xlabel("Posição X")
    ax.set_ylabel("Posição Y")
    ax.grid(True, linestyle=":", alpha=0.5)
    # marca início e fim
    ax.scatter([xs[0]], [ys[0]], c="green", s=60, label="Início")
    ax.scatter([xs[-1]], [ys[-1]], c="red", s=60, label="Fim")
    ax.legend(loc="best")
    ax.axis("equal")

    buf = BytesIO()
    fig.tight_layout()
    plt.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()


# ----------------- Utilidades -----------------
def has_running_execution_for_cart(db: Session, id_carrinho: int) -> bool:
    return (
        db.query(Execution)
        .filter(Execution.id_carrinho == id_carrinho, Execution.status == "running")
        .first()
        is not None
    )

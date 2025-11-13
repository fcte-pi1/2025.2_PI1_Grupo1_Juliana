from sqlalchemy.orm import Session
from app.model.execution import Execution, ExecutionLog
from app.model.models import Circuito, Trecho
import math
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
        tempo_estimado=tempo_estimado,
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


def _parse_param(raw: Optional[str]) -> float:
    if raw is None:
        return 0.0
    try:
        return float(raw)
    except Exception:
        try:
            return float(str(raw))
        except Exception:
            return 0.0


def simulate_circuit_execution(db: Session, id_circuito: int, steps_per_move: int = 10) -> Optional[Execution]:
    
    circuito = db.query(Circuito).filter(Circuito.id_circuito == id_circuito).first()
    if not circuito:
        return None

    carrinho = get_or_create_carrinho_simulado(db)
    execution = create_execution(db, carrinho.id_carrinho, circuito.id_circuito, status="running")

    # Posição inicial (origem) e orientação em graus (0 = eixo X positivo)
    x = 0.0
    y = 0.0
    orient = 0.0

    # Buscar trechos ordenados
    trechos = (
        db.query(Trecho)
        .filter(Trecho.id_circuito == circuito.id_circuito)
        .order_by(Trecho.ordem.asc())
        .all()
    )

    for t in trechos:
        cmd = (t.comando or "").strip().lower()
        param = _parse_param(t.parametro)

        if cmd in ("move", "forward", "advance"):
            distance = float(param)
            # interpolar passos ao longo do segmento
            for step in range(1, max(1, steps_per_move) + 1):
                frac = step / max(1, steps_per_move)
                dx = math.cos(math.radians(orient)) * (distance * frac)
                dy = math.sin(math.radians(orient)) * (distance * frac)
                px = x + dx
                py = y + dy
                vel = None
                add_execution_log(
                    db,
                    id_execucao=execution.id_execucao,
                    posicao_atual=f"{cmd} {t.ordem} step {step}",
                    velocidade=vel,
                    posicao_x=px,
                    posicao_y=py,
                    orientacao=orient,
                    observacao=f"trecho {t.ordem} move",
                )
            # atualizar posição final
            x = x + math.cos(math.radians(orient)) * distance
            y = y + math.sin(math.radians(orient)) * distance

        elif cmd in ("rotate", "turn"):
            # alterar orientação
            orient = (orient + float(param)) % 360.0
            # registrar um log com nova orientação (posição inalterada)
            add_execution_log(
                db,
                id_execucao=execution.id_execucao,
                posicao_atual=f"{cmd} {t.ordem}",
                velocidade=None,
                posicao_x=x,
                posicao_y=y,
                orientacao=orient,
                observacao=f"trecho {t.ordem} rotate",
            )

        else:
            # comandos desconhecidos: registrar observação e seguir
            add_execution_log(
                db,
                id_execucao=execution.id_execucao,
                posicao_atual=f"{cmd} {t.ordem}",
                velocidade=None,
                posicao_x=x,
                posicao_y=y,
                orientacao=orient,
                observacao=f"trecho {t.ordem} comando desconhecido: {t.comando}",
            )

    finish_execution(db, execution.id_execucao, status="completed")
    return execution


def create_and_run_sample_circuit(db: Session, nome: str = "Circuito Demo", steps_per_move: int = 10) -> Execution:
    """Cria um circuito de exemplo (trechos) e executa simulate_circuit_execution.
    Retorna a execution criada.
    """
    # criar circuito
    circuito = Circuito(nome=nome)
    db.add(circuito)
    db.flush()

    # Exemplo: move 5, rotate 90, move 5, rotate -90, move 3
    sample = [
        (0, "move", 5.0),
        (1, "rotate", 90.0),
        (2, "move", 5.0),
        (3, "rotate", -90.0),
        (4, "move", 3.0),
    ]
    trechos = []
    for ordem, comando, parametro in sample:
        tr = Trecho(id_circuito=circuito.id_circuito, ordem=ordem, comando=comando, parametro=str(parametro))
        trechos.append(tr)
    db.add_all(trechos)
    db.commit()
    db.refresh(circuito)

    # executar circuito
    return simulate_circuit_execution(db, circuito.id_circuito, steps_per_move=steps_per_move)


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


def generate_route_realistic_plot(db: Session, id_execucao: int, arrow_scale: float = 0.5, arrow_step: int = 1) -> Optional[bytes]:
    """
    Gera um mapa mais 'realista' do circuito: plota a trajetória e desenha setas indicando
    a orientação do carrinho em cada ponto (ou a cada `arrow_step` pontos).
    - arrow_scale controla o comprimento das setas em unidades do gráfico.
    - arrow_step desenha uma seta a cada N pontos para evitar poluição visual.
    Retorna bytes PNG ou None se não houver dados suficientes.
    """
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np
    except Exception:
        return None

    logs = (
        db.query(ExecutionLog)
        .filter(ExecutionLog.id_execucao == id_execucao)
        .order_by(ExecutionLog.timestamp.asc())
        .all()
    )
    xs: List[float] = []
    ys: List[float] = []
    thetas: List[float] = []
    for l in logs:
        if l.posicao_x is not None and l.posicao_y is not None:
            try:
                xs.append(float(l.posicao_x))
                ys.append(float(l.posicao_y))

                thetas.append(float(l.orientacao) if l.orientacao is not None else 0.0)
            except Exception:
                continue

    if len(xs) < 2:
        return None

    fig, ax = plt.subplots(figsize=(8, 6))

    ax.plot(xs, ys, '-', linewidth=2, color='#1f77b4', label='Trajetória')

    xs_arr = np.array(xs)
    ys_arr = np.array(ys)
    thetas_rad = np.deg2rad(np.array(thetas))
    u = np.cos(thetas_rad)
    v = np.sin(thetas_rad)

    idxs = list(range(0, len(xs), max(1, arrow_step)))
    ax.quiver(xs_arr[idxs], ys_arr[idxs], u[idxs], v[idxs], angles='xy', scale_units='xy', scale=1/arrow_scale, width=0.004, color='orange')

    ax.scatter([xs[0]], [ys[0]], c='green', s=80, label='Início')
    ax.scatter([xs[-1]], [ys[-1]], c='red', s=80, label='Fim')

    ax.set_title(f"Mapa Realista - Execução {id_execucao}")
    ax.set_xlabel('Distância X')
    ax.set_ylabel('Distância Y')
    ax.grid(True, linestyle=':', alpha=0.5)
    ax.legend(loc='best')
    ax.axis('equal')

    buf = BytesIO()
    fig.tight_layout()
    plt.savefig(buf, format='png')
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()


def generate_circuit_map(db: Session, id_execucao: int) -> Optional[bytes]:
   
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception:
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
            try:
                xs.append(float(l.posicao_x))
                ys.append(float(l.posicao_y))
            except Exception:
                continue

    if len(xs) < 2:
        return None

    # Calcular tamanho dinâmico da figura baseado no alcance dos dados
    x_range = max(xs) - min(xs)
    y_range = max(ys) - min(ys)
    max_range = max(x_range, y_range, 8.0)  # mínimo de 8 para não ficar muito pequeno
    
    # Ajustar tamanho da figura proporcionalmente
    fig_size = max(8, min(16, max_range / 2 + 2))
    fig, ax = plt.subplots(figsize=(fig_size, fig_size))

    ax.plot(xs, ys, linewidth=2.5, color='#1f77b4', label='Trajetória do Circuito')

    ax.scatter([xs[0]], [ys[0]], c='green', s=100, marker='o', label='Início', zorder=5)
    ax.scatter([xs[-1]], [ys[-1]], c='red', s=100, marker='s', label='Fim', zorder=5)

    ax.set_title(f'Mapa do Circuito - Execução {id_execucao}', fontsize=14, fontweight='bold')
    ax.set_xlabel('Posição X (m)', fontsize=12)
    ax.set_ylabel('Posição Y (m)', fontsize=12)
    ax.grid(True, linestyle='--', alpha=0.6)
    ax.legend(loc='best', fontsize=10)
    ax.axis('equal')

    buf = BytesIO()
    fig.tight_layout()
    plt.savefig(buf, format='png', dpi=150)
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()

def has_running_execution_for_cart(db: Session, id_carrinho: int) -> bool:
    return (
        db.query(Execution)
        .filter(Execution.id_carrinho == id_carrinho, Execution.status == "running")
        .first()
        is not None
    )

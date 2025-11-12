from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.model.execution import Execution
from app.model.execution_payloads import (
    ExecutionStart,
    ExecutionLogCreate,
    ExecutionStatusUpdate,
)
from app.model.models import Circuito
from app.model.carrinho_model import CarrinhoORM
from app.service import execution_service


router = APIRouter(
    prefix="/execucoes",
    tags=["Execucoes"],
)


@router.get("/{id_execucao}/export/csv")
def export_execution_logs_csv(id_execucao: int, db: Session = Depends(get_db)):
    """
    Exporta os dados de telemetria (execucao_log) em formato CSV para uma execução específica.
    """
    execution = db.query(Execution).filter(Execution.id_execucao == id_execucao).first()
    if execution is None:
        raise HTTPException(status_code=404, detail="Execução não encontrada")

    logs = execution_service.get_execution_logs(db=db, id_execucao=id_execucao)
    csv_content = execution_service.logs_to_csv(logs)

    filename = f"execucao_{id_execucao}_logs.csv"
    headers = {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": f"attachment; filename={filename}",
    }
    return Response(content=csv_content, media_type="text/csv", headers=headers)


@router.post("/simulate", status_code=201)
def simulate_execution(db: Session = Depends(get_db)):
    """Endpoint para rodar uma execução simulada e retornar a execução e quantidade de logs."""
    execution = execution_service.simulate_run(db, steps=8)
    logs = execution_service.get_execution_logs(db, execution.id_execucao)
    return {
        "id_execucao": execution.id_execucao,
        "status": execution.status,
        "data_inicio": execution.data_inicio,
        "data_fim": execution.data_fim,
        "total_logs": len(logs)
    }


# ----------------- Endpoints de execução real -----------------
@router.post("/", status_code=201)
def start_execution(payload: ExecutionStart, db: Session = Depends(get_db)):
    # valida se circuito e carrinho existem
    if not db.query(Circuito).filter_by(id_circuito=payload.id_circuito).first():
        raise HTTPException(status_code=404, detail="Circuito não encontrado")
    if not db.query(CarrinhoORM).filter_by(id_carrinho=payload.id_carrinho).first():
        raise HTTPException(status_code=404, detail="Carrinho não encontrado")
    # evita duas execuções simultâneas para o mesmo carrinho
    if execution_service.has_running_execution_for_cart(db, payload.id_carrinho):
        raise HTTPException(status_code=409, detail="Carrinho já possui uma execução em andamento")
    result = execution_service.start_real_execution(db, payload)
    return result


@router.post("/{id_execucao}/logs", status_code=201)
def ingest_log(id_execucao: int, payload: ExecutionLogCreate, db: Session = Depends(get_db)):
    if not db.query(Execution).filter_by(id_execucao=id_execucao).first():
        raise HTTPException(status_code=404, detail="Execução não encontrada")
    result = execution_service.add_real_log(db, id_execucao, payload)
    return result


@router.patch("/{id_execucao}/status")
def patch_status(id_execucao: int, payload: ExecutionStatusUpdate, db: Session = Depends(get_db)):
    result = execution_service.update_execution_status(db, id_execucao, payload)
    if result is None:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
    return result


@router.post("/{id_execucao}/stop")
def stop_execution(id_execucao: int, db: Session = Depends(get_db)):
    result = execution_service.stop_execution(db, id_execucao)
    if result is None:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
    return result


@router.get("/")
def list_executions(
    status: str | None = Query(default=None),
    id_circuito: int | None = Query(default=None, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    executions = execution_service.list_executions(
        db,
        status=status,
        id_circuito=id_circuito,
        limit=limit,
        offset=offset,
    )
    return [execution_service.execution_to_dict(e) for e in executions]


@router.get("/{id_execucao}")
def get_execution(id_execucao: int, db: Session = Depends(get_db)):
    summary = execution_service.get_execution_summary(db, id_execucao)
    if not summary:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
    return summary


@router.get("/{id_execucao}/logs")
def get_execution_logs_endpoint(
    id_execucao: int,
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    # Retorna logs mais recentes primeiro
    logs = execution_service.get_recent_logs(db, id_execucao=id_execucao, limit=limit)
    return [execution_service.log_to_dict(l) for l in logs]


@router.get("/{id_execucao}/graph")
def get_execution_graph(id_execucao: int, db: Session = Depends(get_db)):
    png_bytes = execution_service.generate_route_plot(db, id_execucao)
    if png_bytes is None:
        raise HTTPException(status_code=400, detail="Dados insuficientes para gerar gráfico (necessário posicao_x e posicao_y)")
    return StreamingResponse(iter([png_bytes]), media_type="image/png")

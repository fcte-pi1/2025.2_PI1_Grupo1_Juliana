from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.config.database import get_db
from app.model.circuito import (
    CircuitoCreate, CircuitoRead, CircuitoStats,
    CircuitoUpdate, TrechoUpdate, TrechoRead
)
from app.service import circuito_service

router = APIRouter(
    prefix="/circuitos",
    tags=["Circuitos"],
)


@router.post("/", response_model=CircuitoRead, status_code=201)
def create_circuito_endpoint(data: CircuitoCreate, db: Session = Depends(get_db)):
    return circuito_service.create_circuito(db=db, data=data)


@router.get("/", response_model=List[CircuitoRead])
def list_circuitos(db: Session = Depends(get_db)):
    return circuito_service.get_all_circuitos(db=db)


@router.get("/stats", response_model=CircuitoStats)
def circuito_stats(db: Session = Depends(get_db)):
    return circuito_service.get_circuito_stats(db=db)


@router.patch("/{id_circuito}", response_model=CircuitoRead)
def patch_circuito(id_circuito: int, data: CircuitoUpdate, db: Session = Depends(get_db)):
    updated = circuito_service.update_circuito(db, id_circuito=id_circuito, data=data)
    if not updated:
        raise HTTPException(status_code=404, detail="Circuito não encontrado")
    return updated


@router.delete("/{id_circuito}", status_code=204)
def remove_circuito(id_circuito: int, db: Session = Depends(get_db)):
    ok = circuito_service.delete_circuito(db, id_circuito=id_circuito)
    if not ok:
        raise HTTPException(status_code=404, detail="Circuito não encontrado")
    return None


@router.patch("/trechos/{id_trecho}", response_model=TrechoRead)
def patch_trecho(id_trecho: int, data: TrechoUpdate, db: Session = Depends(get_db)):
    updated = circuito_service.update_trecho(db, id_trecho=id_trecho, data=data)
    if not updated:
        raise HTTPException(status_code=404, detail="Trecho não encontrado")
    return updated


@router.delete("/trechos/{id_trecho}", status_code=204)
def remove_trecho(id_trecho: int, db: Session = Depends(get_db)):
    ok = circuito_service.delete_trecho(db, id_trecho=id_trecho)
    if not ok:
        raise HTTPException(status_code=404, detail="Trecho não encontrado")
    return None

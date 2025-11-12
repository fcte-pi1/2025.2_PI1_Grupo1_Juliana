from sqlalchemy.orm import Session
from typing import List, Optional
from app.model.models import Circuito, Trecho
from app.model.circuito import (
    CircuitoCreate, CircuitoRead, TrechoRead, CircuitoStats,
    CircuitoUpdate, TrechoUpdate
)


def create_circuito(db: Session, data: CircuitoCreate) -> CircuitoRead:
    c = Circuito(nome=data.nome)
    db.add(c)
    db.flush()
    trechos_orm: List[Trecho] = []
    for t in data.trechos:
        trechos_orm.append(
            Trecho(
                id_circuito=c.id_circuito,
                ordem=t.ordem,
                comando=t.comando,
                parametro=str(t.parametro),
            )
        )
    db.add_all(trechos_orm)
    db.commit()
    db.refresh(c)
    return circuito_to_read(c, trechos_orm)


def get_all_circuitos(db: Session) -> List[CircuitoRead]:
    circuitos = db.query(Circuito).order_by(Circuito.id_circuito.desc()).all()
    result: List[CircuitoRead] = []
    for c in circuitos:
        trechos = (
            db.query(Trecho)
            .filter(Trecho.id_circuito == c.id_circuito)
            .order_by(Trecho.ordem.asc())
            .all()
        )
        result.append(circuito_to_read(c, trechos))
    return result


def get_circuito_stats(db: Session) -> CircuitoStats:
    total_saved = db.query(Circuito).count()
    total_executed = 0  # pode derivar de execucao futuramente
    return CircuitoStats(total_saved=total_saved, total_executed=total_executed)


def circuito_to_read(c: Circuito, trechos: List[Trecho]) -> CircuitoRead:
    return CircuitoRead(
        id_circuito=c.id_circuito,
        nome=c.nome,
        trechos=[
            TrechoRead(
                id_trecho=t.id_trecho,
                comando=t.comando,
                parametro=_safe_float(t.parametro),
                ordem=t.ordem,
            )
            for t in trechos
        ],
    )


def _safe_float(raw: str | None) -> float:
    if raw is None:
        return 0.0
    try:
        return float(raw)
    except ValueError:
        return 0.0


# ---------- Updates / Deletes ----------
def update_circuito(db: Session, id_circuito: int, data: CircuitoUpdate) -> Optional[CircuitoRead]:
    c = db.query(Circuito).filter(Circuito.id_circuito == id_circuito).first()
    if not c:
        return None
    changed = False
    if data.nome is not None:
        c.nome = data.nome
        changed = True
    if changed:
        db.commit()
        db.refresh(c)
    trechos = db.query(Trecho).filter(Trecho.id_circuito == id_circuito).order_by(Trecho.ordem.asc()).all()
    return circuito_to_read(c, trechos)


def update_trecho(db: Session, id_trecho: int, data: TrechoUpdate) -> Optional[TrechoRead]:
    t = db.query(Trecho).filter(Trecho.id_trecho == id_trecho).first()
    if not t:
        return None
    changed = False
    if data.comando is not None:
        t.comando = data.comando
        changed = True
    if data.parametro is not None:
        t.parametro = str(data.parametro)
        changed = True
    if data.ordem is not None:
        t.ordem = data.ordem
        changed = True
    if changed:
        db.commit()
        db.refresh(t)
    return TrechoRead(
        id_trecho=t.id_trecho,
        comando=t.comando,
        parametro=_safe_float(t.parametro),
        ordem=t.ordem,
    )


def delete_circuito(db: Session, id_circuito: int) -> bool:
    c = db.query(Circuito).filter(Circuito.id_circuito == id_circuito).first()
    if not c:
        return False
    db.delete(c)
    db.commit()
    return True


def delete_trecho(db: Session, id_trecho: int) -> bool:
    t = db.query(Trecho).filter(Trecho.id_trecho == id_trecho).first()
    if not t:
        return False
    db.delete(t)
    db.commit()
    return True

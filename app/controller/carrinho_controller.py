from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..config.database import get_db
from app.service import carrinho_service
from app.model import carrinho_model

router = APIRouter(
    prefix="/carrinho",
    tags=["Carrinho"]
)

@router.post("/", response_model=carrinho_model.Carrinho)
def create_item_endpoint(carrinho: carrinho_model.CarrinhoCreate, db: Session = Depends(get_db)):
    """Rota para criar um novo Item."""
    return carrinho_service.create_item(db=db, carrinho_data=carrinho)


@router.get("/{carrinho_id}", response_model=carrinho_model.Carrinho)
def read_item_endpoint(carrinho_id: int, db: Session = Depends(get_db)):
    """Rota para ler um Item pelo ID."""
    db_item = carrinho_service.get_item(db=db, id_carrinho=carrinho_id)
    
    if db_item is None:
        raise HTTPException(status_code=404, detail="Carrinho não encontrado!")

    return db_item
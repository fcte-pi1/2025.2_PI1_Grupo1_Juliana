from sqlalchemy.orm import Session
from app.model import carrinho_model

def get_item(db: Session, id_carrinho: int):
    """Busca um item pelo ID."""
    return db.query(carrinho_model.CarrinhoORM).filter(carrinho_model.CarrinhoORM.id_carrinho == id_carrinho).first()

def create_item(db: Session, carrinho_data: carrinho_model.CarrinhoCreate):
    """Cria um novo item no BD."""
    db_carrinho = carrinho_model.CarrinhoORM(**carrinho_data.dict())
    
    db.add(db_carrinho)
    db.commit()
    db.refresh(db_carrinho)
    return db_carrinho

def get_all_items(db: Session, skip: int = 0, limit: int = 100):
    """Retorna uma lista de todos os itens."""
    return db.query(carrinho_model.CarrinhoORM).offset(skip).limit(limit).all()
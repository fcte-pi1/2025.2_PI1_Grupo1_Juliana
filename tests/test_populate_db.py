
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

from app.config.database import Base
from app.model.models import Circuito, Trecho
from app.service.execution_service import (
    simulate_circuit_execution,
    get_or_create_carrinho_simulado,
)


def test_create_and_save_circuit_to_supabase():
    
    # Conectar ao banco Supabase via variável de ambiente
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL não está configurada no arquivo .env")
    
    print(f"Conectando ao banco Supabase...")
    engine = create_engine(database_url)
    
    # Garantir que as tabelas existem
    Base.metadata.create_all(bind=engine)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        
        circuito = Circuito(nome="Teste")
        db.add(circuito)
        db.flush()
        
        
        sample_trechos = [
            (0, "move", 5.0),
            (1, "rotate", 45.0),
            (2, "move", 4.0),
            (3, "rotate", 12.0),
            (4, "move", 7.0),
            (5, "rotate", -60.0),
            (6, "move", 2.5),
            (7, "rotate", 90.0),
            (8, "move", 6.0),
            (9, "rotate", -45.0),
            (10, "move", 3.5),
        ]
        
        trechos = []
        for ordem, comando, parametro in sample_trechos:
            tr = Trecho(
                id_circuito=circuito.id_circuito,
                ordem=ordem,
                comando=comando,
                parametro=str(parametro),
            )
            trechos.append(tr)
        
        db.add_all(trechos)
        db.commit()
        db.refresh(circuito)
        
        print(f"Circuito criado: id={circuito.id_circuito}, nome={circuito.nome}")
        
        # Verificar que o circuito foi salvo no banco
        saved_circuito = db.query(Circuito).filter(Circuito.id_circuito == circuito.id_circuito).first()
        assert saved_circuito is not None, "Circuito não foi salvo no banco"
        print(f"✓ Circuito verificado no banco: {saved_circuito.nome}")
        
        # Verificar trechos foram salvos
        saved_trechos = db.query(Trecho).filter(Trecho.id_circuito == circuito.id_circuito).all()
        assert len(saved_trechos) == len(sample_trechos), f"Esperava {len(sample_trechos)} trechos, encontrou {len(saved_trechos)}"
        print(f"✓ {len(saved_trechos)} trechos salvos no banco")
        
        # Executar a simulação do circuito
        execution = simulate_circuit_execution(
            db, circuito.id_circuito, steps_per_move=10
        )
        
        assert execution is not None, "Execução não foi criada"
        print(f"Execução criada: id={execution.id_execucao}")
        
        # Fazer commit para garantir que tudo foi salvo
        db.commit()
        
        # Verificar que há logs
        from app.model.execution import ExecutionLog
        log_count = db.query(ExecutionLog).filter(
            ExecutionLog.id_execucao == execution.id_execucao
        ).count()
        assert log_count > 0, "Nenhum log foi criado"
        print(f"Total de logs: {log_count}")
        
        print(f"✓ Todos os dados salvos no Supabase!")
        
    finally:
        db.close()


if __name__ == "__main__":
    test_create_and_save_circuit_to_supabase()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import os
import sys
import argparse
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.config.database import Base
from app.service.execution_service import (
    create_and_run_sample_circuit,
    generate_circuit_map,
)


def create_memory_session():
    
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)
    return TestingSessionLocal


def create_db_session(db_path: str = "./dev.db"):
    """Cria sessão conectada ao arquivo dev.db local."""
    if not os.path.exists(db_path):
        print(f"Erro: banco de dados {db_path} não encontrado.")
        sys.exit(1)
    db_url = f"sqlite:///{os.path.abspath(db_path)}"
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal


def create_supabase_session():
    """Cria sessão conectada ao Supabase via DATABASE_URL do .env."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL não está configurada no arquivo .env")
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal


def main():
    parser = argparse.ArgumentParser(description="Gera mapa a partir de uma execução.")
    parser.add_argument(
        "--id-execucao",
        type=int,
        default=4,
        help="ID da execução a plotar (padrão: 4). Se -1, cria circuito de exemplo.",
    )
    parser.add_argument(
        "--outfile",
        type=str,
        default=None,
        help="Nome do arquivo (padrão: Mapa_Execucao_<id>.png). Será salvo em ./mapas/",
    )
    parser.add_argument(
        "--use-local-db",
        action="store_true",
        help="Conectar ao dev.db local em vez de usar Supabase (padrão).",
    )
    args = parser.parse_args()

    # Criar pasta 'mapas' se não existir
    mapas_dir = os.path.join(os.getcwd(), "mapas")
    os.makedirs(mapas_dir, exist_ok=True)

    if args.use_local_db:
        print("Conectando ao banco local (dev.db)...")
        SessionLocal = create_db_session("./dev.db")
        db = SessionLocal()
        mode = "local"
    else:
        print("Conectando ao banco Supabase...")
        try:
            SessionLocal = create_supabase_session()
            db = SessionLocal()
            mode = "Supabase"
        except ValueError as e:
            print(f"Erro: {e}")
            print("Usando banco em memória como fallback...")
            SessionLocal = create_memory_session()
            db = SessionLocal()
            mode = "memoria"

    try:
        if args.id_execucao == -1:
            print("Criando circuito de exemplo e executando...")
            execution = create_and_run_sample_circuit(db, nome="Circuito Demo", steps_per_move=8)
            id_exec = execution.id_execucao
        else:
            id_exec = args.id_execucao
            print(f"Usando execução id={id_exec} do banco {mode}...")

        print(f"Gerando mapa do circuito para execução {id_exec}...")

        png = generate_circuit_map(db, id_exec)

        if not png:
            print(
                "Nenhuma imagem gerada. Verifique se o matplotlib está instalado ou se há dados suficientes."
            )
            sys.exit(2)

        # Definir nome do arquivo se não foi fornecido
        if args.outfile is None:
            filename = f"Mapa_Execucao_{id_exec}.png"
        else:
            filename = args.outfile

        out_path = os.path.join(mapas_dir, filename)
        with open(out_path, "wb") as f:
            f.write(png)

        print(f"Mapa gerado em: {out_path}")
    except Exception as e:
        print(f"Erro: {e}")
        sys.exit(1)
    finally:
        db.close()



if __name__ == "__main__":
    main()

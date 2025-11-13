from app.service.execution_service import (
    simulate_run,
    generate_route_plot,
    create_execution,
    get_or_create_carrinho_simulado,
    get_or_create_circuito_simulado,
)
from tests.conftest import TestingSessionLocal


def test_generate_route_plot_returns_png():
    db = TestingSessionLocal()
    try:
    
        execution = simulate_run(db, steps=5)

        png = generate_route_plot(db, execution.id_execucao)

        assert png is not None
        assert isinstance(png, (bytes, bytearray))
        
        assert len(png) > 100
    finally:
        db.close()


def test_generate_route_plot_insufficient_data_returns_none():
    db = TestingSessionLocal()
    try:
        
        carrinho = get_or_create_carrinho_simulado(db)
        circuito = get_or_create_circuito_simulado(db)
        execution = create_execution(db, carrinho.id_carrinho, circuito.id_circuito)

        img = generate_route_plot(db, execution.id_execucao)
        
        assert img is None
    finally:
        db.close()

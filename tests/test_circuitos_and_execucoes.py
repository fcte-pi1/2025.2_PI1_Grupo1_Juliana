from fastapi.testclient import TestClient
from tests.conftest import get_client


def test_criar_listar_circuito():
    client: TestClient = get_client()

    body = {
        "nome": "Circuito Teste Py",
        "trechos": [
            {"comando": "rotate", "parametro": 90, "ordem": 0},
            {"comando": "move", "parametro": 1.5, "ordem": 1},
        ],
    }
    r = client.post("/circuitos/", json=body)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["nome"].startswith("Circuito Teste Py")
    assert len(data["trechos"]) == 2

    r = client.get("/circuitos/")
    assert r.status_code == 200
    lst = r.json()
    assert isinstance(lst, list)
    assert any(c["nome"].startswith("Circuito Teste Py") for c in lst)


def test_simular_execucao_e_logs():
    client: TestClient = get_client()

    # Simula uma execução e verifica criação de logs
    r = client.post("/execucoes/simulate")
    assert r.status_code == 201, r.text
    sim = r.json()
    assert sim["status"] == "completed"
    assert sim["total_logs"] > 0

    exec_id = sim["id_execucao"]

    # Detalhe da execução
    r = client.get(f"/execucoes/{exec_id}")
    assert r.status_code == 200
    summary = r.json()
    assert summary["id_execucao"] == exec_id
    assert summary["total_logs"] == sim["total_logs"]

    # Logs recentes
    r = client.get(f"/execucoes/{exec_id}/logs?limit=5")
    assert r.status_code == 200
    logs = r.json()
    assert isinstance(logs, list)
    assert len(logs) > 0

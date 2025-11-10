from fastapi.testclient import TestClient

def test_create_carrinho_success(client):
    """
    Testa a criação de um novo carrinho (Happy Path)
    """
    test_payload = {
        "nome": "Carrinho de Teste"
    }
    
    response = client.post("/carrinho/", json=test_payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["nome"] == "Carrinho de Teste"
    assert "id_carrinho" in data

def test_get_carrinho_by_id(client):
    """
    Testa a busca de um carrinho por ID
    """
    # Primeiro cria um carrinho
    test_payload = {
        "nome": "Carrinho para Busca"
    }
    create_response = client.post("/carrinho/", json=test_payload)
    assert create_response.status_code == 200
    created_data = create_response.json()
    
    # Depois busca o carrinho criado
    carrinho_id = created_data["id_carrinho"]
    get_response = client.get(f"/carrinho/{carrinho_id}")
    
    assert get_response.status_code == 200
    get_data = get_response.json()
    assert get_data["nome"] == "Carrinho para Busca"
    assert get_data["id_carrinho"] == carrinho_id

def test_get_nonexistent_carrinho(client):
    """
    Testa a busca de um carrinho que não existe
    """
    response = client.get("/carrinho/99999")
    assert response.status_code == 404
import json
from unittest.mock import patch 

def test_create_trajectory_success(client):
    """
    Testa o "caminho feliz" (Happy Path) da criação de trajetória.
    Vamos "mockar" (fingir) a chamada ao MQTT.
    """
        
    test_payload = {
        "name": "Trajetória de Teste 1",
        "store_in_memory": False,
        "commands": [
            {"type": "move", "value": 100.5, "unit": "mm"},
            {"type": "rotate", "value": 90.0, "unit": "degrees"}
        ]
    }
    
    expected_topic = "trajectories/execute"
    
    with patch("app.service.trajectory_service.publish_message") as mock_publish:
        response = client.post("/trajectories/", json=test_payload)
        
        assert response.status_code == 201
        
        data = response.json()
        assert data["name"] == "Trajetória de Teste 1"
        assert data["status"] == "saved"
        assert len(data["commands"]) == 2
        assert data["commands"][0]["type"] == "move"
        assert data["commands"][1]["value"] == 90.0
        
        expected_mqtt_payload = {
            "trajectory_id": data["id"],
            "name": "Trajetória de Teste 1",
            "commands": [
                {"type": "move", "value": 100.5, "unit": "mm"},
                {"type": "rotate", "value": 90.0, "unit": "degrees"}
            ]
        }
        
        mock_publish.assert_called_once() 
        mock_publish.assert_called_once_with(
            topic=expected_topic,
            payload=json.dumps(expected_mqtt_payload) 
        )

def test_create_trajectory_validation(client):
    """
    Testa validações na criação de trajetória
    """
    # Teste com payload inválido (sem comandos)
    invalid_payload = {
        "name": "Trajetória Inválida",
        "store_in_memory": False,
        "commands": []
    }
    
    response = client.post("/trajectories/", json=invalid_payload)
    assert response.status_code == 422  # Validation Error

def test_get_trajectory_stats(client):
    """
    Testa a obtenção de estatísticas de trajetórias
    """
    # Primeiro cria algumas trajetórias
    test_payload = {
        "name": "Trajetória Stats",
        "store_in_memory": False,
        "commands": [
            {"type": "move", "value": 100.0, "unit": "mm"}
        ]
    }
    
    # Cria 3 trajetórias
    for i in range(3):
        client.post("/trajectories/", json=test_payload)
    
    # Obtém as estatísticas
    response = client.get("/trajectories/stats")
    assert response.status_code == 200
    
    data = response.json()
    assert "total_saved" in data
    assert "total_executed" in data
    assert data["total_saved"] >= 3

def test_get_all_trajectories(client):
    """
    Testa a listagem de todas as trajetórias
    """
    response = client.get("/trajectories/")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        trajectory = data[0]
        assert "id" in trajectory
        assert "name" in trajectory
        assert "commands" in trajectory
        assert "status" in trajectory
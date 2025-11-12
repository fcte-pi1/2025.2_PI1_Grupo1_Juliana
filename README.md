
# Projeto PI1

## Pré-requisitos

  * **Python 3.10+**

## Instalação do Projeto

Siga os passos abaixo para configurar o ambiente e instalar as dependências.

### 1\. Criar e Ativar o Ambiente Virtual

É uma boa prática isolar as dependências do projeto:

```bash
# Cria um ambiente virtual
python3 -m venv .venv

# Ativa o ambiente virtual (Linux/macOS)
source .venv/bin/activate

# Ativa o ambiente virtual (Windows)
# .venv\Scripts\activate
```

### 2\. Instalar Dependências

Instale todas as bibliotecas necessárias:

```bash
pip install -r requirements.txt
```

## Rodando o Projeto

Após a configuração, você pode iniciar o servidor.

### 1\. Iniciar o Servidor FastAPI

Execute o comando `uvicorn` a partir do diretório raiz:

```bash
uvicorn main:app --reload
```

  * O flag `--reload` garante que o servidor reinicie automaticamente ao detectar mudanças no código.
  * O servidor estará acessível em: **`http://127.0.0.1:8000`**

### 2\. Acessar a Documentação da API

A documentação interativa (Swagger UI) estará disponível em:

```
http://127.0.0.1:8000/docs

## Migração Trajectories -> Circuitos

As antigas entidades/rotas Trajectory/Command foram substituídas por Circuito/Trecho para alinhar com o schema do banco (Supabase).

Novas rotas:
- POST `/circuitos/` — cria um circuito com trechos
- GET `/circuitos/` — lista circuitos
- GET `/circuitos/stats` — estatísticas

Rotas de execução/telemetria:
- POST `/execucoes/simulate` — gera uma execução simulada com logs
- GET `/execucoes/` — lista execuções
- GET `/execucoes/{id}` — resumo de uma execução
- GET `/execucoes/{id}/logs?limit=100` — logs recentes
- GET `/execucoes/{id}/export/csv` — exporta CSV de logs

Arquivos legados que podem ser removidos com segurança (já não são utilizados):
- `app/model/trajectory.py`
- `app/service/trajectory_service.py`
- `app/controller/trajectory_controller.py`

Obs.: Em ambiente local, a app usa SQLite (quando `DATABASE_URL` não está definido). Para usar Postgres/Supabase, defina `DATABASE_URL` no ambiente.
```

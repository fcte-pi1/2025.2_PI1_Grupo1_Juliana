# 2025.2_PI1_Grupo1_Juliana

## Como Rodar Localmente

1.  **Clone o repositório e acesse a branch "frontend":**
    ```bash
    git clone https://github.com/fcte-pi1/2025.2_PI1_Grupo1_Juliana.git
    cd 2025.2_PI1_Grupo1_Juliana/
    git checkout frontend
    ```

2.  **Instale o pnpm globalmente (se ainda não tiver):**
    ```bash
    npm install -g pnpm@latest-10
    ```

3.  **Instale as dependências:**
    ```bash
    pnpm install
    ```

4.  **Inicie o servidor de desenvolvimento:**
    ```bash
    pnpm run dev
    ```
    A aplicação estará disponível em `http://localhost:3000`.

## Alternativa: Rodar com Docker

1.  **Inicie o servidor de desenvolvimento:**
    ```bash
    docker compose up --build
    ```
    A aplicação estará disponível em `http://localhost:3000`.

2.  **Para parar os containers:**
    ```bash
    docker compose down -v
    ```


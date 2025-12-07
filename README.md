
## 📌 boonline4bpm-backend  

**boonline4bpm-backend** é um backend desenvolvido em  **Node.js**, projetado para gerenciar as operações do sistema **boonline4bpm**. Ele fornece uma API robusta para manipulação de dados e autenticação segura.

---

### 📚 **Descrição de Funções**:
- **Boletins de Ocorrência**: O sistema permite consultar, cadastrar, editar e excluir boletins de ocorrência com base em parâmetros como número, município, data e natureza do evento.
- **Naturezas de Ocorrências**: O sistema permite visualizar e fazer o ranking das naturezas dos boletins de ocorrência, tanto por ano quanto por mês.
- **Efetivo Policial**: As rotas permitem a consulta de boletins de ocorrência associados aos policiais, facilitando o acompanhamento das ocorrências por agente.


## 📂 Estrutura do Projeto  

A estrutura segue o padrão do NestJS:  

```
boonline4bpm-backend/
├── src/
│   ├── controllers/      # Controladores que logica de negocio
│   ├── models/           # Modelos de dados e esquemas
│   ├── http/             # Definição das rotas da aplicação, requisicoes http
│   ├── database/         # Lógica de negócios e integração com o banco de dados
│   ├── utils/            # Funções utilitárias e helpers
|   ├── lib/              # Bibliotecas
│   └── index.js          # Ponto de entrada da aplicação
├── .gitignore            # Arquivos e diretórios ignorados pelo Git
├── package.json          # Dependências e scripts do projeto
└── README.md             # Documentação do projeto
```

---

## 🛠 Tecnologias Utilizadas  

- **Node.js**  
- **PostgreSQL / MongoDB** *(dependendo da configuração do banco)*  
- **JWT para autenticação**  

---

## 🚀 Instalação  

1. **Clone o repositório:**  
   ```bash
   git clone https://github.com/jairomartins/boonline4bpm-backend.git
   cd booline4bpm-backend
   ```

2. **Instale as dependências:**  
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**  

   Crie um arquivo `.env` na raiz do projeto e adicione:  

   ```env
   DATABASE_HOST=seu_host
   DATABASE_PORT=sua_porta
   DATABASE_USER=seu_usuario
   DATABASE_PASSWORD=sua_senha
   DATABASE_NAME=seu_banco
   JWT_SECRET=sua_chave_secreta
   ```

4. **Inicie o servidor:**  
   ```bash
   npm run start:dev
   ```

O backend estará disponível em `http://localhost:3000`.

---

## 📡 Rotas da API  

A API possui os seguintes endpoints:

### 🔐 **Autenticação**  
| Método  | Rota              | Descrição |
|---------|------------------|-----------|
| `POST`  | `/auth/login`    | Autentica um usuário e retorna um token JWT |
| `POST`  | `/auth/register` | Registra um novo usuário no sistema |
| `POST`  | `/auth/logout`   | Invalida o token do usuário (se aplicável) |

---

### 👥 **Usuários**  
| Método  | Rota            | Descrição |
|---------|----------------|-----------|
| `GET`   | `/user`       | Lista todos os usuários cadastrados |
| `GET`   | `/user/:id`   | Obtém os detalhes de um usuário específico |
| `PUT`   | `/user/:id`   | Atualiza os dados de um usuário |
| `DELETE`| `/user/:id`   | Remove um usuário do sistema |

---
### 📂 **Boletim de Ocorrência (BO)**

| Método  | Rota                            | Descrição                                                                 |
|---------|---------------------------------|---------------------------------------------------------------------------|
| `GET`   | `/incidentReport`             | Lista todos os boletins de ocorrência registrados.                        |
| `GET`   | `/incidentReport/:ID` | Obtém detalhes de um boletim de ocorrência específico pelo ID.            |
| `GET`   | `/incidentReport/:city/:number` | Obtém boletins de ocorrência filtrados municipio e numero.             |
| `GET`   | `/incidentReport/:day/:month/:year` | Busca boletins de ocorrência de acordo com uma data específica.  |
| `POST`  | `/incidentReport/create`           | Cria um novo boletim de ocorrência.                                        |
| `GET`   | `/incidentReport/:number`   | Busca boletim de ocorrência pelo número fornecido.                        |
| `DELETE`  | `/incidentReport/remove/:id`       | Exclui um boletim de ocorrência pelo ID.                                   |
---

## 🔒 Segurança  

- **Autenticação com JWT**  
- **Proteção contra injeção SQL e XSS**  
- **Uso de Helmet para segurança HTTP**  

---

## 📌 Melhorias Futuras  

✔ Adicionar testes de integração.  


---


## 📜 Licença  

Este projeto está licenciado sob a **MIT License**.  

---

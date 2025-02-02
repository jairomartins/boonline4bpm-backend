
## 📌 boonline4bpm-backend  

**boonline4bpm-backend** é um backend desenvolvido em  **Node.js**, projetado para gerenciar as operações do sistema **boonline4bpm**. Ele fornece uma API robusta para manipulação de dados e autenticação segura.

---

## 📂 Estrutura do Projeto  

A estrutura segue o padrão do NestJS:  

```
boonline4bpm-backend/
├── src/
│   ├── controllers/      # Controladores que lidam com as requisições HTTP
│   ├── models/           # Modelos de dados e esquemas
│   ├── routes/           # Definição das rotas da aplicação
│   ├── services/         # Lógica de negócios e integração com o banco de dados
│   ├── utils/            # Funções utilitárias e helpers
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
| `GET`   | `/users`       | Lista todos os usuários cadastrados |
| `GET`   | `/users/:id`   | Obtém os detalhes de um usuário específico |
| `PUT`   | `/users/:id`   | Atualiza os dados de um usuário |
| `DELETE`| `/users/:id`   | Remove um usuário do sistema |

---

### 📂 **Ocorrências / BO (Boletim de Ocorrência)**  
| Método  | Rota                  | Descrição |
|---------|----------------------|-----------|
| `GET`   | `/bo`                 | Lista todas as ocorrências registradas |
| `GET`   | `/bo/:id`             | Obtém detalhes de uma ocorrência específica |
| `POST`  | `/bo`                 | Cria um novo boletim de ocorrência |
| `PUT`   | `/bo/:id`             | Atualiza uma ocorrência existente |
| `DELETE`| `/bo/:id`             | Exclui um boletim de ocorrência |

---

## 🔒 Segurança  

- **Autenticação com JWT**  
- **Proteção contra injeção SQL e XSS**  
- **Uso de Helmet para segurança HTTP**  

---

## 📌 Melhorias Futuras  

✔ Adicionar testes de integração.  
✔ Melhorar logging de erros.  
✔ Implementar CI/CD com GitHub Actions.  
✔ Criar documentação interativa com Swagger.  

---


## 📜 Licença  

Este projeto está licenciado sob a **MIT License**.  

---

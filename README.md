
## 📌 boonline4bpm-backend  

**boonline4bpm-backend** é uma API em Node.js/Express para o sistema **boonline4bpm**, com persistência em MongoDB.

---

### 📚 **Descrição de Funções**:
- **Boletins de Ocorrência**: O sistema permite consultar, cadastrar, editar e excluir boletins de ocorrência com base em parâmetros como número, município, data e natureza do evento.
- **Naturezas de Ocorrências**: O sistema permite visualizar e fazer o ranking das naturezas dos boletins de ocorrência, tanto por ano quanto por mês.
- **Efetivo Policial**: As rotas permitem a consulta de boletins de ocorrência associados aos policiais, facilitando o acompanhamento das ocorrências por agente.


## 📂 Estrutura do Projeto  

A estrutura principal do projeto:

```
boonline4bpm-backend/
├── src/
│   ├── controllers/      # Controladores que logica de negocio
│   ├── model/            # Modelos Mongoose
│   ├── http/             # Definição das rotas da aplicação, requisicoes http
│   ├── database/         # Conexão com o banco de dados
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

3. **Configure as variáveis de ambiente (opcional conforme o recurso usado):**

   Crie um arquivo `.env` na raiz do projeto:

   ```env
   PORT=3000
   BASE_URL=localhost
   SECRET_PASSWORD_TOKEN=uma_chave_longa_e_aleatoria
   PUBLIC_VALIDATION_BASE_URL=https://bo.seudominio.gov.br
   EMAIL_USER=seu_email
   EMAIL_PASSWORD=sua_senha_de_app
   OPENAI_API_KEY=sua_chave_da_openai
   ```

   O MongoDB deve estar disponível em `mongodb://127.0.0.1:27017/boonline` (configuração atual em `src/database/db.js`). Em desenvolvimento, a URL de validação usa `http://localhost:3000` por padrão; opcionalmente, configure `PUBLIC_VALIDATION_BASE_URL`. Em produção, configure essa variável com a origem HTTPS pública do frontend; localhost e endereços IP são recusados. E-mail e OpenAI são necessários apenas para os recursos correspondentes.

4. **Inicie o servidor:**
   ```bash
   npm run dev
   ```

Para iniciar sem reinicialização automática, use `npm start`. A API fica disponível em `http://localhost:3000`.
A documentação HTML da API fica disponível em `http://localhost:3000/docs`.

---

## 📡 Rotas da API  

As rotas de autenticação também aceitam os caminhos legados sem o prefixo `/auth`.

### 🔐 **Autenticação**  
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/login` | Autentica e retorna um token JWT |
| `POST` | `/auth/register` | Registra um usuário |
| `GET` | `/auth/confirm/:token` | Confirma o e-mail usando o link enviado no cadastro |
| `POST` | `/auth/recuperarSenha` | Solicita link de recuperação por e-mail |
| `GET` | `/auth/passwordrecover/:token` | Exibe formulário para redefinir senha |
| `POST` | `/auth/passwordrecover/:token` | Redefine senha com token temporário de uso único |
| `GET` | `/auth/isUserAuth` | Valida o token enviado no cabeçalho `x-access-token` |

Não há endpoint de logout: os tokens são JWT stateless; o cliente deve descartar o token.

### 👥 **Usuários**  
Todas as rotas de usuários exigem o cabeçalho `x-access-token`.

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/user` | Cadastra usuário |
| `GET` | `/user` | Lista usuários |
| `GET` | `/user/:matricula` | Busca usuário pela matrícula |
| `PUT` | `/user/:id` | Atualiza dados permitidos pelo ID MongoDB |
| `DELETE` | `/user/:id` | Remove pelo ID MongoDB |

---

### Roles e permissões

As permissões efetivas vêm da role ativa armazenada no MongoDB e são revalidadas no backend em cada requisição. Os endpoints administrativos são `GET/POST /access/roles`, `PUT /access/roles/:id`, `PATCH /access/users/:id/role`, `PATCH /access/users/:id/status` e `GET /access/me`; cada endpoint exige sua permissão específica. O catálogo de permissões e os recursos estão em `src/utils/permissionCatalog.js`.

Para criar as roles iniciais e mapear perfis legados, revise a conexão MongoDB e execute `npm run migrate:roles`. A migração é idempotente e não remove o campo legado `tipo`: contas com `tipo=admin` são associadas a `Administrador`; os demais perfis, inclusive `COPOM` e `P3`, são associados a `Básico`. As roles COPOM, P3 e Comandante começam sem permissões sensíveis e devem ser configuradas conforme aprovação institucional. O script exige ao menos uma conta administrativa ativa e não foi executado como parte desta alteração.

### 📂 **Boletim de Ocorrência (BO)**

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/incidentReport` | Lista boletins |
| `GET` | `/incidentReport/domestic` | Busca boletins de violência doméstica |
| `GET` | `/incidentReport/date/:day/:month/:year` | Busca por data |
| `GET` | `/incidentReport/city/:city/:number` | Busca por município e número |
| `GET` | `/incidentReport/number/:number` | Busca por número |
| `GET` | `/incidentReport/:incidentReportId` | Busca pelo ID MongoDB |
| `POST` | `/incidentReport/create` | Cria ou atualiza; exige token |
| `DELETE` | `/incidentReport/remove/:id` | Exclui; exige token |

Os formatos antigos de busca por data e por município/número continuam disponíveis por compatibilidade.

### Cópias digitais e validação por QR Code

| Método | Rota | Acesso |
|---|---|---|
| `POST` | `/incidentReport/:id/documents` | Usuário autenticado autorizado; emite o PDF final com o mesmo conteúdo da impressão do sistema e QR Code ao final |
| `GET` | `/incidentReport/documents/validation/:token` | Público, limitado a 30 consultas por minuto por IP; retorna apenas estado, versão e emissão |
| `GET` | `/incidentReport/documents/validation/:token/details` | Autenticado; autor ou administrador; retorna o número e os detalhes da versão |
| `GET` | `/incidentReport/documents/validation/:token/pdf` | Autenticado; somente autor do boletim ou administrador |
| `POST` | `/incidentReport/documents/validation/:token/revoke` | Autenticado; somente autor do boletim ou administrador |

O PDF é armazenado como versão imutável na coleção `BoletimDocumento`, junto ao hash SHA-256, hash do token, número da versão, revisão do boletim e metadados mínimos de emissão. O token aleatório não contém dados pessoais. A consulta pública confirma a integridade e o estado, sem revelar o número do boletim nem entregar a cópia integral. Edições incrementam `documentRevision` e substituem as versões anteriores; `currentDocumentVersion` identifica a versão emitida mais recente. Número e cópia só são liberados a uma conta autorizada. Emissões e alterações de estado ficam associadas à versão, e downloads autorizados geram registros mínimos na coleção `BoletimDocumentoAcesso`, sem armazenar conteúdo ou IP. O limitador de consultas públicas usa memória do processo; ambientes com múltiplas instâncias devem configurar um armazenamento compartilhado. Exclusões, status de cancelamento institucional e assinatura digital qualificada ainda não existem no modelo atual e não são declarados pelo PDF.

O botão único **Imprimir** emite o PDF a partir dos dados persistidos e abre a cópia final, com o QR Code ao final; a mesma versão armazenada é oferecida na validação online apenas a usuários autorizados. Os logotipos do cabeçalho são os mesmos arquivos já utilizados pela impressão do frontend. O QR Code não libera publicamente os dados integrais do boletim.
O host do frontend deve encaminhar `/validar-boletim/*` para o `index.html` da SPA. Em produção, o domínio configurado em `PUBLIC_VALIDATION_BASE_URL` deve ser servido por HTTPS.

### Revisão de texto

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/verify-text` | Recebe `{ "text": "..." }` e solicita revisão de texto |
---

## 📜 Licença  

Este projeto está licenciado sob a **MIT License**.  

---

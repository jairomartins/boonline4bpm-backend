function docsRoute(app) {
    app.get('/docs', (req, res) => {
        res.type('html').send(`<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <title>Documentação da API - Boletim Online</title>
</head>
<body>
    <h1>Documentação da API</h1>
    <p>API do Boletim Online. Esta página contém somente HTML e texto, sem scripts ou recursos externos.</p>
    <p>Base local: <code>http://localhost:3000</code></p>
    <p>As requisições com corpo devem usar <code>Content-Type: application/json</code>, exceto o envio do formulário HTML de redefinição de senha.</p>

    <h2>Autenticação</h2>
    <p>As rotas listadas com prefixo <code>/auth</code> também aceitam o caminho legado sem esse prefixo.</p>
    <table border="1">
        <thead><tr><th>Método</th><th>Endpoint</th><th>Descrição</th><th>Autenticação</th></tr></thead>
        <tbody>
            <tr><td>POST</td><td>/auth/login</td><td>Autentica e retorna um JWT.</td><td>Não</td></tr>
            <tr><td>POST</td><td>/auth/register</td><td>Cadastra usuário e envia link de confirmação por e-mail.</td><td>Não</td></tr>
            <tr><td>GET</td><td>/auth/confirm/:token</td><td>Confirma o e-mail pelo token enviado.</td><td>Token de confirmação</td></tr>
            <tr><td>POST</td><td>/auth/recuperarSenha</td><td>Solicita link de recuperação de senha.</td><td>Não</td></tr>
            <tr><td>GET</td><td>/auth/passwordrecover/:token</td><td>Exibe o formulário para redefinir a senha.</td><td>Token de recuperação</td></tr>
            <tr><td>POST</td><td>/auth/passwordrecover/:token</td><td>Redefine a senha; token de uso único e validade de 15 minutos.</td><td>Token de recuperação</td></tr>
            <tr><td>GET</td><td>/auth/isUserAuth</td><td>Verifica se o JWT de acesso é válido.</td><td>JWT de acesso</td></tr>
        </tbody>
    </table>
    <p>Para rotas protegidas, envie o JWT de acesso no cabeçalho <code>x-access-token</code>. Não há endpoint de logout; descarte o token no cliente.</p>

    <h3>Exemplos de autenticação</h3>
    <pre>POST /auth/register
{"userName":"Nome","userEmail":"usuario@exemplo.com","userPassword":"senha","userContato":"999999999","userMatriculaId":"123","userGraduacao":"SD","userBarra":"12345"}

POST /auth/login
{"userEmail":"usuario@exemplo.com","userPassword":"senha"}

POST /auth/recuperarSenha
{"userEmail":"usuario@exemplo.com"}</pre>

    <h2>Usuários</h2>
    <p>Todas as rotas de usuário exigem JWT de acesso no cabeçalho <code>x-access-token</code>.</p>
    <table border="1">
        <thead><tr><th>Método</th><th>Endpoint</th><th>Descrição</th></tr></thead>
        <tbody>
            <tr><td>POST</td><td>/user</td><td>Cria usuário. A senha enviada é armazenada com hash.</td></tr>
            <tr><td>GET</td><td>/user</td><td>Lista usuários sem retornar senhas ou hashes de tokens.</td></tr>
            <tr><td>GET</td><td>/user/:matricula</td><td>Busca usuário pelo número de matrícula.</td></tr>
            <tr><td>PUT</td><td>/user/:id</td><td>Atualiza dados permitidos usando o ID MongoDB.</td></tr>
            <tr><td>DELETE</td><td>/user/:id</td><td>Remove usuário pelo ID MongoDB.</td></tr>
        </tbody>
    </table>
    <p>Campos aceitos na atualização: <code>userName</code>, <code>userEmail</code>, <code>userContato</code>, <code>userMatriculaId</code>, <code>userGraduacao</code>, <code>userBarra</code> e <code>userNumero</code>.</p>

    <h2>Boletins de ocorrência</h2>
    <table border="1">
        <thead><tr><th>Método</th><th>Endpoint</th><th>Descrição</th><th>Autenticação</th></tr></thead>
        <tbody>
            <tr><td>GET</td><td>/incidentReport</td><td>Lista boletins.</td><td>Admin</td></tr>
            <tr><td>GET</td><td>/incidentReport/domestic</td><td>Lista boletins de violência doméstica.</td><td>Admin</td></tr>
            <tr><td>GET</td><td>/incidentReport/search</td><td>Pesquisa boletins conforme o escopo do usuário.</td><td>JWT de acesso</td></tr>
            <tr><td>GET</td><td>/incidentReport/statistics</td><td>Estatísticas e filtros por período, município e natureza.</td><td>Admin</td></tr>
            <tr><td>GET</td><td>/incidentReport/statistics/geographic/options</td><td>Lista municípios com registros e catálogo de naturezas para o mapa.</td><td>Admin</td></tr>
            <tr><td>GET</td><td>/incidentReport/statistics/geographic</td><td>Resumo, heatmap agregado e página de pontos sem dados pessoais; período máximo de 366 dias.</td><td>Admin</td></tr>
            <tr><td>GET</td><td>/incidentReport/involved/cpf/:cpf</td><td>Pesquisa dados de envolvido por CPF, respeitando o escopo dos boletins visíveis ao usuário.</td><td>JWT de acesso</td></tr>
            <tr><td>GET</td><td>/incidentReport/date/:day/:month/:year</td><td>Busca pela data no formato dia/mês/ano.</td><td>Admin</td></tr>
            <tr><td>GET</td><td>/incidentReport/city/:city/:number</td><td>Busca por município e número do boletim.</td><td>Admin</td></tr>
            <tr><td>GET</td><td>/incidentReport/number/:number</td><td>Busca pelo número do boletim.</td><td>Admin</td></tr>
            <tr><td>GET</td><td>/incidentReport/:incidentReportId</td><td>Busca pelo ID MongoDB conforme o escopo do usuário.</td><td>JWT de acesso</td></tr>
            <tr><td>POST</td><td>/incidentReport/create</td><td>Cria ou atualiza boletim.</td><td>JWT de acesso</td></tr>
            <tr><td>DELETE</td><td>/incidentReport/remove/:id</td><td>Remove boletim pelo ID MongoDB.</td><td>JWT de acesso</td></tr>
        </tbody>
    </table>
    <p>Os caminhos antigos <code>/incidentReport/:day/:month/:year</code> e <code>/incidentReport/:city/:number</code> continuam disponíveis.</p>
    <h3>Cópia digital e validação por QR Code</h3>
    <table border="1">
        <thead><tr><th>Método</th><th>Endpoint</th><th>Descrição</th><th>Acesso</th></tr></thead>
        <tbody>
            <tr><td>POST</td><td>/incidentReport/:id/documents</td><td>Emite e baixa PDF A4 do boletim persistido com QR Code, versão e hash.</td><td>Autor do boletim ou admin; requer PUBLIC_VALIDATION_BASE_URL HTTPS</td></tr>
            <tr><td>GET</td><td>/incidentReport/documents/validation/:token</td><td>Valida a versão e sua integridade; não retorna número nem dados pessoais.</td><td>Público; 30 consultas/minuto por IP</td></tr>
            <tr><td>GET</td><td>/incidentReport/documents/validation/:token/details</td><td>Consulta número e data da versão.</td><td>Autor do boletim ou admin</td></tr>
            <tr><td>GET</td><td>/incidentReport/documents/validation/:token/pdf</td><td>Baixa a cópia integral armazenada e verifica o hash.</td><td>Autor do boletim ou admin</td></tr>
            <tr><td>POST</td><td>/incidentReport/documents/validation/:token/revoke</td><td>Invalida uma versão ainda válida.</td><td>Autor do boletim ou admin</td></tr>
        </tbody>
    </table>
    <p>O frontend disponibiliza a página pública em <code>/validar-boletim/:token</code>. Edições substituem a cópia anterior; número e arquivo integral nunca são liberados pela validação pública.</p>
    <p>O mapa utiliza coordenadas informadas no registro e blocos cartográficos do OpenStreetMap com atribuição. Não geocodifica endereços nem usa limites municipais/bairros sem uma fonte confiável. A data do fato é padrão; a alternativa de data de registro usa <code>createdAt</code>.</p>
    <p>Para criar um boletim, envie um objeto <code>incidentReport</code>. Para atualizar, inclua também o campo <code>_id</code>.</p>
    <pre>POST /incidentReport/create
{"incidentReport":{"numero":"123","naturezaIds":["507f1f77bcf86cd799439011","507f1f77bcf86cd799439012"],"data":"22/10/2026","municipio":"São Luís"}}</pre>
    <p>Boletins novos exigem um ou mais IDs de naturezas ativas em <code>naturezaIds</code> (o ID singular <code>naturezaId</code> continua aceito para compatibilidade). O backend grava os nomes oficiais no campo de exibição separados por ponto e vírgula e mantém as referências para contagem; não confie em <code>natureza</code> enviado pelo cliente.</p>
    <p>O formulário de envolvidos pode consultar CPFs nos boletins acessíveis ao usuário e reaproveitar os dados pessoais como preenchimento inicial. As alterações são salvas no boletim atual. O campo <code>conduzido</code> é individual por envolvido e alimenta <code>indicators.conducoes</code> com totais, reincidência identificável por CPF, sexo e faixas etárias no período filtrado; esse resumo não inclui CPFs. Registros sem CPF aparecem separados em <code>registrosSemCpf</code> e não são tratados como indivíduos únicos para reincidência.</p>

    <h2>Catálogo de naturezas</h2>
    <p>Todas as rotas exigem JWT de acesso. Consulta é permitida a usuários autenticados; criação, edição, ativação e desativação exigem perfil <code>admin</code>. Naturezas utilizadas não podem ser excluídas.</p>
    <table border="1">
        <thead><tr><th>Método</th><th>Endpoint</th><th>Descrição</th><th>Permissão</th></tr></thead>
        <tbody>
            <tr><td>GET</td><td>/naturezas?q=termo</td><td>Pesquisa naturezas ativas.</td><td>Usuário autenticado</td></tr>
            <tr><td>GET</td><td>/naturezas/:id</td><td>Consulta uma natureza, inclusive inativa para histórico.</td><td>Usuário autenticado</td></tr>
            <tr><td>GET</td><td>/naturezas?incluirInativas=true</td><td>Lista todas as naturezas com contagens de boletins e pendências.</td><td>Admin</td></tr>
            <tr><td>POST</td><td>/naturezas</td><td>Cadastra natureza oficial.</td><td>Admin</td></tr>
            <tr><td>PUT</td><td>/naturezas/:id</td><td>Edita nome, categoria, descrição e aliases.</td><td>Admin</td></tr>
            <tr><td>PATCH</td><td>/naturezas/:id/status</td><td>Ativa ou desativa usando <code>{&quot;ativo&quot;: false}</code>.</td><td>Admin</td></tr>
        </tbody>
    </table>
    <p>Para importar os grupos e fatos do arquivo de referência, execute <code>npm run seed:naturezas -- --apply</code> no backend. O modo padrão é simulação; a importação preserva entradas já existentes e pode ser executada novamente sem duplicá-las.</p>

    <h2>Revisão de texto</h2>
    <table border="1">
        <thead><tr><th>Método</th><th>Endpoint</th><th>Descrição</th><th>Autenticação</th></tr></thead>
        <tbody>
            <tr><td>POST</td><td>/api/verify-text</td><td>Revisa o texto enviado por meio do serviço de IA configurado.</td><td>Não</td></tr>
        </tbody>
    </table>
    <pre>POST /api/verify-text
{"text":"Texto para revisão."}</pre>

    <h2>Respostas e erros</h2>
    <p>As respostas de dados são JSON. Códigos comuns: 200 para sucesso, 201 para criação, 400 para entrada inválida, 401 para token inválido ou credenciais incorretas, 403 para acesso não autorizado, 404 para recurso inexistente, 409 para conflito de versão ou nome duplicado, 413 para PDF acima do limite e 500 para erro interno. Validação e emissão podem retornar 503 quando o serviço estiver indisponível; consultas públicas também podem retornar 429 ao exceder o limite.</p>
</body>
</html>`)
    })
}

module.exports = docsRoute

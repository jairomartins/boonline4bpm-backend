const permissionCatalog = [
    { id: 'dashboard.view', module: 'Painel', label: 'Acessar o painel' },
    { id: 'boletins.view.own', module: 'Boletins', label: 'Consultar boletins próprios ou dos quais participa' },
    { id: 'boletins.create', module: 'Boletins', label: 'Criar boletins' },
    { id: 'boletins.edit.own', module: 'Boletins', label: 'Editar boletins próprios' },
    { id: 'boletins.edit.all', module: 'Boletins', label: 'Editar qualquer boletim' },
    { id: 'boletins.view.all', module: 'Boletins', label: 'Consultar todos os boletins' },
    { id: 'boletins.delete.own', module: 'Boletins', label: 'Excluir boletins próprios' },
    { id: 'boletins.delete', module: 'Boletins', label: 'Excluir qualquer boletim' },
    { id: 'boletins.print', module: 'Boletins', label: 'Emitir e imprimir cópias digitais' },
    { id: 'statistics.view', module: 'Relatórios', label: 'Consultar estatísticas' },
    { id: 'map.view', module: 'Relatórios', label: 'Consultar mapa geográfico' },
    { id: 'users.view', module: 'Gerenciamento', label: 'Consultar usuários' },
    { id: 'users.manage', module: 'Gerenciamento', label: 'Criar e alterar usuários, status e roles' },
    { id: 'roles.view', module: 'Gerenciamento', label: 'Consultar roles e permissões' },
    { id: 'roles.manage', module: 'Gerenciamento', label: 'Criar roles e gerenciar permissões' },
    { id: 'naturezas.manage', module: 'Gerenciamento', label: 'Gerenciar naturezas de ocorrência' },
    { id: 'localidades.manage', module: 'Gerenciamento', label: 'Gerenciar localidades e territórios' },
]

const BASIC_PERMISSIONS = [
    'dashboard.view',
    'boletins.view.own',
    'boletins.create',
    'boletins.edit.own',
    'boletins.delete.own',
    'boletins.print'
]

const LEGACY_ADMIN_PERMISSIONS = permissionCatalog.map(permission => permission.id)

const initialRoles = [
    { key: 'basico', name: 'Básico', description: 'Acesso operacional básico equivalente ao perfil comum legado.', permissions: BASIC_PERMISSIONS },
    { key: 'copom', name: 'COPOM', description: 'Permissões institucionais pendentes de configuração.', permissions: [] },
    { key: 'p3', name: 'P3', description: 'Permissões institucionais pendentes de configuração.', permissions: [] },
    { key: 'comandante', name: 'Comandante', description: 'Permissões institucionais pendentes de configuração.', permissions: [] },
    { key: 'administrador', name: 'Administrador', description: 'Mantém o acesso administrativo legado existente.', permissions: LEGACY_ADMIN_PERMISSIONS }
]

module.exports = { permissionCatalog, initialRoles, BASIC_PERMISSIONS, LEGACY_ADMIN_PERMISSIONS }

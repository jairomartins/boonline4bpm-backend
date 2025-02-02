const express = require('express');
const userController = require('../controllers/userController');
const { verificaToken } = require('../lib/jwtconfig');

function userRoute(app) {
    const router = express.Router();

    // Rotas públicas
    router.post('/', async (req, res) => {
        try {
            await userController.userCreate(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Erro ao criar usuário', error: error.message });
        }
    });

    router.post('/recoverPassword/:userId', async (req, res) => {
        try {
            await userController.userUpdatePassword(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Erro ao recuperar senha', error: error.message });
        }
    });

    router.get('/confirm/:id', async (req, res) => {
        try {
            await userController.userActive(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Erro ao confirmar usuário', error: error.message });
        }
    });

    // Middleware de autenticação para rotas protegidas
    router.use(verificaToken);

    // Rotas protegidas
    router.get('/', async (req, res) => {
        try {
            await userController.userList(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Erro ao listar usuários', error: error.message });
        }
    });

    router.get('/:id', async (req, res) => {
        try {
            await userController.buscarUserByMatriculaId(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Erro ao buscar usuário', error: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            await userController.userUpdate(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Erro ao atualizar usuário', error: error.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            await userController.userDelete(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Erro ao deletar usuário', error: error.message });
        }
    });

    // Aplica as rotas no app
    app.use('/users', router);
}

module.exports = userRoute;

const express = require('express');
const userController = require('../controllers/userController');
const { verificaToken } = require('../lib/jwtconfig');
const {
    requirePermission,
    protectLastAdministratorRemoval
} = require('../utils/authorization')
const exigeAdmin = requirePermission('users.manage')
const exigeConsultaUsuarios = requirePermission('users.view')

const exigeIdentidade = (req, res, next) => {
    if (req.user && req.user.userId) return next()
    return res.status(401).json({ message: 'Faça login novamente para continuar.' })
}

function userRoute(app) {
    const router = express.Router();

    //create user route
    router.post('/',verificaToken, exigeAdmin, async (req, res) => {
        try {
            await userController.userCreate(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Error on creating user', error: error.message });
        }
    });

    //delete user route
    //to delete a user, we need to pass the user ID
    router.delete('/:id',verificaToken, exigeAdmin, protectLastAdministratorRemoval, async (req, res) => {
        try {
            await userController.userDelete(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Error deleting user', error: error.message });
        }
    });

    //route to get user by matricula ID  
    router.get('/me', verificaToken, exigeIdentidade, async (req, res) => {
        await userController.currentUser(req, res)
    })

    router.get('/me/incident-reports', verificaToken, exigeIdentidade, requirePermission('boletins.view.own'), async (req, res) => {
        await userController.currentUserIncidentReports(req, res)
    })

    router.put('/me', verificaToken, exigeIdentidade, async (req, res) => {
        await userController.updateCurrentUser(req, res)
    })

    router.put('/:id/password', verificaToken, exigeAdmin, async (req, res) => {
        await userController.updatePassword(req, res)
    })

    router.get('/:id',verificaToken, exigeConsultaUsuarios, async (req, res) => {
        try {
            await userController.findUserByMatriculaId(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching user', error: error.message });
        }
    });

    //update user route
    //to update a user, we need to pass the user ID
    router.put('/:id',verificaToken, exigeAdmin, async (req, res) => {
        try {
            await userController.userUpdate(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Error updating user', error: error.message });
        }
    });

    //route to get all users
    router.get('/',verificaToken, exigeConsultaUsuarios, async (req, res) => {
        await userController.usersList(req, res);
    });

    // Aplica as rotas no app
    app.use('/user', router);
}

module.exports = userRoute;

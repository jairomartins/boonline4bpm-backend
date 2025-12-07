const express = require('express');
const userController = require('../controllers/userController');
const { verificaToken } = require('../lib/jwtconfig');

function userRoute(app) {
    const router = express.Router();

    //create user route
    router.post('/', async (req, res) => {
        try {
            await userController.userCreate(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Error on creating user', error: error.message });
        }
    });

    //delete user route
    //to delete a user, we need to pass the user ID
    router.delete('/:id', async (req, res) => {
        try {
            await userController.userDelete(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Error deleting user', error: error.message });
        }
    });

    //route to get user by matricula ID  
    router.get('/:id', async (req, res) => {
        try {
            await userController.findUserByMatriculaId(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching user', error: error.message });
        }
    });

    //update user route
    //to update a user, we need to pass the user ID
    router.put('/:id', async (req, res) => {
        try {
            await userController.userUpdate(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Error updating user', error: error.message });
        }
    });

    //route to get all users
    router.get('/', async (req, res) => {
        await userController.usersList(req, res);
    });



    //TODO - Refactory this routes under this comment ----
    router.post('/recoverPassword/:userId', async (req, res) => {
        try {
            await userController.userUpdatePassword(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Error updating password', error: error.message });
        }
    });

    router.get('/confirm/:id', async (req, res) => {
        try {
            await userController.userActive(req, res);
        } catch (error) {
            res.status(500).json({ message: 'Error confirming user', error: error.message });
        }
    });

    // Middleware de autenticação para rotas protegidas
    //router.use(verificaToken);


  



    

    // Aplica as rotas no app
    app.use('/user', router);
}

module.exports = userRoute;

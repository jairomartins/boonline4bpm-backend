const express = require('express')
const authController = require('../controllers/authController')
const { verificaToken } = require('../lib/jwtconfig')

function authRouter(app) {
    const router = express.Router()

    router.post('/login', async (req, res) => {
        await authController.login(req, res)
    })

    router.post('/register', async (req, res) => {
        await authController.register(req, res)
    })

    router.get('/confirm/:token', async (req, res) => {
        await authController.confirmEmail(req, res)
    })

    router.post('/recuperarSenha', async (req, res) => {
        await authController.recoverPassword(req, res)
    })

    router.get('/isUserAuth', verificaToken, (req, res) => {
        res.status(200).json({ authenticated: true, user: req.user })
    })

    router.get('/session', verificaToken, async (req, res) => {
        await authController.currentSession(req, res)
    })

    router.get('/passwordrecover/:token', async (req, res) => {
        await authController.passwordFormUpdate(req, res)
    })

    router.post('/passwordrecover/:token', async (req, res) => {
        await authController.resetPassword(req, res)
    })

    // Keep the original root-level paths working while clients migrate to /auth.
    app.use(router)
    app.use('/auth', router)
}

module.exports = authRouter
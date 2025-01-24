const openai = require('../lib/openai');
const responseHandler = require('../utils/responseHandler');

const verifyText = async (req, res, next) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: "Texto não fornecido" });
    }

    try {
        const correctedText = await openai.verifyTextWithAI(text);
        responseHandler.successResponse(res, { correctedText });
    } catch (error) {

        console.log(error);
    }
};

module.exports = { verifyText };

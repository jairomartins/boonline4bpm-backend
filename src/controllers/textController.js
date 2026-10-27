const openai = require('../lib/openai');
const responseHandler = require('../utils/responseHandler');

const verifyText = async (req, res, next) => {
    const { text } = req.body || {};

    if (typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: "Informe o texto para revisão." });
    }

    try {
        const correctedText = await openai.verifyTextWithAI(text);
        responseHandler.successResponse(res, { correctedText });
    } catch (error) {
        console.error("Erro ao revisar texto:", error);
        return res.status(502).json({ error: "Não foi possível processar o texto no serviço de revisão." });
    }
};

module.exports = { verifyText };

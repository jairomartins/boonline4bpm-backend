const axios = require('axios');

const API_URL = 'https://api.openai.com/v1/chat/completions';
const API_KEY = process.env.OPENAI_API_KEY;

const verifyTextWithAI = async (text) => {
    const messages = [
        {
            role: "system",
            content: "Você é um assistente que analisa relatos de ocorrências policiais. Faça correções gramaticais, ortográficas e melhore a clareza do texto fornecido."
        },
        { role: "user", content: text }
    ];

    try {
        const response = await axios.post(API_URL, { model: "gpt-3.5-turbo", messages }, {
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
        });

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("Erro ao conectar com a OpenAI:", error);
        throw new Error("Erro ao processar texto com IA");
    }
};

module.exports = { verifyTextWithAI };

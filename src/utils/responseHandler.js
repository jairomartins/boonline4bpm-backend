const successResponse = (res, data, status = 200) => {
    res.status(status).json({ success: true, data });
};

const errorHandler = (err, req, res, next) => {
    console.error("Erro:", err.message);
    res.status(500).json({ success: false, error: err.message || "Erro interno do servidor" });
};

module.exports = { successResponse, errorHandler };

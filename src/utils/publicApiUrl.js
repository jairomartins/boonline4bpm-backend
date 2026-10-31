const net = require('node:net')
function publicApiUrl(env = process.env) {
    if (!env.PUBLIC_APP_URL) {
        if (env.NODE_ENV === 'production') throw new Error('PUBLIC_APP_URL é obrigatória em produção.')
        return `${env.USE_HTTPS === 'true' ? 'https' : 'http'}://${env.BASE_URL || 'localhost'}:${env.PORT || 3001}`
    }
    const url = new URL(env.PUBLIC_APP_URL)
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol) ||
        (env.NODE_ENV === 'production' && (url.protocol !== 'https:' || net.isIP(hostname) ||
            hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')))) {
        throw new Error('PUBLIC_APP_URL deve ser uma URL pública HTTPS da API, sem credenciais.')
    }
    return url.toString().replace(/\/$/, '')
}
module.exports = { publicApiUrl }

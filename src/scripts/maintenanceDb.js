function requireExplicitMongo() {
    const uri = process.env.MONGO
    if (!uri) throw new Error('Defina MONGO explicitamente no .env antes de executar comandos de manutenção.')
    try {
        const parsed = new URL(uri)
        const database = parsed.pathname.replace(/^\//, '').split('/')[0] || '(default)'
        console.log(`Destino MongoDB configurado: ${parsed.hostname}/${database}`)
    } catch {
        throw new Error('MONGO não contém uma URI válida.')
    }
}

module.exports = { requireExplicitMongo }

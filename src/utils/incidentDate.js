function parseIncidentDate(value) {
    if (typeof value !== 'string') return null
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
    if (!match) return null
    const [, dayValue, monthValue, yearValue] = match
    const day = Number(dayValue)
    const month = Number(monthValue)
    const year = Number(yearValue)
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null
    }
    return date
}

module.exports = { parseIncidentDate }

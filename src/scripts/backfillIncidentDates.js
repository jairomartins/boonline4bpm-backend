require('dotenv').config()
const { requireExplicitMongo } = require('./maintenanceDb')
requireExplicitMongo()
const IncidentReport = require('../model/boletim')
const { parseIncidentDate } = require('../utils/incidentDate')

async function main() {
    const apply = process.argv.includes('--apply')
    if (apply && process.env.CONFIRM_INCIDENT_DATE_BACKFILL !== 'yes') {
        throw new Error('Para gravar, defina CONFIRM_INCIDENT_DATE_BACKFILL=yes junto com --apply.')
    }

    await IncidentReport.db.asPromise()
    const cursor = IncidentReport.collection.find({ dataOcorrencia: { $exists: false } }, {
        projection: { _id: 1, data: 1 }
    })
    let scanned = 0
    let valid = 0
    let invalid = 0
    let operations = []

    for await (const report of cursor) {
        scanned += 1
        const date = parseIncidentDate(report.data)
        if (date) valid += 1
        else invalid += 1
        if (apply) {
            operations.push({
                updateOne: {
                    filter: { _id: report._id, dataOcorrencia: { $exists: false } },
                    update: { $set: { dataOcorrencia: date } }
                }
            })
            if (operations.length >= 500) {
                await IncidentReport.collection.bulkWrite(operations, { ordered: false })
                operations = []
            }
        }
    }
    if (apply && operations.length) {
        await IncidentReport.collection.bulkWrite(operations, { ordered: false })
    }

    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', scanned, valid, invalid }, null, 2))
    await IncidentReport.db.close()
}

main().catch(async (error) => {
    console.error(error.message)
    try { await IncidentReport.db.close() } catch { /* ignore close failure */ }
    process.exitCode = 1
})

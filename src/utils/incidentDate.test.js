const test = require('node:test')
const assert = require('node:assert/strict')
const { parseIncidentDate } = require('./incidentDate')

test('parseIncidentDate parses valid Brazilian dates at UTC midnight', () => {
    assert.equal(parseIncidentDate('28/10/2026').toISOString(), '2026-10-28T00:00:00.000Z')
})

test('parseIncidentDate accepts leap days and rejects impossible dates', () => {
    assert.equal(parseIncidentDate('29/02/2024').toISOString(), '2024-02-29T00:00:00.000Z')
    assert.equal(parseIncidentDate('29/02/2025'), null)
    assert.equal(parseIncidentDate('31/04/2026'), null)
})

test('parseIncidentDate rejects other formats and non-text values', () => {
    assert.equal(parseIncidentDate('2026-10-28'), null)
    assert.equal(parseIncidentDate(''), null)
    assert.equal(parseIncidentDate(null), null)
})

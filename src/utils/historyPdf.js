const { sanitizeHistoryHtml } = require('./historyHtml')
function decode(text) {
    const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
    return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, key) => {
        if (key[0] !== '#') return entities[key.toLowerCase()]
        const number = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1))
        return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '\uFFFD'
    })
}
function historyParagraphs(html) {
    const paragraphs = []
    let runs = []
    const styles = { bold: 0, italic: 0, underline: 0 }
    const lists = []
    const flush = () => { if (runs.some(run => run.text.trim())) paragraphs.push(runs); runs = [] }
    const append = text => { if (text) runs.push({ text, bold: styles.bold > 0, italic: styles.italic > 0, underline: styles.underline > 0 }) }
    for (const token of sanitizeHistoryHtml(html).split(/(<[^>]+>)/)) {
        const match = /^<(\/)?(\w+)>$/.exec(token)
        if (!match) { append(decode(token)); continue }
        const closing = Boolean(match[1]), tag = match[2]
        const style = { strong: 'bold', b: 'bold', em: 'italic', i: 'italic', u: 'underline' }[tag]
        if (style) { styles[style] = Math.max(0, styles[style] + (closing ? -1 : 1)); continue }
        if (tag === 'ol' || tag === 'ul') { flush(); if (closing) lists.pop(); else lists.push({ ordered: tag === 'ol', count: 0 }); continue }
        if (tag === 'li') {
            flush()
            if (!closing) { const list = lists[lists.length - 1]; append(list?.ordered ? `${++list.count}. ` : '• ') }
            continue
        }
        if (['p', 'div', 'br', 'blockquote', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) flush()
    }
    flush()
    return paragraphs
}
function renderHistory(doc, html, width, left) {
    for (const runs of historyParagraphs(html)) {
        doc.x = left
        runs.forEach((run, index) => {
            doc.font(run.bold ? run.italic ? 'Helvetica-BoldOblique' : 'Helvetica-Bold' : run.italic ? 'Helvetica-Oblique' : 'Helvetica')
                .fontSize(8.5).fillColor('#000000').text(run.text, {
                    width, lineGap: 2, align: 'justify', continued: index < runs.length - 1, underline: run.underline
                })
        })
        doc.moveDown(0.25)
    }
    doc.font('Helvetica')
}
module.exports = { historyParagraphs, renderHistory }

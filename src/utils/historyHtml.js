// Conservative HTML serializer: output contains only fixed, attribute-free tags.
// Everything else is escaped as text or unwrapped; no input attribute is emitted.
const tags = new Set(['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 's', 'strike', 'span'])
const escapeText = text => text.replace(/&(?!(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function sanitizeHistoryHtml(value) {
    return String(value || '').split(/(<!--[\s\S]*?-->|<\/?[a-z](?:"[^"]*"|'[^']*'|[^'">])*>)/gi).map(part => {
        if (part.startsWith('<!--')) return ''
        const match = /^<(\/)?([a-z][\w:-]*)[\s\S]*>$/i.exec(part)
        if (!match) return escapeText(part)
        const tag = match[2].toLowerCase()
        if (!tags.has(tag)) return ''
        if (tag === 'br') return '<br>'
        return `<${match[1] ? '/' : ''}${tag}>`
    }).join('')
}
module.exports = { sanitizeHistoryHtml }

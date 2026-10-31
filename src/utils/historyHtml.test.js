const test = require('node:test')
const assert = require('node:assert/strict')
const { sanitizeHistoryHtml } = require('./historyHtml')
test('histórico conserva texto, parágrafos, listas e formatação básica', () => {
    const html = '<p>João &amp; Maria<br><strong>Relato</strong> <em>fato</em> <u>local</u></p><ol><li>Primeiro</li></ol>'
    assert.equal(sanitizeHistoryHtml(html), html)
})
test('histórico nunca emite atributos, scripts ou elementos ativos', () => {
    const result = sanitizeHistoryHtml('<p onclick="alert(1)">Texto<img src=x onerror=alert(1)><script>alert(2)</script><a href="javascript:x">link</a></p>')
    assert.equal(result, '<p>Textoalert(2)link</p>')
    assert.equal(sanitizeHistoryHtml('<svg/onload=alert(1)>texto</svg>'), 'texto')
    assert.equal(sanitizeHistoryHtml('2 < 3 e 4 > 1'), '2 &lt; 3 e 4 &gt; 1')
    assert.equal(sanitizeHistoryHtml('<p title="a > b">ok</p>'), '<p>ok</p>')
})

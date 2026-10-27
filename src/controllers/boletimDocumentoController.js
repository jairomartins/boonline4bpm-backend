const crypto = require('node:crypto')
const net = require('node:net')
const mongoose = require('mongoose')
const IncidentReport = require('../model/boletim')
const BoletimDocumento = require('../model/boletimDocumento')
const BoletimDocumentoAcesso = require('../model/boletimDocumentoAcesso')
const { gerarPdfBoletim } = require('../utils/boletimPdf')
const { getEffectiveAccess } = require('../utils/authorization')

const PDF_LAYOUT_VERSION = 3

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

function pdfHashMatches(documento) {
    if (!documento.pdf || !documento.pdfHash) return false
    const pdf = Buffer.from(documento.pdf)
    const calculated = crypto.createHash('sha256').update(pdf).digest()
    const expected = Buffer.from(documento.pdfHash, 'hex')
    return expected.length === calculated.length && crypto.timingSafeEqual(calculated, expected)
}

function validationUrl(token) {
    const isProduction = process.env.NODE_ENV === 'production'
    const configured = process.env.PUBLIC_VALIDATION_BASE_URL ||
        (!isProduction ? 'http://localhost:3000' : null)
    if (!configured) throw new Error('PUBLIC_VALIDATION_BASE_URL is required')
    const base = new URL(configured)
    const hostname = base.hostname.toLowerCase()
    const isLoopbackHost = ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
    const isLocalDevelopmentOrigin = !isProduction && isLoopbackHost &&
        ['http:', 'https:'].includes(base.protocol)
    if ((!isLocalDevelopmentOrigin && base.protocol !== 'https:') || base.pathname !== '/' ||
        base.search || base.hash || base.username || base.password ||
        !base.hostname ||
        (!isLocalDevelopmentOrigin && (
            net.isIP(base.hostname) ||
            isLoopbackHost ||
            hostname.endsWith('.local')
        ))) {
        throw new Error('PUBLIC_VALIDATION_BASE_URL must be an HTTPS domain origin')
    }
    return new URL(`/validar-boletim/${token}`, base.origin).toString()
}

async function canAccessReport(req, report) {
    const access = req.access || await getEffectiveAccess(req.user.userId)
    if (!access) return false
    return access.permissions.includes('boletins.view.all') ||
        (access.permissions.includes('boletins.view.own') &&
            String(report.creatorId) === String(req.user.userId))
}

function setPrivatePdfHeaders(res, numero, version) {
    const safeNumber = String(numero || 'boletim').replace(/[^a-zA-Z0-9_-]/g, '_')
    res.set({
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="BO_${safeNumber}_v${version}.pdf"`
    })
}

exports.emit = async (req, res) => {
    const { incidentReportId } = req.params
    if (!mongoose.Types.ObjectId.isValid(incidentReportId)) {
        return res.status(400).json({ message: 'ID de boletim inválido.' })
    }
    try {
        const report = await IncidentReport.findById(incidentReportId)
        if (!report || !await canAccessReport(req, report)) {
            return res.status(404).json({ message: 'Boletim não encontrado.' })
        }

        const reportRevision = Number(report.documentRevision) || 0
        if (Number(report.currentDocumentVersion) > 0) {
            const currentDocument = await BoletimDocumento.findOne({
                incidentReportId,
                version: report.currentDocumentVersion,
                reportRevision,
                pdfLayoutVersion: PDF_LAYOUT_VERSION,
                status: 'valid'
            }).select('+pdf')
            if (currentDocument && pdfHashMatches(currentDocument)) {
                setPrivatePdfHeaders(res, report.numero, currentDocument.version)
                res.set({
                    'X-Document-Version': String(currentDocument.version),
                    'X-Document-Issued-At': currentDocument.issuedAt.toISOString(),
                    'X-Document-Hash': currentDocument.pdfHash
                })
                return res.status(200).send(Buffer.from(currentDocument.pdf))
            }
        }

        const token = crypto.randomBytes(32).toString('base64url')
        const qrValidationUrl = validationUrl(token)
        const allocated = await IncidentReport.findByIdAndUpdate(
            incidentReportId,
            { $inc: { documentVersionSequence: 1 } },
            { new: true, select: 'documentVersionSequence' }
        )
        if (!allocated) return res.status(404).json({ message: 'Boletim não encontrado.' })
        const issuedAt = new Date()
        const pdf = await gerarPdfBoletim({
            report: report.toObject ? report.toObject() : report,
            validationUrl: qrValidationUrl
        })
        if (pdf.length > 12 * 1024 * 1024) {
            return res.status(413).json({
                message: 'O PDF excede o tamanho permitido para armazenamento seguro.'
            })
        }

        const currentReport = await IncidentReport.findById(incidentReportId)
        if (!currentReport || (Number(currentReport.documentRevision) || 0) !== reportRevision) {
            return res.status(409).json({
                message: 'O boletim foi alterado durante a emissão. Tente emitir novamente.'
            })
        }

        const documento = await BoletimDocumento.create({
            incidentReportId,
            version: allocated.documentVersionSequence,
            reportRevision,
            pdfLayoutVersion: PDF_LAYOUT_VERSION,
            tokenHash: hashToken(token),
            status: 'valid',
            issuedAt,
            issuedBy: String(req.user.userId),
            pdfHash: crypto.createHash('sha256').update(pdf).digest('hex'),
            pdf
        })
        const currentVersion = await IncidentReport.findOneAndUpdate(
            {
                _id: incidentReportId,
                $or: [
                    { documentRevision: reportRevision },
                    { documentRevision: { $exists: false } }
                ]
            },
            { $max: { currentDocumentVersion: documento.version } },
            { new: true, select: 'currentDocumentVersion' }
        )
        if (!currentVersion) {
            documento.status = 'superseded'
            documento.statusChangedAt = new Date()
            documento.statusChangedBy = String(req.user.userId)
            await documento.save()
            return res.status(409).json({
                message: 'O boletim foi alterado durante a emissão. Tente emitir novamente.'
            })
        }
        await BoletimDocumento.updateMany(
            {
                incidentReportId,
                version: { $lt: documento.version },
                status: { $ne: 'revoked' }
            },
            {
                $set: {
                    status: 'superseded',
                    statusChangedAt: new Date(),
                    statusChangedBy: String(req.user.userId)
                }
            }
        )

        setPrivatePdfHeaders(res, report.numero, documento.version)
        res.set({
            'X-Document-Version': String(documento.version),
            'X-Document-Issued-At': issuedAt.toISOString(),
            'X-Document-Hash': documento.pdfHash
        })
        return res.status(201).send(pdf)
    } catch (error) {
        console.error('Falha ao emitir cópia digital do boletim.')
        return res.status(503).json({
            message: 'Não foi possível emitir a cópia digital neste momento.'
        })
    }
}

exports.validate = async (req, res) => {
    const { token } = req.params
    res.set({
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    })
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        return res.status(200).json({
            valid: false,
            status: 'invalid',
            message: 'Não foi possível validar este documento.'
        })
    }
    try {
        const documento = await BoletimDocumento.findOne({ tokenHash: hashToken(token) })
            .select('+pdf')
        if (!documento) {
            return res.status(200).json({
                valid: false,
                status: 'invalid',
                message: 'Não foi possível validar este documento.'
            })
        }
        const report = await IncidentReport.findById(documento.incidentReportId)
        const integrityVerified = pdfHashMatches(documento)
        let status = documento.status
        if (status === 'valid' && (
            !report ||
            (Number(report.documentRevision) || 0) !== documento.reportRevision ||
            (Number(report.currentDocumentVersion) || 0) !== documento.version
        )) {
            status = 'superseded'
        }
        if (!integrityVerified) status = 'integrity_error'
        const valid = status === 'valid'
        return res.status(200).json({
            valid,
            status,
            version: documento.version,
            issuedAt: documento.issuedAt,
            integrityVerified
        })
    } catch (error) {
        return res.status(503).json({
            valid: false,
            status: 'unavailable',
            message: 'O serviço de validação está temporariamente indisponível.'
        })
    }
}

exports.details = async (req, res) => {
    const token = req.params.token
    res.set({
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        'X-Content-Type-Options': 'nosniff'
    })
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        return res.status(404).json({ message: 'Documento não encontrado.' })
    }
    try {
        const documento = await BoletimDocumento.findOne({ tokenHash: hashToken(token) })
            .select('+pdf')
        if (!documento || documento.status !== 'valid' || !pdfHashMatches(documento)) {
            return res.status(404).json({ message: 'Documento não encontrado ou não está mais válido.' })
        }
        const report = await IncidentReport.findById(documento.incidentReportId)
        if (!report || !await canAccessReport(req, report)) {
            return res.status(404).json({ message: 'Documento não encontrado.' })
        }
        if ((Number(report.documentRevision) || 0) !== documento.reportRevision ||
            (Number(report.currentDocumentVersion) || 0) !== documento.version) {
            return res.status(410).json({ message: 'Esta versão foi substituída.' })
        }
        return res.status(200).json({
            authorized: true,
            documentNumber: report.numero,
            version: documento.version,
            issuedAt: documento.issuedAt
        })
    } catch (error) {
        return res.status(503).json({ message: 'Não foi possível consultar os detalhes deste documento.' })
    }
}

exports.download = async (req, res) => {
    const token = req.params.token
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        return res.status(404).json({ message: 'Documento não encontrado.' })
    }
    try {
        const documento = await BoletimDocumento.findOne({ tokenHash: hashToken(token) })
            .select('+pdf')
        if (!documento || documento.status !== 'valid') {
            return res.status(404).json({ message: 'Documento não encontrado ou não está mais válido.' })
        }
        const report = await IncidentReport.findById(documento.incidentReportId)
        if (!report || !await canAccessReport(req, report)) {
            return res.status(404).json({ message: 'Documento não encontrado.' })
        }
        if ((Number(report.documentRevision) || 0) !== documento.reportRevision ||
            (Number(report.currentDocumentVersion) || 0) !== documento.version) {
            return res.status(410).json({ message: 'Esta versão foi substituída e não pode ser baixada.' })
        }
        if (!pdfHashMatches(documento)) {
            return res.status(409).json({ message: 'A integridade do arquivo não pôde ser confirmada.' })
        }
        await BoletimDocumentoAcesso.create({
            documentId: documento._id,
            incidentReportId: documento.incidentReportId,
            action: 'downloaded',
            actorId: String(req.user.userId)
        })
        setPrivatePdfHeaders(res, report.numero, documento.version)
        return res.status(200).send(Buffer.from(documento.pdf))
    } catch (error) {
        return res.status(503).json({ message: 'Não foi possível baixar o documento neste momento.' })
    }
}

exports.revoke = async (req, res) => {
    const token = req.params.token
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        return res.status(404).json({ message: 'Documento não encontrado.' })
    }
    try {
        const documento = await BoletimDocumento.findOne({ tokenHash: hashToken(token) })
        if (!documento) return res.status(404).json({ message: 'Documento não encontrado.' })
        const report = await IncidentReport.findById(documento.incidentReportId)
        if (!report || !await canAccessReport(req, report)) {
            return res.status(404).json({ message: 'Documento não encontrado.' })
        }
        if (documento.status !== 'valid') {
            return res.status(409).json({ message: 'Somente uma versão válida pode ser invalidada.' })
        }
        documento.status = 'revoked'
        documento.statusChangedAt = new Date()
        documento.statusChangedBy = String(req.user.userId)
        await documento.save()
        return res.status(200).json({ message: 'Versão documental invalidada.' })
    } catch (error) {
        return res.status(503).json({ message: 'Não foi possível invalidar o documento neste momento.' })
    }
}

exports.invalidarVersoesAnteriores = async (incidentReportId, userId) => {
    await BoletimDocumento.updateMany(
        { incidentReportId, status: 'valid' },
        {
            $set: {
                status: 'superseded',
                statusChangedAt: new Date(),
                statusChangedBy: String(userId)
            }
        }
    )
}

import PDFDocument from 'pdfkit'
import { formatMinor } from '../domain/money.js'
import type { QuoteSnapshot } from '../quote/snapshot.js'

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

const GRAY = '#6b7280'
const LINE = '#e5e7eb'

export function renderQuotePdf(snapshot: QuoteSnapshot): Promise<Buffer> {
  const { quote, items, workspace } = snapshot
  const accent = workspace.accentColor || '#4F46E5'
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true })

  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  let y = 48

  doc.font('Helvetica-Bold').fontSize(20).fillColor(accent).text(workspace.businessName, 48, y)
  y += 28

  const contact = [workspace.phone, workspace.address, workspace.website].filter(Boolean).join('  ·  ')
  if (contact) {
    doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(contact, 48, y)
    y += 14
  }

  y += 8
  doc.moveTo(48, y).lineTo(547, y).strokeColor(LINE).stroke()
  y += 20

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Quotation', 48, y)
  doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(`Ref ${quote.id.slice(0, 8)}`, 48, y + 20)
  doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(`Issued ${dateFmt.format(new Date(snapshot.issuedAt))}`, 48, y + 34)
  if (quote.expiryDate) {
    doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(`Valid until ${dateFmt.format(quote.expiryDate)}`, 48, y + 48)
  }

  y += 80

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Prepared for', 48, y)
  doc.font('Helvetica').fontSize(10).text(quote.clientName, 48, y + 16)
  const clientLine = [quote.clientCompany, quote.clientEmail, quote.clientPhone].filter(Boolean).join('\n')
  if (clientLine) doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(clientLine, 48, y + 32)

  y += 90

  const descX = 48
  const qtyX = 320
  const unitX = 370
  const amtX = 460

  doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY)
  doc.text('Description', descX, y)
  doc.text('Qty', qtyX, y)
  doc.text('Unit price', unitX, y)
  doc.text('Amount', amtX, y)
  y += 16
  doc.moveTo(48, y).lineTo(547, y).strokeColor(LINE).stroke()
  y += 10

  for (const item of items) {
    doc.font('Helvetica').fontSize(9).fillColor('#111827')
    doc.text(item.description, descX, y, { width: qtyX - descX - 10 })
    doc.text(String(item.quantity), qtyX, y)
    doc.text(formatMinor(item.unitPriceMinor, quote.currency), unitX, y)
    doc.text(formatMinor(item.quantity * item.unitPriceMinor, quote.currency), amtX, y, { width: 547 - amtX, align: 'right' })
    y += 18
  }

  y += 8
  doc.moveTo(48, y).lineTo(547, y).strokeColor(LINE).stroke()
  y += 12

  const right = (label: string, value: string, opts: { bold?: boolean } = {}) => {
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.bold ? 11 : 9).fillColor('#111827')
    doc.text(label, 350, y)
    doc.text(value, 460, y, { width: 547 - 460, align: 'right' })
    y += 16
  }

  right('Subtotal', formatMinor(quote.subtotalMinor, quote.currency))
  if (quote.discountMinor > 0) right('Discount', `-${formatMinor(quote.discountMinor, quote.currency)}`)
  if (quote.taxMinor > 0) right('Tax', formatMinor(quote.taxMinor, quote.currency))
  right('Total', formatMinor(quote.totalMinor, quote.currency), { bold: true })

  if (workspace.paymentInstructions) {
    y += 20
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Payment instructions', 48, y)
    doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(workspace.paymentInstructions, 48, y + 16)
  }

  if (quote.notes) {
    y += 50
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Notes', 48, y)
    doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(quote.notes, 48, y + 16)
  }

  doc.font('Helvetica').fontSize(8).fillColor(GRAY).text(
    `For questions contact ${workspace.replyToEmail}`,
    48,
    790,
    { align: 'center', width: 500 },
  )

  doc.end()
  return done
}

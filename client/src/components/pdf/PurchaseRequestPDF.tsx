import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// ==============================================
// TYPES
// ==============================================

export interface PRPDFCompany {
  company_name?: string;
  register_no?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  post_code?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface PRPDFSupplier {
  company_name?: string;
  register_no_new?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface PRPDFItem {
  item_name: string;
  item_description?: string;
  uom?: string;
  pri_quantity: number | string;
}

export interface PurchaseRequestPDFProps {
  prNo: string;
  referenceNo: string;
  terms: string;
  remarks: string;
  company: PRPDFCompany | null;
  supplier: PRPDFSupplier | null;
  items: PRPDFItem[];
  printedBy: string;
  printedAt: Date;
}

// ==============================================
// HELPERS
// ==============================================

const fmt = (v?: string | null): string => v || '—';

const fmtQty = (v: number | string): string => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return n % 1 === 0 ? String(n) : n.toFixed(2);
};

const fmtDateTime = (d: Date): string =>
  d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });

// ==============================================
// STYLES
// ==============================================
//
// Fixed footer layout (from bottom of page):
//   bottom 24  – page number bar        (~12 pt tall)
//   bottom 40  – signature block        (~72 pt tall)
//   paddingBottom 124 – keeps flowing content above all fixed elements
//
const s = StyleSheet.create({

  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000000',
    paddingTop: 36,
    paddingBottom: 124,   // reserves space for fixed signature + page-number footers
    paddingHorizontal: 40,
  },

  // ═══════════════════════════════════════════════════
  // SECTION 1 — Company header (centered block, left-aligned text)
  // ═══════════════════════════════════════════════════
  companyHeaderWrapper: {
    alignItems: 'center',       // centres the inner block horizontally
    marginBottom: 10,
  },
  companyHeaderBlock: {
    width: '100%',
  },
  companyName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 3,
  },
  companyInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  companyInfoText: {
    fontSize: 8,
    color: '#000000',
    marginRight: 10,
  },
  companyRegNoText: {
    fontSize: 7,
    color: '#000000',
    marginRight: 10,
  },

  // ═══════════════════════════════════════════════════
  // SECTION DIVIDER between S1 and S2
  // ═══════════════════════════════════════════════════
  sectionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginBottom: 10,
  },

  // ═══════════════════════════════════════════════════
  // SECTION 2 — Document title + Supplier / PR details
  // ═══════════════════════════════════════════════════
  docTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 10,
  },

  // Two-column row below the document title
  twoColRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  colLeft: {          // Supplier – 60 %
    flex: 6,
    paddingRight: 14,
  },
  colRight: {         // PR reference box – 40 %
    flex: 4,
  },

  // Supplier block (left column)
  sectionLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  supplierName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 3,
  },
  supplierInfo: {
    fontSize: 8,
    color: '#000000',
    marginBottom: 2,
  },

  // Reference box (right column)
  refBox: {
    borderWidth: 0.75,
    borderColor: '#000000',
  },
  refRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000',
  },
  refRowLast: {
    flexDirection: 'row',
  },
  refLabel: {
    width: 64,
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    borderRightWidth: 0.5,
    borderRightColor: '#000000',
  },
  refValue: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 8,
    color: '#000000',
  },

  // Remarks (bottom of section 2)
  remarksSection: {
    marginBottom: 10,
    minHeight: 28,
  },
  remarksText: {
    fontSize: 9,
    color: '#000000',
    marginTop: 2,
  },

  // ═══════════════════════════════════════════════════
  // SECTION 3 — Items table (no divider before it)
  // ═══════════════════════════════════════════════════
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRowAlt: {},
  tableCell: {
    fontSize: 9,
    color: '#000000',
  },
  tableCellMuted: {
    fontSize: 8,
    color: '#000000',
    marginTop: 1,
  },
  tableFooterRow: {
    flexDirection: 'row',
    borderTopWidth: 0.75,
    borderTopColor: '#000000',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },

  // Column widths
  colNo:  { width: 24 },
  colDesc: { flex: 1, paddingRight: 4 },
  colUom: { width: 54 },
  colQty: { width: 58 },

  // ═══════════════════════════════════════════════════
  // FIXED FOOTER — Signatures (appears on every page)
  // ═══════════════════════════════════════════════════
  signatureFooter: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
  },
  signatureTopBorder: {
    borderTopWidth: 0.75,
    borderTopColor: '#000000',
    marginBottom: 8,
  },
  signatureRow: {
    flexDirection: 'row',
  },
  signatureBlock: {
    flex: 1,
    paddingRight: 20,
  },
  signatureBlockRight: {
    flex: 1,
  },
  signatureTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 18,
  },
  signatureLine: {
    borderTopWidth: 0.75,
    borderTopColor: '#000000',
    marginBottom: 4,
    marginRight: 16,
  },
  signatureFieldLabel: {
    fontSize: 7.5,
    color: '#000000',
    marginBottom: 12,
  },

  // ═══════════════════════════════════════════════════
  // FIXED FOOTER — Page number bar (bottom of every page)
  // ═══════════════════════════════════════════════════
  pageFooter: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#000000',
    paddingTop: 4,
  },
  pageFooterText: {
    fontSize: 7.5,
    color: '#000000',
  },
});

// ==============================================
// COMPONENT
// ==============================================

const PurchaseRequestPDF: React.FC<PurchaseRequestPDFProps> = ({
  prNo,
  referenceNo,
  terms,
  remarks,
  company,
  supplier,
  items,
  printedBy,
  printedAt,
}) => {
  // Build address line for own company
  const companyAddrParts = [
    company?.address,
    company?.city,
    company?.state,
    company?.post_code,
    company?.country,
  ].filter(Boolean);

  return (
    <Document title={`Purchase Request ${prNo}`} author={printedBy}>
      <Page size="A4" style={s.page}>

        {/* ════════════════════════════════════════════════════
            FIXED FOOTER — Page number (rendered first so it
            sits behind content on every page)
        ════════════════════════════════════════════════════ */}
        <View style={s.pageFooter} fixed>
          <Text style={s.pageFooterText}>{prNo}</Text>
          <Text
            style={s.pageFooterText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>

        {/* ════════════════════════════════════════════════════
            FIXED FOOTER — Signatures (above page-number bar)
        ════════════════════════════════════════════════════ */}
        <View style={s.signatureFooter} fixed>
          <View style={s.signatureTopBorder} />
          <View style={s.signatureRow}>
            <View style={s.signatureBlock}>
              <Text style={s.signatureTitle}>Prepared By</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureFieldLabel}>Signature</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureFieldLabel}>Name &amp; Date</Text>
            </View>
            <View style={s.signatureBlockRight}>
              <Text style={s.signatureTitle}>Received By</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureFieldLabel}>Signature</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureFieldLabel}>Name &amp; Date</Text>
            </View>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════
            SECTION 1 — Own Company Details
            Centred block on the page; text starts from the
            left edge of the block (not centre-aligned text).
        ════════════════════════════════════════════════════ */}
        <View style={s.companyHeaderWrapper}>
          <View style={s.companyHeaderBlock}>
            <Text style={s.companyName}>
              {company?.company_name || 'Your Company Name'}
            </Text>

            {/* Reg No */}
            {company?.register_no ? (
              <View style={s.companyInfoRow}>
                <Text style={s.companyRegNoText}>Reg No: {company.register_no}</Text>
              </View>
            ) : null}

            {/* Address (city / state / post_code / country) */}
            {companyAddrParts.length > 0 ? (
              <View style={s.companyInfoRow}>
                <Text style={s.companyInfoText}>{companyAddrParts.join(', ')}</Text>
              </View>
            ) : null}

            {/* Phone + Email on the same row */}
            {(company?.phone || company?.email) ? (
              <View style={s.companyInfoRow}>
                {company?.phone ? (
                  <Text style={s.companyInfoText}>Tel: {company.phone}</Text>
                ) : null}
                {company?.email ? (
                  <Text style={s.companyInfoText}>Email: {company.email}</Text>
                ) : null}
              </View>
            ) : null}

            {/* Website */}
            {company?.website ? (
              <View style={s.companyInfoRow}>
                <Text style={s.companyInfoText}>{company.website}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Long divider separating Section 1 from Section 2 */}
        <View style={s.sectionDivider} />

        {/* ════════════════════════════════════════════════════
            SECTION 2 — Document Title + Supplier / PR Details
        ════════════════════════════════════════════════════ */}

        {/* Centred document title */}
        <Text style={s.docTitle}>PURCHASE REQUEST</Text>

        {/* Two-column row: Supplier (60%) | PR Reference (40%) */}
        <View style={s.twoColRow}>

          {/* ── Left 60%: Supplier ── */}
          <View style={s.colLeft}>
            <Text style={s.sectionLabel}>TO:</Text>

            {supplier?.company_name ? (
              <Text style={s.supplierName}>{supplier.company_name}</Text>
            ) : (
              <Text style={[s.supplierName, { color: '#000000' }]}>
                — No supplier selected —
              </Text>
            )}

            {supplier?.register_no_new ? (
              <Text style={s.supplierInfo}>Reg No: {supplier.register_no_new}</Text>
            ) : null}

            {supplier?.address ? (
              <Text style={s.supplierInfo}>{supplier.address}</Text>
            ) : null}

            {supplier?.phone ? (
              <Text style={s.supplierInfo}>Tel: {supplier.phone}</Text>
            ) : null}

            {supplier?.email ? (
              <Text style={s.supplierInfo}>Email: {supplier.email}</Text>
            ) : null}
          </View>

          {/* ── Right 40%: PR Reference box ── */}
          <View style={s.colRight}>
            <View style={s.refBox}>
              <View style={s.refRow}>
                <Text style={s.refLabel}>PR No.</Text>
                <Text style={s.refValue}>{fmt(prNo)}</Text>
              </View>
              <View style={s.refRow}>
                <Text style={s.refLabel}>Ref No.</Text>
                <Text style={s.refValue}>{fmt(referenceNo)}</Text>
              </View>
              <View style={s.refRow}>
                <Text style={s.refLabel}>Terms</Text>
                <Text style={s.refValue}>{fmt(terms)}</Text>
              </View>
              <View style={s.refRow}>
                <Text style={s.refLabel}>Printed On</Text>
                <Text style={s.refValue}>{fmtDateTime(printedAt)}</Text>
              </View>
              <View style={s.refRow}>
                <Text style={s.refLabel}>Printed By</Text>
                <Text style={s.refValue}>{fmt(printedBy)}</Text>
              </View>
              <View style={s.refRowLast}>
                <Text style={s.refLabel}>Page</Text>
                <Text
                  style={s.refValue}
                  render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`}
                />
              </View>
            </View>
          </View>
        </View>

        {/* ── Remarks (bottom of Section 2) ── */}
        <View style={s.remarksSection}>
          <Text style={s.sectionLabel}>REMARKS</Text>
          {remarks ? (
            <Text style={s.remarksText}>{remarks}</Text>
          ) : null}
        </View>

        {/* ════════════════════════════════════════════════════
            SECTION 3 — Items Table (no divider before it)
        ════════════════════════════════════════════════════ */}

        {/* Table header */}
        <View style={s.tableHeader}>
          <View style={s.colNo}>
            <Text style={s.tableHeaderText}>No.</Text>
          </View>
          <View style={s.colDesc}>
            <Text style={s.tableHeaderText}>Item Description</Text>
          </View>
          <View style={s.colUom}>
            <Text style={s.tableHeaderText}>UOM</Text>
          </View>
          <View style={s.colQty}>
            <Text style={[s.tableHeaderText, { textAlign: 'right' }]}>Qty</Text>
          </View>
        </View>

        {/* Table rows */}
        {items.length === 0 ? (
          <View style={s.tableRow}>
            <View style={s.colNo} />
            <View style={s.colDesc}>
              <Text style={[s.tableCell, { color: '#000000' }]}>No items.</Text>
            </View>
            <View style={s.colUom} />
            <View style={s.colQty} />
          </View>
        ) : (
          items.map((item, index) => (
            <View
              key={index}
              style={[s.tableRow, index % 2 === 1 ? s.tableRowAlt : {}]}
              wrap={false}
            >
              <View style={s.colNo}>
                <Text style={s.tableCell}>{index + 1}</Text>
              </View>
              <View style={s.colDesc}>
                <Text style={s.tableCell}>{item.item_name}</Text>
                {item.item_description && item.item_description !== item.item_name ? (
                  <Text style={s.tableCellMuted}>{item.item_description}</Text>
                ) : null}
              </View>
              <View style={s.colUom}>
                <Text style={s.tableCell}>{fmt(item.uom)}</Text>
              </View>
              <View style={s.colQty}>
                <Text style={[s.tableCell, { textAlign: 'right' }]}>
                  {fmtQty(item.pri_quantity)}
                </Text>
              </View>
            </View>
          ))
        )}


      </Page>
    </Document>
  );
};

export default PurchaseRequestPDF;

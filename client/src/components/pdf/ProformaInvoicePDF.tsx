import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// ==============================================
// TYPES
// ==============================================

export interface PIPDFCompany {
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

export interface PIPDFCustomer {
  company_name?: string;
  register_no_new?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface PIPDFItem {
  item_name: string;
  item_description?: string;
  uom?: string;
  pi_quantity: number | string;
  unit_price: number | string;
  line_total: number | string;
}

export interface ProformaInvoicePDFProps {
  piNo: string;
  referenceNo: string;
  terms: string;
  remarks: string;
  totalAmount: number | string;
  company: PIPDFCompany | null;
  customer: PIPDFCustomer | null;
  items: PIPDFItem[];
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

const fmtAmount = (v: number | string): string => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDateTime = (d: Date): string =>
  d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });

// ==============================================
// STYLES
// ==============================================

const s = StyleSheet.create({

  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000000',
    paddingTop: 36,
    paddingBottom: 168,
    paddingHorizontal: 40,
  },

  // ═══════════════════════════════════════════════════
  // SECTION 1 — Company header
  // ═══════════════════════════════════════════════════
  companyHeaderWrapper: {
    alignItems: 'center',
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
  // SECTION DIVIDER
  // ═══════════════════════════════════════════════════
  sectionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginBottom: 10,
  },

  // ═══════════════════════════════════════════════════
  // SECTION 2 — Document title + Customer / PI details
  // ═══════════════════════════════════════════════════
  docTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 10,
  },

  twoColRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  colLeft: {
    flex: 6,
    paddingRight: 14,
  },
  colRight: {
    flex: 4,
  },

  sectionLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 3,
  },
  customerInfo: {
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

  // Remarks
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
  // SECTION 3 — Items table
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

  // Column widths
  colNo:        { width: 24 },
  colDesc:      { flex: 1, paddingRight: 4 },
  colUom:       { width: 44 },
  colQty:       { width: 40 },
  colUnitPrice: { width: 60 },
  colLineTotal: { width: 66 },

  // ═══════════════════════════════════════════════════
  // FIXED FOOTER — Total Amount + Signatures
  // ═══════════════════════════════════════════════════
  signatureFooter: {
    position: 'absolute',
    bottom: 44,
    left: 40,
    right: 40,
  },

  totalPayableRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  totalPayableBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  totalPayableLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  totalPayableValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
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
  // FIXED FOOTER — Page number bar
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

const ProformaInvoicePDF: React.FC<ProformaInvoicePDFProps> = ({
  piNo,
  referenceNo,
  terms,
  remarks,
  totalAmount,
  company,
  customer,
  items,
  printedBy,
  printedAt,
}) => {
  const companyAddrParts = [
    company?.address,
    company?.city,
    company?.state,
    company?.post_code,
    company?.country,
  ].filter(Boolean);

  return (
    <Document title={`Proforma Invoice ${piNo}`} author={printedBy}>
      <Page size="A4" style={s.page}>

        {/* ════════════════════════════════════════════════════
            FIXED FOOTER — Page number
        ════════════════════════════════════════════════════ */}
        <View style={s.pageFooter} fixed>
          <Text style={s.pageFooterText}>{piNo}</Text>
          <Text
            style={s.pageFooterText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>

        {/* ════════════════════════════════════════════════════
            FIXED FOOTER — Total Amount + Signatures
        ════════════════════════════════════════════════════ */}
        <View style={s.signatureFooter} fixed>
          <View style={s.signatureTopBorder} />

          <View style={s.totalPayableRow}>
            <View style={s.totalPayableBlock}>
              <Text style={s.totalPayableLabel}>TOTAL AMOUNT:</Text>
              <Text style={s.totalPayableValue}>{fmtAmount(totalAmount)}</Text>
            </View>
          </View>

          <View style={s.signatureRow}>
            <View style={s.signatureBlock}>
              <Text style={s.signatureTitle}>Prepared By</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureFieldLabel}>Signature</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureFieldLabel}>Name &amp; Date</Text>
            </View>
            <View style={s.signatureBlockRight}>
              <Text style={s.signatureTitle}>Approved By</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureFieldLabel}>Signature</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureFieldLabel}>Name &amp; Date</Text>
            </View>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════
            SECTION 1 — Own Company Details
        ════════════════════════════════════════════════════ */}
        <View style={s.companyHeaderWrapper}>
          <View style={s.companyHeaderBlock}>
            <Text style={s.companyName}>
              {company?.company_name || 'Your Company Name'}
            </Text>

            {company?.register_no ? (
              <View style={s.companyInfoRow}>
                <Text style={s.companyRegNoText}>Reg No: {company.register_no}</Text>
              </View>
            ) : null}

            {companyAddrParts.length > 0 ? (
              <View style={s.companyInfoRow}>
                <Text style={s.companyInfoText}>{companyAddrParts.join(', ')}</Text>
              </View>
            ) : null}

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

            {company?.website ? (
              <View style={s.companyInfoRow}>
                <Text style={s.companyInfoText}>{company.website}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={s.sectionDivider} />

        {/* ════════════════════════════════════════════════════
            SECTION 2 — Document Title + Customer / PI Details
        ════════════════════════════════════════════════════ */}

        <Text style={s.docTitle}>PROFORMA INVOICE</Text>

        <View style={s.twoColRow}>

          {/* ── Left 60%: Customer ── */}
          <View style={s.colLeft}>
            <Text style={s.sectionLabel}>TO:</Text>

            {customer?.company_name ? (
              <Text style={s.customerName}>{customer.company_name}</Text>
            ) : (
              <Text style={[s.customerName, { color: '#000000' }]}>
                — No customer selected —
              </Text>
            )}

            {customer?.register_no_new ? (
              <Text style={s.customerInfo}>Reg No: {customer.register_no_new}</Text>
            ) : null}

            {customer?.address ? (
              <Text style={s.customerInfo}>{customer.address}</Text>
            ) : null}

            {customer?.phone ? (
              <Text style={s.customerInfo}>Tel: {customer.phone}</Text>
            ) : null}

            {customer?.email ? (
              <Text style={s.customerInfo}>Email: {customer.email}</Text>
            ) : null}
          </View>

          {/* ── Right 40%: PI Reference box ── */}
          <View style={s.colRight}>
            <View style={s.refBox}>
              <View style={s.refRow}>
                <Text style={s.refLabel}>PI No.</Text>
                <Text style={s.refValue}>{fmt(piNo)}</Text>
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

        {/* ── Remarks ── */}
        <View style={s.remarksSection}>
          <Text style={s.sectionLabel}>REMARKS</Text>
          {remarks ? (
            <Text style={s.remarksText}>{remarks}</Text>
          ) : null}
        </View>

        {/* ════════════════════════════════════════════════════
            SECTION 3 — Items Table
        ════════════════════════════════════════════════════ */}

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
          <View style={s.colUnitPrice}>
            <Text style={[s.tableHeaderText, { textAlign: 'right' }]}>Price/Unit</Text>
          </View>
          <View style={s.colLineTotal}>
            <Text style={[s.tableHeaderText, { textAlign: 'right' }]}>Total Price</Text>
          </View>
        </View>

        {items.length === 0 ? (
          <View style={s.tableRow}>
            <View style={s.colNo} />
            <View style={s.colDesc}>
              <Text style={[s.tableCell, { color: '#000000' }]}>No items.</Text>
            </View>
            <View style={s.colUom} />
            <View style={s.colQty} />
            <View style={s.colUnitPrice} />
            <View style={s.colLineTotal} />
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
                  {fmtQty(item.pi_quantity)}
                </Text>
              </View>
              <View style={s.colUnitPrice}>
                <Text style={[s.tableCell, { textAlign: 'right' }]}>
                  {fmtAmount(item.unit_price)}
                </Text>
              </View>
              <View style={s.colLineTotal}>
                <Text style={[s.tableCell, { textAlign: 'right' }]}>
                  {fmtAmount(item.line_total)}
                </Text>
              </View>
            </View>
          ))
        )}

      </Page>
    </Document>
  );
};

export default ProformaInvoicePDF;

import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  type InvoiceSettings,
  formatInvoiceNumber,
  formatPreviewDate,
} from './invoice-settings.types';
import { PREVIEW_LINE_ITEMS, computeInvoiceTotals, formatInr } from './invoice-preview-data';
import type { CompanyBranding } from './company-branding';

const ORANGE = '#FF7700';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#171717',
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: '55%',
  },
  logo: {
    width: 56,
    height: 56,
    objectFit: 'contain',
  },
  companyName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  gstin: {
    marginTop: 4,
    fontSize: 8,
    color: '#737373',
  },
  invoiceTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  metaBlock: {
    marginTop: 10,
    textAlign: 'right',
    fontSize: 9,
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 20,
  },
  sectionCol: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  muted: {
    color: '#525252',
    lineHeight: 1.4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: ORANGE,
    color: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#fdba74',
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 9,
  },
  colDesc: { flex: 1 },
  colPrice: { width: 70, textAlign: 'center' },
  colQty: { width: 40, textAlign: 'center' },
  colSub: { width: 80, textAlign: 'right' },
  footerRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingVertical: 6,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: ORANGE,
    color: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  signature: {
    marginTop: 28,
    textAlign: 'center',
    fontSize: 9,
  },
  signatureImage: {
    width: 120,
    height: 48,
    objectFit: 'contain',
    alignSelf: 'center',
    marginBottom: 8,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#a3a3a3',
    width: 140,
    alignSelf: 'center',
    marginBottom: 6,
  },
  gstHeader: {
    flexDirection: 'row',
    backgroundColor: ORANGE,
    color: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textTransform: 'uppercase',
  },
  gstRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  gstCol: { flex: 1 },
  gstColRight: { flex: 1, textAlign: 'right' },
});

export function ModernInvoicePdfDocument({
  form,
  branding,
}: {
  form: InvoiceSettings;
  branding: CompanyBranding;
}) {
  const totals = computeInvoiceTotals(form);

  return (
    <Document title={`Invoice ${formatInvoiceNumber(form)}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {branding.logo ? <Image src={branding.logo} style={styles.logo} /> : null}
            <View>
              <Text style={styles.companyName}>{form.seller.name}</Text>
              <Text style={styles.gstin}>GSTIN: {form.seller.gstin}</Text>
            </View>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>{form.invoiceTitle}</Text>
            <View style={styles.metaBlock}>
              <Text>
                <Text style={styles.metaLabel}>Invoice No: </Text>
                {formatInvoiceNumber(form)}
              </Text>
              <Text>
                <Text style={styles.metaLabel}>Due Date: </Text>
                {formatPreviewDate(form.defaultDueDays)}
              </Text>
              <Text>
                <Text style={styles.metaLabel}>Invoice Date: </Text>
                {formatPreviewDate(0)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <View style={styles.sectionCol}>
            <Text style={styles.sectionTitle}>Invoice To:</Text>
            <Text style={styles.bold}>ABC Client Pvt. Ltd.</Text>
            <Text style={styles.muted}>Mr. Rahul Sharma</Text>
            <Text style={styles.muted}>Finance Manager</Text>
            <Text style={[styles.muted, { marginTop: 6 }]}>
              Phone: +91 98765 98765{'\n'}
              Email: accounts@abcclient.com{'\n'}
              Address: 402, Sunrise Corporate Park, Pune - 411014, Maharashtra, India{'\n'}
              GSTIN: 27ABCDE1234F1Z5
            </Text>
          </View>
          <View style={styles.sectionCol}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <Text style={styles.muted}>
              <Text style={styles.bold}>Account No: </Text>
              {form.bank.accountNumber}{'\n'}
              <Text style={styles.bold}>Account Name: </Text>
              {form.bank.accountName}{'\n'}
              <Text style={styles.bold}>Bank Name: </Text>
              {form.bank.bankName}{'\n'}
              <Text style={styles.bold}>IFSC Code: </Text>
              {form.bank.ifscCode}{'\n'}
              <Text style={styles.bold}>UPI ID: </Text>
              {form.bank.upiId}
            </Text>
          </View>
        </View>

        <View>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colPrice}>Price</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colSub}>Subtotal</Text>
          </View>
          {PREVIEW_LINE_ITEMS.map((item) => (
            <View key={item.description} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colPrice}>{formatInr(item.unitPrice)}</Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colSub}>{formatInr(item.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footerRow}>
          <View style={styles.sectionCol}>
            <Text style={styles.sectionTitle}>Terms and Conditions</Text>
            <Text style={styles.muted}>{form.termsAndConditions}</Text>
            <Text style={[styles.muted, { marginTop: 4 }]}>{form.latePaymentNote}</Text>
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>{form.thankYouNote}</Text>
            <Text style={[styles.muted, { marginTop: 6 }]}>
              Phone: {form.seller.phone}{'\n'}
              Email: {form.billingSupportEmail}{'\n'}
              Website: {form.seller.website}
            </Text>
            {form.showAmountInWords && (
              <Text style={[styles.muted, { marginTop: 8 }]}>
                <Text style={styles.bold}>Amount in Words: </Text>
                Rupees Nine Thousand Four Hundred Thirty-Nine Only
              </Text>
            )}
          </View>

          <View style={styles.sectionCol}>
            <View style={styles.totalRow}>
              <Text style={styles.bold}>Sub-total :</Text>
              <Text>{formatInr(totals.subTotal)}</Text>
            </View>
            {form.showDiscount && (
              <View style={styles.totalRow}>
                <Text style={styles.bold}>Discount :</Text>
                <Text>{formatInr(totals.discount)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text>CGST @ {form.cgstRate}% :</Text>
              <Text>{formatInr(totals.cgst)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>SGST @ {form.sgstRate}% :</Text>
              <Text>{formatInr(totals.sgst)}</Text>
            </View>
            <View style={styles.grandTotal}>
              <Text>Total :</Text>
              <Text>{formatInr(form.enableRounding ? totals.roundedTotal : totals.grandTotal)}</Text>
            </View>
            <View style={styles.signature}>
              {branding.signature ? (
                <Image src={branding.signature} style={styles.signatureImage} />
              ) : (
                <View style={styles.signatureLine} />
              )}
              <Text style={styles.bold}>{form.signatoryName}</Text>
              <Text style={styles.muted}>{form.signatoryTitle}</Text>
              {!branding.signature && (
                <Text style={[styles.muted, { marginTop: 4 }]}>{form.digitalSignatureNote}</Text>
              )}
            </View>
          </View>
        </View>

        {form.showGstSummary && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>GST Summary</Text>
            <View style={styles.gstHeader}>
              <Text style={styles.gstCol}>Tax Rate</Text>
              <Text style={styles.gstCol}>Taxable</Text>
              <Text style={styles.gstCol}>CGST</Text>
              <Text style={styles.gstCol}>SGST</Text>
              <Text style={styles.gstColRight}>Total Tax</Text>
            </View>
            <View style={styles.gstRow}>
              <Text style={styles.gstCol}>{form.cgstRate + form.sgstRate}%</Text>
              <Text style={styles.gstCol}>{formatInr(totals.taxable)}</Text>
              <Text style={styles.gstCol}>{formatInr(totals.cgst)}</Text>
              <Text style={styles.gstCol}>{formatInr(totals.sgst)}</Text>
              <Text style={styles.gstColRight}>{formatInr(totals.taxTotal)}</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}

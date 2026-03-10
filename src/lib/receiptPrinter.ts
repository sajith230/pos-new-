// Receipt printing utilities: Window print, Web Serial (ESC/POS), and connection management

export interface ReceiptPrintData {
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessTaxId?: string;
  transactionNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  discountPercent: number;
  total: number;
  paymentMethod: string;
  customerName?: string;
  date: string;
  receiptHeader?: string;
  receiptFooter?: string;
}

export type PaperSize = '80mm' | '58mm';
export type PrinterConnectionType = 'serial' | 'bluetooth' | 'window';

interface PrinterPreferences {
  paperSize: PaperSize;
  autoPrint: boolean;
  connectionType: PrinterConnectionType;
  receiptHeader: string;
  receiptFooter: string;
  showTaxBreakdown: boolean;
}

const DEFAULT_PREFS: PrinterPreferences = {
  paperSize: '80mm',
  autoPrint: false,
  connectionType: 'window',
  receiptHeader: '',
  receiptFooter: 'Thank you for your purchase!',
  showTaxBreakdown: true,
};

// Preferences stored in localStorage
export function getPrinterPreferences(): PrinterPreferences {
  try {
    const stored = localStorage.getItem('printer_preferences');
    if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_PREFS;
}

export function savePrinterPreferences(prefs: Partial<PrinterPreferences>) {
  const current = getPrinterPreferences();
  const updated = { ...current, ...prefs };
  localStorage.setItem('printer_preferences', JSON.stringify(updated));
  return updated;
}

// ============ Window Print ============

export function printViaWindow(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const prefs = getPrinterPreferences();
  const width = prefs.paperSize === '80mm' ? '80mm' : '58mm';

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    // Fallback to window.print()
    window.print();
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt</title>
      <style>
        @page { size: ${width} auto; margin: 2mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          width: ${width};
          color: #000;
          background: #fff;
        }
        .receipt-center { text-align: center; }
        .receipt-bold { font-weight: bold; }
        .receipt-separator { border-top: 1px dashed #000; margin: 4px 0; }
        .receipt-row { display: flex; justify-content: space-between; }
        .receipt-row-right { text-align: right; }
        .receipt-total { font-size: 14px; font-weight: bold; }
        .receipt-small { font-size: 10px; }
      </style>
    </head>
    <body>${el.innerHTML}</body>
    </html>
  `);

  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
}

// ============ ESC/POS Command Generation ============

const ESC = 0x1b;
const GS = 0x1d;

const ESCPOS = {
  INIT: [ESC, 0x40],
  CENTER: [ESC, 0x61, 0x01],
  LEFT: [ESC, 0x61, 0x00],
  RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  CUT: [GS, 0x56, 0x00],
  PARTIAL_CUT: [GS, 0x56, 0x01],
  FEED_LINES: (n: number) => [ESC, 0x64, n],
};

function textToBytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function padRight(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : ' '.repeat(width - text.length) + text;
}

function dashedLine(width: number): string {
  return '-'.repeat(width);
}

export function generateESCPOS(data: ReceiptPrintData): Uint8Array {
  const prefs = getPrinterPreferences();
  const lineWidth = prefs.paperSize === '80mm' ? 48 : 32;
  const bytes: number[] = [];

  const push = (...b: number[]) => bytes.push(...b);
  const pushText = (t: string) => push(...textToBytes(t + '\n'));

  // Initialize
  push(...ESCPOS.INIT);

  // Header
  push(...ESCPOS.CENTER);
  if (data.receiptHeader) {
    pushText(data.receiptHeader);
  }
  push(...ESCPOS.BOLD_ON);
  push(...ESCPOS.DOUBLE_HEIGHT);
  pushText(data.businessName);
  push(...ESCPOS.NORMAL_SIZE);
  push(...ESCPOS.BOLD_OFF);

  if (data.businessAddress) pushText(data.businessAddress);
  if (data.businessPhone) pushText(`Tel: ${data.businessPhone}`);
  if (data.businessTaxId) pushText(`Tax ID: ${data.businessTaxId}`);

  push(...ESCPOS.LEFT);
  pushText(dashedLine(lineWidth));

  // Transaction info
  pushText(`Txn #: ${data.transactionNumber}`);
  pushText(`Date: ${data.date}`);
  if (data.customerName) pushText(`Customer: ${data.customerName}`);
  pushText(`Payment: ${data.paymentMethod.toUpperCase()}`);

  pushText(dashedLine(lineWidth));

  // Column headers
  const nameW = lineWidth - 14;
  pushText(padRight('Item', nameW) + padLeft('Qty', 4) + padLeft('Amount', 10));
  pushText(dashedLine(lineWidth));

  // Items
  for (const item of data.items) {
    const name = item.name.length > nameW ? item.name.slice(0, nameW) : item.name;
    const qty = padLeft(String(item.quantity), 4);
    const amt = padLeft(`₹${item.total.toFixed(2)}`, 10);
    pushText(padRight(name, nameW) + qty + amt);
    if (item.name.length > nameW) {
      // Print remaining name on next line
      pushText('  ' + item.name.slice(nameW));
    }
  }

  pushText(dashedLine(lineWidth));

  // Totals
  const printTotalLine = (label: string, amount: string) => {
    pushText(padRight(label, lineWidth - 12) + padLeft(amount, 12));
  };

  printTotalLine('Subtotal', `₹${data.subtotal.toFixed(2)}`);

  if (prefs.showTaxBreakdown) {
    printTotalLine('Tax', `₹${data.taxAmount.toFixed(2)}`);
  }

  if (data.discountAmount > 0 || data.discountPercent > 0) {
    const discLabel = data.discountPercent > 0 ? `Discount (${data.discountPercent}%)` : 'Discount';
    const discAmt = data.discountPercent > 0
      ? (data.subtotal + data.taxAmount) * data.discountPercent / 100
      : data.discountAmount;
    printTotalLine(discLabel, `-₹${discAmt.toFixed(2)}`);
  }

  pushText(dashedLine(lineWidth));

  push(...ESCPOS.BOLD_ON);
  push(...ESCPOS.DOUBLE_HEIGHT);
  printTotalLine('TOTAL', `₹${data.total.toFixed(2)}`);
  push(...ESCPOS.NORMAL_SIZE);
  push(...ESCPOS.BOLD_OFF);

  pushText(dashedLine(lineWidth));

  // Footer
  push(...ESCPOS.CENTER);
  pushText(data.receiptFooter || 'Thank you for your purchase!');

  // Feed and cut
  push(...ESCPOS.FEED_LINES(4));
  push(...ESCPOS.PARTIAL_CUT);

  return new Uint8Array(bytes);
}

// ============ Web Serial Connection ============

let serialPort: any = null;
let serialWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;

export function isWebSerialSupported(): boolean {
  return 'serial' in (navigator as any);
}

export function isWebBluetoothSupported(): boolean {
  return 'bluetooth' in navigator;
}

export async function connectSerialPrinter(): Promise<boolean> {
  if (!isWebSerialSupported()) return false;

  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 });
    serialPort = port;
    if (port.writable) {
      serialWriter = port.writable.getWriter();
    }
    return true;
  } catch (e) {
    console.error('Serial connection failed:', e);
    return false;
  }
}

export async function disconnectSerialPrinter(): Promise<void> {
  try {
    if (serialWriter) {
      serialWriter.releaseLock();
      serialWriter = null;
    }
    if (serialPort) {
      await serialPort.close();
      serialPort = null;
    }
  } catch (e) {
    console.error('Disconnect error:', e);
  }
}

export function isSerialConnected(): boolean {
  return serialPort !== null && serialWriter !== null;
}

export async function printViaSerial(data: ReceiptPrintData): Promise<boolean> {
  if (!serialWriter) return false;

  try {
    const bytes = generateESCPOS(data);
    await serialWriter.write(bytes);
    return true;
  } catch (e) {
    console.error('Serial print failed:', e);
    return false;
  }
}

// ============ Unified Print Function ============

export async function printReceipt(data: ReceiptPrintData, elementId?: string): Promise<void> {
  const prefs = getPrinterPreferences();

  if (prefs.connectionType === 'serial' && isSerialConnected()) {
    const success = await printViaSerial(data);
    if (success) return;
    // Fall through to window print if serial fails
  }

  // Default: window print
  if (elementId) {
    printViaWindow(elementId);
  } else {
    window.print();
  }
}

// Test print
export async function testPrint(): Promise<void> {
  const testData: ReceiptPrintData = {
    businessName: 'Test Business',
    businessAddress: '123 Test Street',
    businessPhone: '+91 12345 67890',
    transactionNumber: 'TEST-001',
    items: [
      { name: 'Test Item 1', quantity: 2, unitPrice: 100, total: 200 },
      { name: 'Test Item 2', quantity: 1, unitPrice: 50, total: 50 },
    ],
    subtotal: 250,
    taxAmount: 25,
    discountAmount: 0,
    discountPercent: 0,
    total: 275,
    paymentMethod: 'cash',
    date: new Date().toLocaleString(),
  };

  if (isSerialConnected()) {
    await printViaSerial(testData);
  } else {
    console.log('No serial printer connected. Test data:', testData);
    console.log('ESC/POS bytes generated:', generateESCPOS(testData).length, 'bytes');
  }
}

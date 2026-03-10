import { format } from 'date-fns';
import { getPrinterPreferences } from '@/lib/receiptPrinter';
import { formatCurrency } from '@/lib/formatCurrency';

export interface ThermalReceiptProps {
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
  currency?: string;
}

export default function ThermalReceipt({
  businessName,
  businessAddress,
  businessPhone,
  businessTaxId,
  transactionNumber,
  items,
  subtotal,
  taxAmount,
  discountAmount,
  discountPercent,
  total,
  paymentMethod,
  customerName,
  date,
  currency = 'INR',
}: ThermalReceiptProps) {
  const prefs = getPrinterPreferences();
  const widthClass = prefs.paperSize === '58mm' ? 'max-w-[58mm]' : 'max-w-[80mm]';
  const fc = (amount: number) => formatCurrency(amount, currency);

  const discountTotal = discountPercent > 0
    ? (subtotal + taxAmount) * discountPercent / 100
    : discountAmount;

  return (
    <div
      id="thermal-receipt"
      className={`${widthClass} mx-auto font-mono text-xs leading-tight text-foreground`}
    >
      {/* Header */}
      {prefs.receiptHeader && (
        <p className="text-center text-[10px] text-muted-foreground mb-1">{prefs.receiptHeader}</p>
      )}
      <div className="text-center mb-2">
        <h3 className="font-bold text-sm">{businessName}</h3>
        {businessAddress && <p className="text-[10px] text-muted-foreground">{businessAddress}</p>}
        {businessPhone && <p className="text-[10px] text-muted-foreground">Tel: {businessPhone}</p>}
        {businessTaxId && <p className="text-[10px] text-muted-foreground">Tax ID: {businessTaxId}</p>}
      </div>

      <div className="border-t border-dashed border-border" />

      {/* Transaction info */}
      <div className="py-1 space-y-0.5 text-[10px] text-muted-foreground">
        <div className="flex justify-between">
          <span>Txn #: {transactionNumber}</span>
          <span>{format(new Date(date), 'dd/MM/yy h:mm a')}</span>
        </div>
        {customerName && <p>Customer: {customerName}</p>}
        <p>Payment: {paymentMethod.toUpperCase()}</p>
      </div>

      <div className="border-t border-dashed border-border" />

      {/* Items */}
      <div className="py-1 space-y-0.5">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between">
            <span className="flex-1 truncate mr-2">
              {item.name} ×{item.quantity}
            </span>
            <span className="whitespace-nowrap">{fc(item.total)}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-border" />

      {/* Totals */}
      <div className="py-1 space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{fc(subtotal)}</span>
        </div>
        {prefs.showTaxBreakdown && (
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{fc(taxAmount)}</span>
          </div>
        )}
        {discountTotal > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount {discountPercent > 0 ? `(${discountPercent}%)` : ''}</span>
            <span>-{fc(discountTotal)}</span>
          </div>
        )}
        <div className="border-t border-dashed border-border my-0.5" />
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL</span>
          <span>{fc(total)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-border" />

      {/* Footer */}
      <p className="text-center text-[10px] text-muted-foreground py-2">
        {prefs.receiptFooter || 'Thank you for your purchase!'}
      </p>
    </div>
  );
}

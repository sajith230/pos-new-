import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Banknote, CreditCard, Wallet, Plus, Trash2, Loader2 } from 'lucide-react';
import { PaymentMethod } from '@/types/database';

export interface PaymentSplit {
  method: PaymentMethod;
  amount: number;
}

interface SplitPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  formatCurrency: (amount: number) => string;
  onComplete: (splits: PaymentSplit[]) => void;
  isProcessing?: boolean;
}

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'upi', label: 'UPI', icon: Wallet },
  { value: 'wallet', label: 'Wallet', icon: Wallet },
];

export default function SplitPaymentDialog({
  open, onOpenChange, total, formatCurrency, onComplete, isProcessing,
}: SplitPaymentDialogProps) {
  const [splits, setSplits] = useState<{ method: PaymentMethod; amount: string }[]>([]);

  const splitTotal = splits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const remaining = Math.max(0, total - splitTotal);
  const isBalanced = Math.abs(remaining) < 0.01;

  function handleQuickPay(method: PaymentMethod) {
    onComplete([{ method, amount: total }]);
    setSplits([]);
  }

  function addSplit() {
    setSplits(prev => [...prev, { method: 'cash', amount: remaining > 0 ? remaining.toFixed(2) : '' }]);
  }

  function updateSplit(index: number, field: 'method' | 'amount', value: string) {
    setSplits(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  function removeSplit(index: number) {
    setSplits(prev => prev.filter((_, i) => i !== index));
  }

  function handleSplitComplete() {
    const validSplits = splits
      .map(s => ({ method: s.method, amount: parseFloat(s.amount) || 0 }))
      .filter(s => s.amount > 0);
    if (validSplits.length > 0 && Math.abs(validSplits.reduce((s, r) => s + r.amount, 0) - total) < 0.01) {
      onComplete(validSplits);
      setSplits([]);
    }
  }

  function handleOpenChange(v: boolean) {
    if (!v) setSplits([]);
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment</DialogTitle>
        </DialogHeader>

        <div className="text-center py-2">
          <p className="text-3xl font-bold text-primary">{formatCurrency(total)}</p>
          <p className="text-sm text-muted-foreground">Total Amount</p>
        </div>

        {splits.length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground text-center">Quick pay with single method</p>
            <div className="grid grid-cols-2 gap-3">
              {METHODS.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => handleQuickPay(value)}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
                  {label}
                </Button>
              ))}
            </div>
            <Separator />
            <Button variant="secondary" className="w-full" onClick={addSplit}>
              <Plus className="h-4 w-4 mr-2" />
              Split Payment
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-3">
              {splits.map((split, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={split.method} onValueChange={(v) => updateSplit(i, 'method', v)}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={split.amount}
                    onChange={(e) => updateSplit(i, 'amount', e.target.value)}
                    min="0"
                    step="0.01"
                    className="flex-1"
                  />
                  <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => removeSplit(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addSplit} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Add Method
            </Button>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Remaining</span>
              <Badge variant={isBalanced ? 'default' : 'destructive'}>
                {formatCurrency(remaining)}
              </Badge>
            </div>
          </>
        )}

        {splits.length > 0 && (
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setSplits([])}>Back</Button>
            <Button onClick={handleSplitComplete} disabled={!isBalanced || isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Complete Payment
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

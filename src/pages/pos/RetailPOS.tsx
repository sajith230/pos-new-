import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Plus, Minus, Trash2, User, Percent, CreditCard, Banknote, Wallet,
  Clock, PauseCircle, PlayCircle, X, Printer, CheckCircle, Tag, Plug
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PermissionButton } from '@/components/auth/PermissionButton';
import { usePermissions } from '@/hooks/usePermissions';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCartStore } from '@/stores/cartStore';
import { Product, Category, PaymentMethod, Customer, Shift, CartItem } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/lib/formatCurrency';
import { format } from 'date-fns';
import ThermalReceipt from '@/components/receipt/ThermalReceipt';
import SplitPaymentDialog, { PaymentSplit } from '@/components/pos/SplitPaymentDialog';
import {
  printReceipt,
  getPrinterPreferences,
  isSerialConnected,
  connectSerialPrinter,
  type ReceiptPrintData,
} from '@/lib/receiptPrinter';

interface HeldOrder {
  id: string;
  items: CartItem[];
  customer: Customer | null;
  discountAmount: number;
  discountPercent: number;
  notes: string;
  heldAt: string;
}

interface ReceiptData {
  transactionNumber: string;
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  discountPercent: number;
  total: number;
  paymentMethod: PaymentMethod;
  customer: Customer | null;
  createdAt: string;
}

export default function RetailPOS() {
  const { canEdit, canDelete } = usePermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Shift management
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isShiftLoading, setIsShiftLoading] = useState(true);
  const [isOpenShiftOpen, setIsOpenShiftOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [shiftSalesSummary, setShiftSalesSummary] = useState({ totalSales: 0, totalTransactions: 0 });

  // Customer selection
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);

  // Discount
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState('');

  // Receipt
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Hold & Recall
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [isRecallOpen, setIsRecallOpen] = useState(false);

  // Barcode scanner
  const searchRef = useRef<HTMLInputElement>(null);
  const lastInputTime = useRef<number>(0);
  const inputBuffer = useRef<string>('');

  const { business, branch, user } = useAuth();
  const { toast } = useToast();
  const { format: fc } = useCurrency();

  const {
    items, customer, discountAmount, discountPercent, notes,
    addItem, removeItem, updateQuantity, clearCart,
    setCustomer, setDiscount, setNotes,
    getSubtotal, getTaxAmount, getTotal, getItemCount,
  } = useCartStore();

  // Load shift on mount
  useEffect(() => {
    if (user?.id && branch?.id) {
      checkActiveShift();
    }
  }, [user?.id, branch?.id]);

  useEffect(() => {
    if (business?.id) {
      fetchProducts();
      fetchCategories();
    }
  }, [business?.id]);

  // Auto-focus search input
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Barcode scanner detection: rapid input → auto-add product
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();
    if (e.key === 'Enter' && searchQuery.trim()) {
      const match = products.find(
        (p) => p.barcode?.toLowerCase() === searchQuery.trim().toLowerCase() ||
               p.sku?.toLowerCase() === searchQuery.trim().toLowerCase()
      );
      if (match) {
        addItem(match);
        setSearchQuery('');
        toast({ title: `Added ${match.name}` });
      }
    }
  }, [searchQuery, products, addItem, toast]);

  async function checkActiveShift() {
    setIsShiftLoading(true);
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', user!.id)
      .eq('branch_id', branch!.id)
      .eq('status', 'open')
      .maybeSingle();

    if (!error && data) {
      setActiveShift(data as Shift);
    } else {
      setActiveShift(null);
    }
    setIsShiftLoading(false);
  }

  async function handleOpenShift() {
    const amount = parseFloat(openingCash);
    if (isNaN(amount) || amount < 0) {
      toast({ variant: 'destructive', title: 'Invalid amount' });
      return;
    }

    const { data, error } = await supabase
      .from('shifts')
      .insert({
        user_id: user!.id,
        branch_id: branch!.id,
        opening_cash: amount,
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to open shift', description: error.message });
    } else {
      setActiveShift(data as Shift);
      setIsOpenShiftOpen(false);
      setOpeningCash('');
      toast({ title: 'Shift Opened', description: `Opening cash: ${fc(amount)}` });
    }
  }

  async function prepareCloseShift() {
    // Fetch shift sales summary
    const { data: txns } = await supabase
      .from('transactions')
      .select('total_amount')
      .eq('shift_id', activeShift!.id)
      .eq('status', 'completed');

    const totalSales = txns?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0;
    const totalTransactions = txns?.length || 0;

    setShiftSalesSummary({ totalSales, totalTransactions });
    setIsCloseShiftOpen(true);
  }

  async function handleCloseShift() {
    const closing = parseFloat(closingCash);
    if (isNaN(closing) || closing < 0) {
      toast({ variant: 'destructive', title: 'Enter closing cash amount' });
      return;
    }

    const expectedCash = (activeShift?.opening_cash || 0) + shiftSalesSummary.totalSales;
    const difference = closing - expectedCash;

    const { error } = await supabase
      .from('shifts')
      .update({
        closing_cash: closing,
        expected_cash: expectedCash,
        cash_difference: difference,
        total_sales: shiftSalesSummary.totalSales,
        total_transactions: shiftSalesSummary.totalTransactions,
        ended_at: new Date().toISOString(),
        status: 'closed',
        notes: shiftNotes || null,
      })
      .eq('id', activeShift!.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to close shift', description: error.message });
    } else {
      setActiveShift(null);
      setIsCloseShiftOpen(false);
      setClosingCash('');
      setShiftNotes('');
      clearCart();
      toast({ title: 'Shift Closed', description: `Total sales: ${fc(shiftSalesSummary.totalSales)}` });
    }
  }

  async function fetchProducts() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('business_id', business!.id)
      .eq('is_active', true)
      .order('name');

    if (!error) setProducts(data as Product[]);
    setIsLoading(false);
  }

  async function fetchCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('business_id', business!.id)
      .eq('is_active', true)
      .order('sort_order');

    if (!error) setCategories(data as Category[]);
  }

  // Customer search
  async function searchCustomers(query: string) {
    setCustomerSearch(query);
    if (query.length < 2) { setCustomerResults([]); return; }
    setCustomerLoading(true);

    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', business!.id)
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(10);

    setCustomerResults((data as Customer[]) || []);
    setCustomerLoading(false);
  }

  function selectCustomer(c: Customer) {
    setCustomer(c);
    setIsCustomerOpen(false);
    setCustomerSearch('');
    setCustomerResults([]);
  }

  // Discount
  function applyDiscount() {
    const val = parseFloat(discountValue);
    if (isNaN(val) || val < 0) return;
    if (discountType === 'percent') {
      setDiscount(0, Math.min(val, 100));
    } else {
      setDiscount(Math.min(val, getSubtotal() + getTaxAmount()), 0);
    }
    setIsDiscountOpen(false);
    setDiscountValue('');
  }

  // Hold order
  function holdCurrentOrder() {
    if (items.length === 0) return;
    const held: HeldOrder = {
      id: `HOLD-${Date.now()}`,
      items: [...items],
      customer,
      discountAmount,
      discountPercent,
      notes,
      heldAt: new Date().toISOString(),
    };
    setHeldOrders((prev) => [...prev, held]);
    clearCart();
    toast({ title: 'Order Held', description: `${held.items.length} items saved` });
  }

  function recallOrder(held: HeldOrder) {
    // Save current cart if not empty
    if (items.length > 0) holdCurrentOrder();
    // Restore held order
    clearCart();
    held.items.forEach((item) => addItem(item.product, item.quantity));
    if (held.customer) setCustomer(held.customer);
    setDiscount(held.discountAmount, held.discountPercent);
    setNotes(held.notes);
    setHeldOrders((prev) => prev.filter((h) => h.id !== held.id));
    setIsRecallOpen(false);
    toast({ title: 'Order Recalled' });
  }

  function deleteHeldOrder(id: string) {
    setHeldOrders((prev) => prev.filter((h) => h.id !== id));
  }

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  async function handlePayment(splits: PaymentSplit[]) {
    if (items.length === 0 || !activeShift) return;

    try {
      const transactionNumber = `TXN-${Date.now()}`;
      const subtotal = getSubtotal();
      const taxAmount = getTaxAmount();
      const total = getTotal();
      const paymentMethodLabel = splits.length === 1 ? splits[0].method : ('split' as PaymentMethod);

      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          business_id: business!.id,
          branch_id: branch!.id,
          shift_id: activeShift.id,
          customer_id: customer?.id || null,
          transaction_number: transactionNumber,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          discount_percent: discountPercent,
          total_amount: total,
          created_by: user?.id,
          notes: notes || null,
        })
        .select()
        .single();

      if (txError) throw txError;

      const transactionItems = items.map((item) => ({
        transaction_id: transaction.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        tax_amount: item.product.price * item.quantity * ((item.product.tax_rate || 0) / 100),
        total_price: item.product.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(transactionItems);
      if (itemsError) throw itemsError;

      // Insert multiple payment rows (one per split)
      const paymentRows = splits.map(s => ({
        transaction_id: transaction.id,
        payment_method: s.method === 'split' ? 'cash' as const : s.method,
        amount: s.amount,
      }));
      const { error: paymentError } = await supabase
        .from('payments')
        .insert(paymentRows);
      if (paymentError) throw paymentError;

      // Deduct stock for each item
      for (const item of items) {
        await supabase.rpc('deduct_stock_for_sale', {
          _branch_id: branch!.id,
          _product_id: item.product.id,
          _quantity: item.quantity,
          _reference_id: transaction.id,
        });
      }

      // Update customer stats if linked
      if (customer) {
        await supabase
          .from('customers')
          .update({
            visit_count: (customer.visit_count || 0) + 1,
            total_spent: (customer.total_spent || 0) + total,
          })
          .eq('id', customer.id);
      }

      // Show receipt
      setReceiptData({
        transactionNumber,
        items: [...items],
        subtotal,
        taxAmount,
        discountAmount,
        discountPercent,
        total,
        paymentMethod: paymentMethodLabel,
        customer,
        createdAt: new Date().toISOString(),
      });

      clearCart();
      setIsPaymentOpen(false);
      setIsReceiptOpen(true);

      // Auto-print if enabled
      const prefs = getPrinterPreferences();
      if (prefs.autoPrint) {
        const rd: ReceiptData = {
          transactionNumber,
          items: [...items],
          subtotal, taxAmount, discountAmount, discountPercent, total,
          paymentMethod: paymentMethodLabel, customer, createdAt: new Date().toISOString(),
        };
        setTimeout(() => {
          const printData = buildPrintData(rd);
          printReceipt(printData, 'thermal-receipt');
        }, 500);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        variant: 'destructive',
        title: 'Payment Failed',
        description: error.message || 'An error occurred while processing the payment.',
      });
    }
  }

  function buildPrintData(receipt: ReceiptData): ReceiptPrintData {
    const prefs = getPrinterPreferences();
    return {
      businessName: business?.name || '',
      businessAddress: business?.address || undefined,
      businessPhone: business?.phone || undefined,
      businessTaxId: business?.tax_id || undefined,
      transactionNumber: receipt.transactionNumber,
      items: receipt.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.price,
        total: item.product.price * item.quantity,
      })),
      subtotal: receipt.subtotal,
      taxAmount: receipt.taxAmount,
      discountAmount: receipt.discountAmount,
      discountPercent: receipt.discountPercent,
      total: receipt.total,
      paymentMethod: receipt.paymentMethod,
      customerName: receipt.customer?.name,
      date: receipt.createdAt,
      receiptHeader: prefs.receiptHeader,
      receiptFooter: prefs.receiptFooter,
    };
  }

  async function handlePrintReceipt() {
    if (!receiptData) return;
    const printData = buildPrintData(receiptData);
    await printReceipt(printData, 'thermal-receipt');
  }

  async function handleConnectPrinter() {
    const success = await connectSerialPrinter();
    toast({
      title: success ? 'Printer Connected' : 'Connection Failed',
      variant: success ? 'default' : 'destructive',
    });
  }

  function handleReceiptDone() {
    setReceiptData(null);
    setIsReceiptOpen(false);
  }

  if (!business) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Business Setup Required</h2>
            <p className="text-muted-foreground">
              Please set up your business profile before using the POS system.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isShiftLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading shift...</p>
        </div>
      </div>
    );
  }

  // No active shift → prompt to open
  if (!activeShift) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Clock className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle>Open a Shift to Start Selling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Opening Cash Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleOpenShift}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Open Shift
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Shift Header Bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Shift started {format(new Date(activeShift.started_at), 'h:mm a')}</span>
        </div>
        <div className="flex items-center gap-2">
          {heldOrders.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setIsRecallOpen(true)}>
              <PlayCircle className="h-4 w-4 mr-1" />
              Recall ({heldOrders.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={prepareCloseShift}>
            <PauseCircle className="h-4 w-4 mr-1" />
            Close Shift
          </Button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Products Section */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Search & Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Search or scan barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-9"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Badge
              variant={selectedCategory === null ? 'default' : 'outline'}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Badge>
            {categories.map((cat) => (
              <Badge
                key={cat.id}
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </Badge>
            ))}
          </div>

          {/* Products Grid */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => addItem(product)}
                  >
                    <CardContent className="p-3">
                      <div className="aspect-square rounded-md bg-muted mb-2 flex items-center justify-center">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-md" />
                        ) : (
                          <span className="text-2xl">📦</span>
                        )}
                      </div>
                      <h3 className="font-medium text-sm truncate">{product.name}</h3>
                      <p className="text-primary font-semibold">{fc(product.price)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Cart Section */}
        <Card className="w-80 lg:w-96 flex flex-col">
          <CardHeader className="pb-2 space-y-2">
            <CardTitle className="flex items-center justify-between">
              <span>Current Sale</span>
              <Badge variant="secondary">{getItemCount()} items</Badge>
            </CardTitle>
            {/* Customer display / select */}
            <div className="flex items-center gap-2">
              {customer ? (
                <div className="flex items-center gap-2 flex-1 text-sm bg-muted rounded-md px-2 py-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{customer.name}</span>
                  {customer.phone && <span className="text-muted-foreground text-xs">({customer.phone})</span>}
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => setCustomer(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setIsCustomerOpen(true)}>
                  <User className="h-3 w-3 mr-1" /> Add Customer
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full px-4">
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Cart is empty</p>
                  <p className="text-sm">Click products to add them</p>
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {fc(item.product.price)} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeItem(item.product.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>

          <CardFooter className="flex-col gap-3 border-t pt-4">
            {/* Totals */}
            <div className="w-full space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{fc(getSubtotal())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{fc(getTaxAmount())}</span>
              </div>
              {(discountAmount > 0 || discountPercent > 0) && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Discount {discountPercent > 0 ? `(${discountPercent}%)` : ''}
                  </span>
                    <span>
                    -{fc(discountPercent > 0
                      ? ((getSubtotal() + getTaxAmount()) * discountPercent / 100)
                      : discountAmount)}
                    </span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span className="text-primary">{fc(getTotal())}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full grid grid-cols-3 gap-2">
              <PermissionButton permitted={canEdit('pos.retail')} tooltip="You don't have permission to apply discounts" variant="outline" size="sm" onClick={() => setIsDiscountOpen(true)} disabled={items.length === 0}>
                <Percent className="h-3 w-3 mr-1" /> Disc
              </PermissionButton>
              <Button variant="outline" size="sm" onClick={holdCurrentOrder} disabled={items.length === 0}>
                <PauseCircle className="h-3 w-3 mr-1" /> Hold
              </Button>
              <PermissionButton permitted={canDelete('pos.retail')} tooltip="You don't have permission to void sales" variant="outline" size="sm" onClick={clearCart} disabled={items.length === 0}>
                <Trash2 className="h-3 w-3 mr-1" /> Clear
              </PermissionButton>
            </div>
            <Button className="w-full" onClick={() => setIsPaymentOpen(true)} disabled={items.length === 0}>
              Pay {fc(getTotal())}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ===== DIALOGS ===== */}

      {/* Payment Dialog */}
      <SplitPaymentDialog
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        total={getTotal()}
        formatCurrency={fc}
        onComplete={handlePayment}
      />

      {/* Customer Search Dialog */}
      <Dialog open={isCustomerOpen} onOpenChange={setIsCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Customer</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search by name or phone..."
            value={customerSearch}
            onChange={(e) => searchCustomers(e.target.value)}
            autoFocus
          />
          <ScrollArea className="max-h-64">
            {customerLoading ? (
              <p className="text-center py-4 text-muted-foreground text-sm">Searching...</p>
            ) : customerResults.length === 0 && customerSearch.length >= 2 ? (
              <p className="text-center py-4 text-muted-foreground text-sm">No customers found</p>
            ) : (
              <div className="space-y-1">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
                    onClick={() => selectCustomer(c)}
                  >
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone || c.email || 'No contact info'}</p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={isDiscountOpen} onOpenChange={setIsDiscountOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apply Discount</DialogTitle>
          </DialogHeader>
          <Tabs value={discountType} onValueChange={(v) => setDiscountType(v as 'percent' | 'amount')}>
            <TabsList className="w-full">
              <TabsTrigger value="percent" className="flex-1">Percentage (%)</TabsTrigger>
              <TabsTrigger value="amount" className="flex-1">Flat Amount</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            type="number"
            placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            min="0"
            autoFocus
          />
          <DialogFooter className="flex gap-2">
            {(discountAmount > 0 || discountPercent > 0) && (
              <Button variant="outline" onClick={() => { setDiscount(0, 0); setIsDiscountOpen(false); }}>
                Remove Discount
              </Button>
            )}
            <Button onClick={applyDiscount}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" /> Sale Complete
            </DialogTitle>
          </DialogHeader>
          {receiptData && (
            <ThermalReceipt
              businessName={business.name}
              businessAddress={business.address || undefined}
              businessPhone={business.phone || undefined}
              businessTaxId={business.tax_id || undefined}
              transactionNumber={receiptData.transactionNumber}
              items={receiptData.items.map((item) => ({
                name: item.product.name,
                quantity: item.quantity,
                unitPrice: item.product.price,
                total: item.product.price * item.quantity,
              }))}
              subtotal={receiptData.subtotal}
              taxAmount={receiptData.taxAmount}
              discountAmount={receiptData.discountAmount}
              discountPercent={receiptData.discountPercent}
              total={receiptData.total}
              paymentMethod={receiptData.paymentMethod}
              customerName={receiptData.customer?.name}
              date={receiptData.createdAt}
              currency={business.currency || 'INR'}
            />
          )}
          <DialogFooter className="flex gap-2">
            {!isSerialConnected() && (
              <Button variant="ghost" size="sm" onClick={handleConnectPrinter} className="mr-auto">
                <Plug className="h-4 w-4 mr-1" /> Connect Printer
              </Button>
            )}
            <Button variant="outline" onClick={handlePrintReceipt}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            <Button onClick={handleReceiptDone}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recall Held Orders Dialog */}
      <Dialog open={isRecallOpen} onOpenChange={setIsRecallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Held Orders ({heldOrders.length})</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            {heldOrders.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">No held orders</p>
            ) : (
              <div className="space-y-2">
                {heldOrders.map((held) => (
                  <div key={held.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{held.items.length} items</p>
                      <p className="text-xs text-muted-foreground">
                        {held.customer ? held.customer.name + ' · ' : ''}
                        {format(new Date(held.heldAt), 'h:mm a')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-48">
                        {held.items.map((i) => i.product.name).join(', ')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => recallOrder(held)}>Recall</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteHeldOrder(held.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <AlertDialog open={isCloseShiftOpen} onOpenChange={setIsCloseShiftOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Review shift summary and enter closing cash amount.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-muted-foreground">Total Sales</p>
                <p className="text-xl font-bold text-primary">{fc(shiftSalesSummary.totalSales)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-muted-foreground">Transactions</p>
                <p className="text-xl font-bold">{shiftSalesSummary.totalTransactions}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center col-span-2">
                <p className="text-muted-foreground">Opening Cash</p>
                <p className="text-xl font-bold">{fc(activeShift?.opening_cash || 0)}</p>
              </div>
            </div>
            <div>
              <Label>Closing Cash Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Shift notes..."
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseShift}>Close Shift</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

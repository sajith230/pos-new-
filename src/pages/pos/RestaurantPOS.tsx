import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PermissionButton } from '@/components/auth/PermissionButton';
import { usePermissions } from '@/hooks/usePermissions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table as TableType, TableStatus, Order, OrderItem, Product, Category, PaymentMethod } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/lib/formatCurrency';
import {
  Users, UtensilsCrossed, Truck, ShoppingBag, Search, Plus, Minus, Trash2,
  ChefHat, Receipt, X, Banknote, CreditCard, Wallet, Loader2, ArrowLeft
} from 'lucide-react';
import TableFloorPlan from '@/components/pos/TableFloorPlan';
import SplitPaymentDialog, { PaymentSplit } from '@/components/pos/SplitPaymentDialog';
import ActiveOrdersList from '@/components/pos/ActiveOrdersList';


export default function RestaurantPOS() {
  const { canDelete } = usePermissions();
  const [tables, setTables] = useState<TableType[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableType | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [deliveryCustomer, setDeliveryCustomer] = useState({ name: '', phone: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isSendingKOT, setIsSendingKOT] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const { business, branch, user } = useAuth();
  const { toast } = useToast();
  const { format: fc } = useCurrency();

  useEffect(() => {
    if (business?.id && branch?.id) {
      fetchTables();
      fetchProducts();
      fetchCategories();

      const channel = supabase
        .channel('tables-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `branch_id=eq.${branch.id}` }, () => {
          fetchTables();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [business?.id, branch?.id]);

  async function fetchTables() {
    const { data } = await supabase
      .from('tables')
      .select('*')
      .eq('branch_id', branch!.id)
      .eq('is_active', true)
      .order('name');
    setTables((data as TableType[]) || []);
  }

  async function fetchProducts() {
    setIsLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('business_id', business!.id)
      .eq('is_active', true)
      .order('name');
    setProducts((data as Product[]) || []);
    setIsLoading(false);
  }

  async function fetchCategories() {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('business_id', business!.id)
      .eq('is_active', true)
      .order('sort_order');
    setCategories((data as Category[]) || []);
  }

  async function fetchOrderForTable(tableId: string) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('table_id', tableId)
      .in('status', ['pending', 'preparing', 'ready', 'served'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setActiveOrder(data as Order);
      await fetchOrderItems(data.id);
    } else {
      setActiveOrder(null);
      setOrderItems([]);
    }
  }

  async function fetchOrderItems(orderId: string) {
    const { data } = await supabase
      .from('order_items')
      .select('*, product:products(*)')
      .eq('order_id', orderId)
      .order('created_at');
    setOrderItems((data as OrderItem[]) || []);
  }

  async function handleTableSelect(table: TableType) {
    setSelectedTable(table);
    const status = (table.status as TableStatus) || 'available';

    if (status === 'occupied') {
      await fetchOrderForTable(table.id);
    } else if (status === 'available') {
      const orderNumber = `ORD-${Date.now()}`;
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          business_id: business!.id,
          branch_id: branch!.id,
          table_id: table.id,
          order_number: orderNumber,
          order_type: 'dine_in' as const,
          status: 'pending' as const,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }

      await supabase.from('tables').update({ status: 'occupied' }).eq('id', table.id);
      setActiveOrder(order as Order);
      setOrderItems([]);
      setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'occupied' as TableStatus } : t));
    }
  }

  async function createNonDineInOrder(type: 'takeaway' | 'delivery') {
    const orderNumber = `ORD-${Date.now()}`;
    const notes = type === 'delivery' && deliveryCustomer.name
      ? `Delivery — ${deliveryCustomer.name} ${deliveryCustomer.phone}`
      : undefined;

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        business_id: business!.id,
        branch_id: branch!.id,
        order_number: orderNumber,
        order_type: type,
        status: 'pending' as const,
        created_by: user?.id,
        notes,
      })
      .select()
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }

    setActiveOrder(order as Order);
    setOrderItems([]);
  }

  function handleOrderTypeChange(type: 'dine_in' | 'takeaway' | 'delivery') {
    if (activeOrder) return;
    setOrderType(type);
    setSelectedTable(null);
    setActiveOrder(null);
    setOrderItems([]);
    setDeliveryCustomer({ name: '', phone: '' });
  }

  async function addItemToOrder(product: Product) {
    if (!activeOrder) return;

    const existing = orderItems.find(i => i.product_id === product.id && i.status === 'pending');
    if (existing) {
      const { error } = await supabase
        .from('order_items')
        .update({ quantity: existing.quantity + 1 })
        .eq('id', existing.id);
      if (!error) {
        setOrderItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
    } else {
      const { data, error } = await supabase
        .from('order_items')
        .insert({
          order_id: activeOrder.id,
          product_id: product.id,
          quantity: 1,
          unit_price: product.price,
          status: 'pending' as const,
        })
        .select('*, product:products(*)')
        .single();
      if (!error && data) {
        setOrderItems(prev => [...prev, data as OrderItem]);
      }
    }
  }

  async function updateItemQuantity(itemId: string, newQty: number) {
    if (newQty <= 0) {
      await supabase.from('order_items').delete().eq('id', itemId);
      setOrderItems(prev => prev.filter(i => i.id !== itemId));
    } else {
      await supabase.from('order_items').update({ quantity: newQty }).eq('id', itemId);
      setOrderItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: newQty } : i));
    }
  }

  async function removeItem(itemId: string) {
    await supabase.from('order_items').delete().eq('id', itemId);
    setOrderItems(prev => prev.filter(i => i.id !== itemId));
  }

  async function sendToKitchen() {
    if (!activeOrder) return;
    const pendingItems = orderItems.filter(i => i.status === 'pending');
    if (pendingItems.length === 0) {
      toast({ title: 'No new items', description: 'All items have already been sent to kitchen.' });
      return;
    }

    setIsSendingKOT(true);
    try {
      const now = new Date().toISOString();
      const pendingIds = pendingItems.map(i => i.id);

      await supabase
        .from('order_items')
        .update({ status: 'preparing' as const, sent_to_kitchen_at: now })
        .in('id', pendingIds);

      const kotNumber = `KOT-${Date.now()}`;
      const kotItems = pendingItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product?.name || 'Unknown',
        quantity: i.quantity,
        notes: i.notes || '',
        prep_time: i.product?.prep_time || null,
        image_url: i.product?.image_url || null,
      }));

      await supabase.from('kot_tickets').insert({
        order_id: activeOrder.id,
        ticket_number: kotNumber,
        items: kotItems,
      });

      await supabase.from('orders').update({ status: 'pending' as const }).eq('id', activeOrder.id);

      setOrderItems(prev =>
        prev.map(i => pendingIds.includes(i.id) ? { ...i, status: 'preparing' as const, sent_to_kitchen_at: now } : i)
      );
      setActiveOrder(prev => prev ? { ...prev, status: 'pending' } : prev);

      toast({ title: 'Sent to Kitchen!', description: `${pendingItems.length} item(s) sent. KOT: ${kotNumber}` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSendingKOT(false);
    }
  }

  async function handlePayment(splits: PaymentSplit[]) {
    if (!activeOrder || orderItems.length === 0) return;
    setIsProcessingPayment(true);

    try {
      const subtotal = orderItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
      const taxRate = business?.tax_rate || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount;
      const txnNumber = `TXN-${Date.now()}`;

      const { data: txn, error: txnError } = await supabase
        .from('transactions')
        .insert({
          business_id: business!.id,
          branch_id: branch!.id,
          transaction_number: txnNumber,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          created_by: user?.id,
        })
        .select()
        .single();
      if (txnError) throw txnError;

      const txnItems = orderItems.map(i => ({
        transaction_id: txn.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        tax_amount: i.unit_price * i.quantity * (taxRate / 100),
        total_price: i.unit_price * i.quantity,
      }));
      const { error: tiError } = await supabase.from('transaction_items').insert(txnItems);
      if (tiError) throw tiError;

      // Insert multiple payment rows (one per split)
      const paymentRows = splits.map(s => ({
        transaction_id: txn.id,
        payment_method: s.method === 'split' ? 'cash' as const : s.method,
        amount: s.amount,
      }));
      const { error: payError } = await supabase.from('payments').insert(paymentRows);
      if (payError) throw payError;

      for (const item of orderItems) {
        await supabase.rpc('deduct_stock_for_sale', {
          _branch_id: branch!.id,
          _product_id: item.product_id,
          _quantity: item.quantity,
          _reference_id: txn.id,
        });
      }

      await supabase.from('orders').update({
        status: 'completed' as const,
        transaction_id: txn.id,
      }).eq('id', activeOrder.id);

      if (selectedTable) {
        await supabase.from('tables').update({ status: 'available' }).eq('id', selectedTable.id);
        setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'available' as TableStatus } : t));
      }

      toast({ title: 'Payment Complete!', description: `${txnNumber} — ${fc(totalAmount)}` });
      setActiveOrder(null);
      setOrderItems([]);
      setSelectedTable(null);
      setIsPaymentOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Payment Failed', description: error.message });
    } finally {
      setIsProcessingPayment(false);
    }
  }

  async function cancelOrder() {
    if (!activeOrder) return;
    await supabase.from('orders').update({ status: 'cancelled' as const }).eq('id', activeOrder.id);
    if (selectedTable) {
      await supabase.from('tables').update({ status: 'available' }).eq('id', selectedTable.id);
      setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'available' as TableStatus } : t));
    }
    setActiveOrder(null);
    setOrderItems([]);
    setSelectedTable(null);
    toast({ title: 'Order Cancelled' });
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const subtotal = orderItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const taxRate = business?.tax_rate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const pendingCount = orderItems.filter(i => i.status === 'pending').length;

  if (!business) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Business Setup Required</h2>
            <p className="text-muted-foreground">Please set up your business profile and branch before using the restaurant POS.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function handleBackToTables() {
    setSelectedTable(null);
    setActiveOrder(null);
    setOrderItems([]);
    setDeliveryCustomer({ name: '', phone: '' });
  }

  const showMenuView = orderType !== 'dine_in' ? !!activeOrder : !!selectedTable;
  const showFloorPlan = orderType === 'dine_in' && !selectedTable;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Order Type Tabs */}
      <div className="flex gap-1 mb-3 bg-muted p-1 rounded-lg w-fit">
        {([
          { type: 'dine_in' as const, icon: UtensilsCrossed, label: 'Dine-in' },
          { type: 'takeaway' as const, icon: ShoppingBag, label: 'Takeaway' },
          { type: 'delivery' as const, icon: Truck, label: 'Delivery' },
        ]).map(({ type, icon: Icon, label }) => (
          <Button
            key={type}
            variant={orderType === type ? 'default' : 'ghost'}
            size="sm"
            className="gap-1.5"
            onClick={() => handleOrderTypeChange(type)}
            disabled={!!activeOrder}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {showFloorPlan ? (
          <TableFloorPlan
            tables={tables}
            branchId={branch!.id}
            businessId={business!.id}
            onTableSelect={handleTableSelect}
            onTablesChange={fetchTables}
          />
        ) : orderType !== 'dine_in' && !activeOrder ? (
          <div className="flex-1 flex gap-4">
            {/* Active Orders List */}
            <div className="flex-1 flex flex-col">
              <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">
                Active {orderType === 'takeaway' ? 'Takeaway' : 'Delivery'} Orders
              </h3>
              <div className="flex-1 min-h-0">
                <ActiveOrdersList
                  businessId={business!.id}
                  branchId={branch!.id}
                  orderType={orderType as 'takeaway' | 'delivery'}
                  onResumeOrder={async (orderId) => {
                    const { data: order } = await supabase
                      .from('orders')
                      .select('*')
                      .eq('id', orderId)
                      .single();
                    if (order) {
                      setActiveOrder(order as Order);
                      const { data: items } = await supabase
                        .from('order_items')
                        .select('*, product:products(*)')
                        .eq('order_id', orderId)
                        .order('created_at');
                      setOrderItems((items as OrderItem[]) || []);
                      if (order.notes?.startsWith('Delivery')) {
                        const match = order.notes.match(/Delivery — (.+?) (.+)/);
                        if (match) setDeliveryCustomer({ name: match[1], phone: match[2] });
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* New Order Card */}
            <Card className="w-72 shrink-0 self-start">
              <CardContent className="pt-6 space-y-4">
                <div className="text-center">
                  {orderType === 'takeaway' ? (
                    <ShoppingBag className="h-10 w-10 mx-auto text-primary mb-2" />
                  ) : (
                    <Truck className="h-10 w-10 mx-auto text-primary mb-2" />
                  )}
                  <h2 className="text-base font-semibold">New Order</h2>
                </div>
                {orderType === 'delivery' && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Customer name"
                      value={deliveryCustomer.name}
                      onChange={e => setDeliveryCustomer(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <Input
                      placeholder="Phone number"
                      value={deliveryCustomer.phone}
                      onChange={e => setDeliveryCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                )}
                <Button className="w-full" onClick={() => createNonDineInOrder(orderType as 'takeaway' | 'delivery')}>
                  <Plus className="h-4 w-4 mr-1" />
                  Start Order
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {/* CENTER: Menu */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleBackToTables}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {orderType === 'dine_in' ? 'Tables' : 'Back'}
                </Button>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search menu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Badge variant={selectedCategory === null ? 'default' : 'outline'} className="cursor-pointer whitespace-nowrap" onClick={() => setSelectedCategory(null)}>All</Badge>
                {categories.map(c => (
                  <Badge key={c.id} variant={selectedCategory === c.id ? 'default' : 'outline'} className="cursor-pointer whitespace-nowrap" onClick={() => setSelectedCategory(c.id)}>{c.name}</Badge>
                ))}
              </div>
              <ScrollArea className="flex-1">
                {isLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[...Array(8)].map((_, i) => <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredProducts.map(product => (
                      <Card key={product.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => addItemToOrder(product)}>
                        <CardContent className="p-3">
                          <div className="aspect-square rounded-md bg-muted mb-2 flex items-center justify-center">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-md" />
                            ) : (
                              <span className="text-2xl">🍽️</span>
                            )}
                          </div>
                          <h3 className="font-medium text-sm truncate">{product.name}</h3>
                          <p className="text-primary font-semibold text-sm">{fc(product.price)}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
            <Card className="w-80 flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    {orderType === 'dine_in' && selectedTable?.name}
                    {orderType !== 'dine_in' && (
                      <Badge variant="secondary" className="text-xs">
                        {orderType === 'takeaway' ? 'Takeaway' : 'Delivery'}
                      </Badge>
                    )}
                    <span className="text-muted-foreground">#{activeOrder?.order_number.slice(-6)}</span>
                  </span>
                  <Badge variant="outline" className="text-xs">{activeOrder?.status}</Badge>
                </CardTitle>
                {orderType === 'delivery' && deliveryCustomer.name && (
                  <p className="text-xs text-muted-foreground">
                    {deliveryCustomer.name} · {deliveryCustomer.phone}
                  </p>
                )}
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full px-4">
                  {orderItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No items yet</p>
                      <p className="text-xs">Click menu items to add</p>
                    </div>
                  ) : (
                    <div className="space-y-2 py-2">
                      {orderItems.map(item => (
                        <div key={item.id} className="flex gap-2 items-center">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.product?.name || 'Item'}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground">{fc(item.unit_price)} × {item.quantity}</p>
                              {item.status !== 'pending' && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">{item.status}</Badge>
                              )}
                            </div>
                          </div>
                          {item.status === 'pending' && (
                            <div className="flex items-center gap-0.5">
                              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItemQuantity(item.id, item.quantity - 1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-xs">{item.quantity}</span>
                              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItemQuantity(item.id, item.quantity + 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(item.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>

              <CardFooter className="flex-col gap-2 border-t pt-3">
                <div className="w-full space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fc(subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax ({taxRate}%)</span><span>{fc(taxAmount)}</span></div>
                  <Separator className="my-1" />
                  <div className="flex justify-between font-semibold text-lg"><span>Total</span><span className="text-primary">{fc(total)}</span></div>
                </div>

                <div className="w-full grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={sendToKitchen} disabled={pendingCount === 0 || isSendingKOT}>
                    {isSendingKOT ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ChefHat className="h-4 w-4 mr-1" />}
                    KOT ({pendingCount})
                  </Button>
                  <Button size="sm" onClick={() => setIsPaymentOpen(true)} disabled={orderItems.length === 0}>
                    <Receipt className="h-4 w-4 mr-1" />
                    Bill
                  </Button>
                  <PermissionButton permitted={canDelete('pos.restaurant')} tooltip="You don't have permission to cancel orders" variant="destructive" size="sm" className="col-span-2" onClick={cancelOrder}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel Order
                  </PermissionButton>
                </div>
              </CardFooter>
            </Card>
          </>
        )}
      </div>

      {/* Payment Dialog */}
      <SplitPaymentDialog
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        total={total}
        formatCurrency={fc}
        onComplete={handlePayment}
        isProcessing={isProcessingPayment}
      />
    </div>
  );
}

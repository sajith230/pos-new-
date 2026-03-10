import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table as TableType, TableStatus, Order, OrderItem, Product, Category, PaymentMethod, OrderStatus } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/lib/formatCurrency';
import {
  Users, Search, Plus, Minus, Trash2, ChefHat, Receipt, X, Banknote, CreditCard,
  Wallet, Loader2, LayoutGrid, ShoppingBag, Clock, FileText, RefreshCw,
  MessageSquare, CheckCircle2, AlertCircle, Timer
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type TabId = 'tables' | 'order' | 'status' | 'bill';

const statusColors: Record<TableStatus, string> = {
  available: 'table-status-available',
  occupied: 'table-status-occupied',
  reserved: 'table-status-reserved',
  cleaning: 'table-status-cleaning',
};

const orderStatusConfig: Record<string, { color: string; icon: typeof Clock }> = {
  pending: { color: 'bg-muted text-muted-foreground', icon: Clock },
  preparing: { color: 'bg-warning/20 text-warning', icon: Timer },
  ready: { color: 'bg-success/20 text-success', icon: CheckCircle2 },
  served: { color: 'bg-primary/20 text-primary', icon: CheckCircle2 },
  completed: { color: 'bg-success/20 text-success', icon: CheckCircle2 },
  cancelled: { color: 'bg-destructive/20 text-destructive', icon: AlertCircle },
};

export default function WaiterMobile() {
  const [activeTab, setActiveTab] = useState<TabId>('tables');
  const [tables, setTables] = useState<TableType[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableType | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingKOT, setIsSendingKOT] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [noteDialogItem, setNoteDialogItem] = useState<OrderItem | null>(null);
  const [itemNote, setItemNote] = useState('');
  const [myOrders, setMyOrders] = useState<(Order & { table?: TableType })[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [expandedOrderItems, setExpandedOrderItems] = useState<OrderItem[]>([]);
  const [paymentComplete, setPaymentComplete] = useState<{ txnNumber: string; total: number } | null>(null);
  const [showCartItems, setShowCartItems] = useState(false);

  const { business, branch, user } = useAuth();
  const { toast } = useToast();
  const { format: fc } = useCurrency();

  useEffect(() => {
    if (business?.id && branch?.id) {
      fetchTables();
      fetchProducts();
      fetchCategories();
      fetchMyOrders();
    }
  }, [business?.id, branch?.id]);

  // Realtime subscription for order status changes
  useEffect(() => {
    if (!business?.id) return;
    const channel = supabase
      .channel('waiter-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchMyOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [business?.id]);

  async function fetchTables() {
    const { data } = await supabase
      .from('tables').select('*')
      .eq('branch_id', branch!.id).eq('is_active', true).order('name');
    setTables((data as TableType[]) || []);
  }

  async function fetchProducts() {
    setIsLoading(true);
    const { data } = await supabase
      .from('products').select('*, category:categories(*)')
      .eq('business_id', business!.id).eq('is_active', true).order('name');
    setProducts((data as Product[]) || []);
    setIsLoading(false);
  }

  async function fetchCategories() {
    const { data } = await supabase
      .from('categories').select('*')
      .eq('business_id', business!.id).eq('is_active', true).order('sort_order');
    setCategories((data as Category[]) || []);
  }

  async function fetchMyOrders() {
    if (!business?.id || !user?.id) return;
    const { data } = await supabase
      .from('orders')
      .select('*, table:tables(*)')
      .eq('business_id', business.id)
      .eq('created_by', user.id)
      .in('status', ['pending', 'preparing', 'ready', 'served'])
      .order('created_at', { ascending: false });
    setMyOrders((data as (Order & { table?: TableType })[]) || []);
  }

  async function fetchOrderForTable(tableId: string) {
    const { data } = await supabase
      .from('orders').select('*')
      .eq('table_id', tableId)
      .in('status', ['pending', 'preparing', 'ready', 'served'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
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
      .from('order_items').select('*, product:products(*)')
      .eq('order_id', orderId).order('created_at');
    setOrderItems((data as OrderItem[]) || []);
  }

  async function handleTableSelect(table: TableType) {
    setSelectedTable(table);
    const status = (table.status as TableStatus) || 'available';

    if (status === 'occupied') {
      await fetchOrderForTable(table.id);
      setActiveTab('order');
    } else if (status === 'available') {
      const orderNumber = `ORD-${Date.now()}`;
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          business_id: business!.id, branch_id: branch!.id,
          table_id: table.id, order_number: orderNumber,
          order_type: 'dine_in' as const, status: 'pending' as const,
          created_by: user?.id,
        })
        .select().single();
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      await supabase.from('tables').update({ status: 'occupied' }).eq('id', table.id);
      setActiveOrder(order as Order);
      setOrderItems([]);
      setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'occupied' as TableStatus } : t));
      setActiveTab('order');
    }
  }

  async function addItemToOrder(product: Product) {
    if (!activeOrder) return;
    const existing = orderItems.find(i => i.product_id === product.id && i.status === 'pending');
    if (existing) {
      await supabase.from('order_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id);
      setOrderItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      const { data, error } = await supabase
        .from('order_items')
        .insert({
          order_id: activeOrder.id, product_id: product.id,
          quantity: 1, unit_price: product.price, status: 'pending' as const,
        })
        .select('*, product:products(*)').single();
      if (!error && data) setOrderItems(prev => [...prev, data as OrderItem]);
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

  async function saveItemNote() {
    if (!noteDialogItem) return;
    await supabase.from('order_items').update({ notes: itemNote }).eq('id', noteDialogItem.id);
    setOrderItems(prev => prev.map(i => i.id === noteDialogItem.id ? { ...i, notes: itemNote } : i));
    setNoteDialogItem(null);
    setItemNote('');
  }

  async function sendToKitchen() {
    if (!activeOrder) return;
    const pendingItems = orderItems.filter(i => i.status === 'pending');
    if (pendingItems.length === 0) {
      toast({ title: 'No new items', description: 'All items already sent to kitchen.' });
      return;
    }
    setIsSendingKOT(true);
    try {
      const now = new Date().toISOString();
      const pendingIds = pendingItems.map(i => i.id);
      await supabase.from('order_items')
        .update({ status: 'preparing' as const, sent_to_kitchen_at: now })
        .in('id', pendingIds);

      const kotNumber = `KOT-${Date.now()}`;
      const kotItems = pendingItems.map(i => ({
        product_id: i.product_id, product_name: i.product?.name || 'Unknown',
        quantity: i.quantity, notes: i.notes || '',
        prep_time: i.product?.prep_time || null,
        image_url: i.product?.image_url || null,
      }));
      await supabase.from('kot_tickets').insert({
        order_id: activeOrder.id, ticket_number: kotNumber, items: kotItems,
      });
      await supabase.from('orders').update({ status: 'pending' as const }).eq('id', activeOrder.id);
      setOrderItems(prev => prev.map(i => pendingIds.includes(i.id) ? { ...i, status: 'preparing' as const, sent_to_kitchen_at: now } : i));
      setActiveOrder(prev => prev ? { ...prev, status: 'pending' } : prev);
      toast({ title: 'Sent to Kitchen!', description: `${pendingItems.length} item(s) — ${kotNumber}` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSendingKOT(false);
    }
  }

  async function handlePayment(method: PaymentMethod) {
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
          business_id: business!.id, branch_id: branch!.id,
          transaction_number: txnNumber, subtotal,
          tax_amount: taxAmount, total_amount: totalAmount, created_by: user?.id,
        })
        .select().single();
      if (txnError) throw txnError;

      const txnItems = orderItems.map(i => ({
        transaction_id: txn.id, product_id: i.product_id, quantity: i.quantity,
        unit_price: i.unit_price, tax_amount: i.unit_price * i.quantity * ((business?.tax_rate || 0) / 100),
        total_price: i.unit_price * i.quantity,
      }));
      await supabase.from('transaction_items').insert(txnItems);
      await supabase.from('payments').insert({ transaction_id: txn.id, payment_method: method, amount: totalAmount });

      // Deduct stock for each item
      for (const item of orderItems) {
        await supabase.rpc('deduct_stock_for_sale', {
          _branch_id: branch!.id,
          _product_id: item.product_id,
          _quantity: item.quantity,
          _reference_id: txn.id,
        });
      }

      await supabase.from('orders').update({ status: 'completed' as const, transaction_id: txn.id }).eq('id', activeOrder.id);

      if (selectedTable) {
        await supabase.from('tables').update({ status: 'available' }).eq('id', selectedTable.id);
        setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'available' as TableStatus } : t));
      }

      setPaymentComplete({ txnNumber, total: totalAmount });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Payment Failed', description: error.message });
    } finally {
      setIsProcessingPayment(false);
    }
  }

  function resetAfterPayment() {
    setPaymentComplete(null);
    setActiveOrder(null);
    setOrderItems([]);
    setSelectedTable(null);
    setActiveTab('tables');
    fetchMyOrders();
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
    setActiveTab('tables');
    toast({ title: 'Order Cancelled' });
  }

  async function loadExpandedOrder(orderId: string) {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    const { data } = await supabase.from('order_items').select('*, product:products(*)').eq('order_id', orderId).order('created_at');
    setExpandedOrderItems((data as OrderItem[]) || []);
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const subtotal = orderItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const taxRate = business?.tax_rate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const pendingCount = orderItems.filter(i => i.status === 'pending').length;
  const itemCount = orderItems.reduce((sum, i) => sum + i.quantity, 0);

  if (!business) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <Card className="max-w-sm mx-4">
          <CardContent className="pt-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Business Setup Required</h2>
            <p className="text-sm text-muted-foreground">Set up your business before using the waiter interface.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'tables', label: 'Tables', icon: LayoutGrid },
    { id: 'order', label: 'Order', icon: ShoppingBag },
    { id: 'status', label: 'Status', icon: Clock },
    { id: 'bill', label: 'Bill', icon: Receipt },
  ];

  return (
    <div className="flex flex-col h-[calc(100dvh-120px)] max-w-lg mx-auto relative">
      {/* Header */}
      <div className="flex items-center justify-between px-1 py-2">
        <div>
          <h1 className="text-lg font-bold">Waiter Mode</h1>
          {selectedTable && activeOrder && (
            <p className="text-xs text-muted-foreground">
              {selectedTable.name} • {activeOrder.order_number.slice(-6)}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => { fetchTables(); fetchMyOrders(); }}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* === TABLES TAB === */}
        {activeTab === 'tables' && (
          <ScrollArea className="h-full px-1">
            <div className="grid grid-cols-3 gap-3 pb-4">
              {tables.map(table => (
                <Card
                  key={table.id}
                  className={`cursor-pointer active:scale-95 transition-all border-2 ${statusColors[(table.status as TableStatus) || 'available']} ${selectedTable?.id === table.id ? 'ring-2 ring-ring' : ''}`}
                  onClick={() => handleTableSelect(table)}
                >
                  <CardContent className="p-4 text-center">
                    <p className="font-bold text-sm">{table.name}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Users className="h-3 w-3" />
                      <span className="text-xs">{table.capacity}</span>
                    </div>
                    <Badge variant="secondary" className="mt-2 text-[10px]">
                      {(table.status as string) || 'available'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
            {tables.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <LayoutGrid className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tables configured</p>
              </div>
            )}
          </ScrollArea>
        )}

        {/* === ORDER TAB === */}
        {activeTab === 'order' && (
          <div className="h-full flex flex-col">
            {!activeOrder ? (
              <div className="flex-1 flex items-center justify-center text-center px-6">
                <div>
                  <ShoppingBag className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="font-medium">No Active Order</p>
                  <p className="text-sm text-muted-foreground mt-1">Select a table first to start an order.</p>
                  <Button variant="outline" className="mt-4" onClick={() => setActiveTab('tables')}>Go to Tables</Button>
                </div>
              </div>
            ) : (
              <>
                {/* Search + Categories */}
                <div className="px-1 space-y-2 pb-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search menu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-11" />
                  </div>
                  <ScrollArea className="w-full">
                    <div className="flex gap-2 pb-1">
                      <Badge variant={selectedCategory === null ? 'default' : 'outline'} className="cursor-pointer whitespace-nowrap min-h-[32px] px-3" onClick={() => setSelectedCategory(null)}>All</Badge>
                      {categories.map(c => (
                        <Badge key={c.id} variant={selectedCategory === c.id ? 'default' : 'outline'} className="cursor-pointer whitespace-nowrap min-h-[32px] px-3" onClick={() => setSelectedCategory(c.id)}>{c.name}</Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Product Grid */}
                <ScrollArea className="flex-1 px-1">
                  <div className={`grid grid-cols-2 gap-2 ${orderItems.length > 0 ? 'pb-36' : 'pb-4'}`}>
                    {filteredProducts.map(product => (
                      <Card key={product.id} className="cursor-pointer active:scale-95 transition-all hover:border-primary" onClick={() => addItemToOrder(product)}>
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
                </ScrollArea>

                {/* Floating Cart Bar + Collapsible Items */}
                {orderItems.length > 0 && (
                  <div className="absolute bottom-16 left-0 right-0 max-w-lg mx-auto px-2 z-20">
                    {/* Collapsible Order Items */}
                    {showCartItems && (
                      <Card className="mb-1 border-primary/30">
                        <ScrollArea className="max-h-48">
                          <div className="divide-y">
                            {orderItems.map(item => (
                              <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{item.product?.name}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{fc(item.unit_price)}</span>
                                    {item.status !== 'pending' && (
                                      <Badge variant="secondary" className="text-[10px] px-1 py-0">{item.status}</Badge>
                                    )}
                                    {item.notes && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0">📝</Badge>
                                    )}
                                  </div>
                                </div>
                                {item.status === 'pending' ? (
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setNoteDialogItem(item); setItemNote(item.notes || ''); }}>
                                      <MessageSquare className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); updateItemQuantity(item.id, item.quantity - 1); }}>
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); updateItemQuantity(item.id, item.quantity + 1); }}>
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-sm font-medium">×{item.quantity}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </Card>
                    )}

                    {/* Cart Summary Bar */}
                    <Card className="bg-primary text-primary-foreground shadow-lg cursor-pointer" onClick={() => setShowCartItems(!showCartItems)}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{itemCount} item(s) • {fc(subtotal)}</p>
                          {pendingCount > 0 && (
                            <p className="text-xs opacity-80">{pendingCount} pending for kitchen</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); sendToKitchen(); }} disabled={pendingCount === 0 || isSendingKOT} className="h-9">
                            {isSendingKOT ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChefHat className="h-4 w-4 mr-1" />}
                            KOT
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* === STATUS TAB === */}
        {activeTab === 'status' && (
          <ScrollArea className="h-full px-1">
            <div className="space-y-3 pb-4">
              {myOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active orders</p>
                </div>
              ) : (
                myOrders.map(order => {
                  const cfg = orderStatusConfig[order.status || 'pending'];
                  const isExpanded = expandedOrderId === order.id;
                  return (
                    <Card key={order.id} className="overflow-hidden" onClick={() => loadExpandedOrder(order.id)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm">{order.table?.name || 'Table'}</p>
                            <p className="text-xs text-muted-foreground">{order.order_number.slice(-6)}</p>
                          </div>
                          <div className="text-right">
                            <Badge className={`${cfg.color} text-xs`}>{order.status}</Badge>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        {isExpanded && expandedOrderItems.length > 0 && (
                          <div className="mt-3 pt-3 border-t space-y-2">
                            {expandedOrderItems.map(item => {
                              const itemCfg = orderStatusConfig[item.status || 'pending'];
                              return (
                                <div key={item.id} className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate">{item.product?.name}</p>
                                    {item.notes && <p className="text-[10px] text-muted-foreground">📝 {item.notes}</p>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">×{item.quantity}</span>
                                    <Badge className={`${itemCfg.color} text-[10px] px-1.5`}>{item.status}</Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        )}

        {/* === BILL TAB === */}
        {activeTab === 'bill' && (
          <div className="h-full px-1">
            {paymentComplete ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <h2 className="text-xl font-bold mb-1">Payment Complete!</h2>
                <p className="text-muted-foreground text-sm mb-1">{paymentComplete.txnNumber}</p>
                <p className="text-2xl font-bold text-primary mb-6">{fc(paymentComplete.total)}</p>
                <Button onClick={resetAfterPayment} className="w-full max-w-xs">New Order</Button>
              </div>
            ) : !activeOrder ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <Receipt className="h-10 w-10 text-muted-foreground opacity-50 mb-2" />
                <p className="font-medium">No Active Order</p>
                <p className="text-sm text-muted-foreground mt-1">Select a table and add items first.</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('tables')}>Go to Tables</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Order Summary */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-3">{selectedTable?.name} — Order Summary</h3>
                    <div className="space-y-2">
                      {orderItems.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.product?.name} ×{item.quantity}</span>
                          <span>{fc(item.unit_price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <Separator className="my-3" />
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fc(subtotal)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Tax ({taxRate}%)</span><span>{fc(taxAmount)}</span></div>
                      <Separator className="my-1" />
                      <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-primary">{fc(total)}</span></div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Methods */}
                <div className="grid grid-cols-2 gap-3">
                  {([['cash', Banknote, 'Cash'], ['card', CreditCard, 'Card'], ['upi', Wallet, 'UPI'], ['wallet', Wallet, 'Wallet']] as const).map(([method, Icon, label]) => (
                    <Button key={method} variant="outline" className="h-16 flex-col gap-1" onClick={() => handlePayment(method)} disabled={isProcessingPayment || orderItems.length === 0}>
                      {isProcessingPayment ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                      <span className="text-xs">{label}</span>
                    </Button>
                  ))}
                </div>

                {/* Cancel */}
                <Button variant="destructive" className="w-full" onClick={cancelOrder}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel Order
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div className="border-t bg-card flex z-30 relative">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`relative flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors min-h-[56px] ${activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
            {tab.id === 'order' && itemCount > 0 && (
              <span className="absolute top-1 right-1/4 bg-primary text-primary-foreground text-[9px] rounded-full h-4 w-4 flex items-center justify-center">{itemCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Item Note Dialog */}
      <Dialog open={!!noteDialogItem} onOpenChange={() => setNoteDialogItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Item Note</DialogTitle></DialogHeader>
          <Textarea placeholder="Special instructions..." value={itemNote} onChange={e => setItemNote(e.target.value)} className="min-h-[80px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogItem(null)}>Cancel</Button>
            <Button onClick={saveItemNote}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

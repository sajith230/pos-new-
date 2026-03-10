import { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronUp, Trash2, Package } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PermissionButton } from '@/components/auth/PermissionButton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/lib/formatCurrency';
import { format } from 'date-fns';

type Supplier = { id: string; name: string };
type Product = { id: string; name: string; sku: string | null; cost_price: number | null };
type POItem = { id: string; product_id: string; product_name: string; quantity: number; unit_price: number; total_price: number; received_quantity: number };
type PO = { id: string; order_number: string; status: string; supplier: { name: string }; supplier_id: string; total_amount: number; expected_date: string | null; created_at: string; notes: string | null; items?: POItem[] };

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary', sent: 'default', partial: 'outline', received: 'default', cancelled: 'destructive',
};

type LineItem = { product_id: string; product_name: string; quantity: number; unit_price: number };

export default function PurchaseOrders() {
  const { business, branch, user } = useAuth();
  const { toast } = useToast();
  const { format: fc } = useCurrency();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [orders, setOrders] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [poItems, setPOItems] = useState<Record<string, POItem[]>>({});

  // Create PO Dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newPO, setNewPO] = useState({ supplier_id: '', expected_date: '', notes: '' });
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Receive Dialog
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receivingPO, setReceivingPO] = useState<PO | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (business?.id) {
      fetchOrders();
      fetchSuppliers();
      fetchProducts();
    }
  }, [business?.id]);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(name)')
      .eq('business_id', business!.id)
      .order('created_at', { ascending: false });
    setOrders((data as any) || []);
    setLoading(false);
  }

  async function fetchSuppliers() {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('business_id', business!.id)
      .eq('is_active', true)
      .order('name');
    setSuppliers((data as Supplier[]) || []);
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, sku, cost_price')
      .eq('business_id', business!.id)
      .eq('is_active', true)
      .order('name');
    setProducts((data as Product[]) || []);
  }

  async function fetchPOItems(poId: string) {
    const { data } = await supabase
      .from('purchase_order_items')
      .select('*, product:products(name)')
      .eq('purchase_order_id', poId);
    const items = (data || []).map((i: any) => ({
      id: i.id,
      product_id: i.product_id,
      product_name: i.product?.name || 'Unknown',
      quantity: i.quantity,
      unit_price: i.unit_price,
      total_price: i.total_price,
      received_quantity: i.received_quantity || 0,
    }));
    setPOItems(prev => ({ ...prev, [poId]: items }));
  }

  function toggleExpand(poId: string) {
    if (expandedPO === poId) {
      setExpandedPO(null);
    } else {
      setExpandedPO(poId);
      if (!poItems[poId]) fetchPOItems(poId);
    }
  }

  async function updateStatus(id: string, status: string) {
    const updates: any = { status };
    if (status === 'received') updates.received_date = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('purchase_orders').update(updates).eq('id', id);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: `Status updated to ${status}` });
    fetchOrders();
  }

  // Create PO
  function openCreateDialog() {
    setNewPO({ supplier_id: '', expected_date: '', notes: '' });
    setLineItems([]);
    setCreateStep(1);
    setCreateDialogOpen(true);
  }

  function addLineItem() {
    setLineItems([...lineItems, { product_id: '', product_name: '', quantity: 1, unit_price: 0 }]);
  }

  function updateLineItem(index: number, field: keyof LineItem, value: any) {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        updated[index].product_name = product.name;
        updated[index].unit_price = product.cost_price || 0;
      }
    }
    setLineItems(updated);
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  async function handleCreatePO() {
    if (!newPO.supplier_id || lineItems.length === 0 || !branch?.id) return;
    setSaving(true);

    const orderNumber = `PO-${Date.now()}`;
    const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);

    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        business_id: business!.id,
        branch_id: branch.id,
        supplier_id: newPO.supplier_id,
        order_number: orderNumber,
        expected_date: newPO.expected_date || null,
        notes: newPO.notes || null,
        subtotal,
        total_amount: subtotal,
        status: 'draft',
        created_by: user?.id,
      })
      .select()
      .single();

    if (poError) {
      toast({ variant: 'destructive', title: 'Error creating PO', description: poError.message });
      setSaving(false);
      return;
    }

    const itemsPayload = lineItems.map(li => ({
      purchase_order_id: poData.id,
      product_id: li.product_id,
      quantity: li.quantity,
      unit_price: li.unit_price,
      total_price: li.quantity * li.unit_price,
    }));

    const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsPayload);
    if (itemsError) {
      toast({ variant: 'destructive', title: 'Error adding items', description: itemsError.message });
    }

    toast({ title: 'Purchase Order Created', description: `Order ${orderNumber} created successfully` });
    setCreateDialogOpen(false);
    setSaving(false);
    fetchOrders();
  }

  // Receive PO
  function openReceiveDialog(po: PO) {
    setReceivingPO(po);
    if (!poItems[po.id]) fetchPOItems(po.id);
    setReceiveQuantities({});
    setReceiveDialogOpen(true);
  }

  async function handleReceive() {
    if (!receivingPO || !branch?.id) return;
    setSaving(true);

    const items = poItems[receivingPO.id] || [];
    let allReceived = true;

    for (const item of items) {
      const qtyToReceive = receiveQuantities[item.id] ?? (item.quantity - item.received_quantity);
      if (qtyToReceive <= 0) continue;

      const newReceivedQty = item.received_quantity + qtyToReceive;
      if (newReceivedQty < item.quantity) allReceived = false;

      // Update PO item received quantity
      await supabase
        .from('purchase_order_items')
        .update({ received_quantity: newReceivedQty })
        .eq('id', item.id);

      // Update inventory
      const { data: invData } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('branch_id', branch.id)
        .eq('product_id', item.product_id)
        .single();

      if (invData) {
        await supabase
          .from('inventory')
          .update({ quantity: invData.quantity + qtyToReceive })
          .eq('id', invData.id);
      } else {
        await supabase.from('inventory').insert({
          branch_id: branch.id,
          product_id: item.product_id,
          quantity: qtyToReceive,
        });
      }

      // Create stock movement
      await supabase.from('stock_movements').insert({
        branch_id: branch.id,
        product_id: item.product_id,
        quantity: qtyToReceive,
        movement_type: 'purchase',
        reference_type: 'purchase_order',
        reference_id: receivingPO.id,
        notes: `Received from PO ${receivingPO.order_number}`,
        created_by: user?.id,
      });
    }

    // Update PO status
    const newStatus = allReceived ? 'received' : 'partial';
    await supabase
      .from('purchase_orders')
      .update({ status: newStatus, received_date: allReceived ? new Date().toISOString().split('T')[0] : null })
      .eq('id', receivingPO.id);

    toast({ title: 'Stock Received', description: `Inventory updated from PO ${receivingPO.order_number}` });
    setReceiveDialogOpen(false);
    setSaving(false);
    fetchOrders();
    fetchPOItems(receivingPO.id);
  }

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);
  const lineTotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">Track orders to suppliers</p>
        </div>
        <PermissionButton permitted={canCreate('inventory.orders')} onClick={openCreateDialog}><Plus className="h-4 w-4 mr-2" />Create PO</PermissionButton>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Order #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No purchase orders found</TableCell></TableRow>
              ) : filtered.map(po => (
                <Collapsible key={po.id} open={expandedPO === po.id} asChild>
                  <>
                    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(po.id)}>
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {expandedPO === po.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell className="font-medium">{po.order_number}</TableCell>
                      <TableCell>{po.supplier?.name || '—'}</TableCell>
                      <TableCell><Badge variant={statusColors[po.status] || 'secondary'}>{po.status}</Badge></TableCell>
                      <TableCell className="text-right">{fc(po.total_amount || 0)}</TableCell>
                      <TableCell>{po.expected_date ? format(new Date(po.expected_date), 'dd MMM yyyy') : '—'}</TableCell>
                      <TableCell>{format(new Date(po.created_at), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-right space-x-1" onClick={e => e.stopPropagation()}>
                        {po.status === 'draft' && <PermissionButton permitted={canEdit('inventory.orders')} size="sm" variant="outline" onClick={() => updateStatus(po.id, 'sent')}>Send</PermissionButton>}
                        {(po.status === 'sent' || po.status === 'partial') && (
                          <PermissionButton permitted={canEdit('inventory.orders')} size="sm" variant="default" onClick={() => openReceiveDialog(po)}>
                            <Package className="h-4 w-4 mr-1" />Receive
                          </PermissionButton>
                        )}
                        {(po.status === 'draft' || po.status === 'sent') && (
                          <PermissionButton permitted={canDelete('inventory.orders')} size="sm" variant="ghost" className="text-destructive" onClick={() => updateStatus(po.id, 'cancelled')}>Cancel</PermissionButton>
                        )}
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={8} className="p-4">
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Line Items</p>
                            {poItems[po.id]?.length ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Unit Price</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Received</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {poItems[po.id].map(item => (
                                    <TableRow key={item.id}>
                                      <TableCell>{item.product_name}</TableCell>
                                      <TableCell className="text-right">{item.quantity}</TableCell>
                                      <TableCell className="text-right">{fc(item.unit_price)}</TableCell>
                                      <TableCell className="text-right">{fc(item.total_price)}</TableCell>
                                      <TableCell className="text-right">{item.received_quantity}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <p className="text-sm text-muted-foreground">Loading items...</p>
                            )}
                            {po.notes && <p className="text-sm text-muted-foreground mt-2">Notes: {po.notes}</p>}
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create PO Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Purchase Order - Step {createStep} of 2</DialogTitle>
          </DialogHeader>

          {createStep === 1 && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Supplier *</Label>
                <Select value={newPO.supplier_id} onValueChange={v => setNewPO({ ...newPO, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expected Delivery Date</Label>
                <Input type="date" value={newPO.expected_date} onChange={e => setNewPO({ ...newPO, expected_date: e.target.value })} />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={newPO.notes} onChange={e => setNewPO({ ...newPO, notes: e.target.value })} rows={2} />
              </div>
            </div>
          )}

          {createStep === 2 && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button variant="outline" size="sm" onClick={addLineItem}><Plus className="h-4 w-4 mr-1" />Add Item</Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {lineItems.map((li, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Product</Label>
                      <Select value={li.product_id} onValueChange={v => updateLineItem(idx, 'product_id', v)}>
                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>
                          {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-20">
                      <Label className="text-xs">Qty</Label>
                      <Input type="number" min={1} value={li.quantity} onChange={e => updateLineItem(idx, 'quantity', +e.target.value)} />
                    </div>
                    <div className="w-24">
                      <Label className="text-xs">Unit Price</Label>
                      <Input type="number" min={0} value={li.unit_price} onChange={e => updateLineItem(idx, 'unit_price', +e.target.value)} />
                    </div>
                    <div className="w-24 text-right font-medium pt-5">
                      {fc(li.quantity * li.unit_price)}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeLineItem(idx)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              {lineItems.length > 0 && (
                <div className="flex justify-end pt-2 border-t">
                  <span className="font-medium">Total: {fc(lineTotal)}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {createStep === 1 ? (
              <Button onClick={() => setCreateStep(2)} disabled={!newPO.supplier_id}>Next</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCreateStep(1)}>Back</Button>
                <Button onClick={handleCreatePO} disabled={saving || lineItems.length === 0}>
                  {saving ? 'Creating...' : 'Create Purchase Order'}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive Stock - {receivingPO?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Enter quantities received for each item:</p>
            {receivingPO && poItems[receivingPO.id]?.map(item => {
              const remaining = item.quantity - item.received_quantity;
              return (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">Ordered: {item.quantity} | Already received: {item.received_quantity}</p>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min={0}
                      max={remaining}
                      placeholder={`Max ${remaining}`}
                      value={receiveQuantities[item.id] ?? remaining}
                      onChange={e => setReceiveQuantities({ ...receiveQuantities, [item.id]: Math.min(remaining, Math.max(0, +e.target.value)) })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleReceive} disabled={saving}>
              {saving ? 'Processing...' : 'Confirm Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Package, AlertTriangle, TrendingDown, ArrowUpDown, History, Minus, Plus } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PermissionButton } from '@/components/auth/PermissionButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/lib/formatCurrency';
import { Inventory, Product } from '@/types/database';
import { format } from 'date-fns';

type StockMovement = {
  id: string;
  product_id: string;
  quantity: number;
  movement_type: string;
  notes: string | null;
  created_at: string;
  product?: { name: string };
};

const adjustmentReasons = [
  { value: 'recount', label: 'Physical Recount' },
  { value: 'damage', label: 'Damaged Goods' },
  { value: 'return', label: 'Customer Return' },
  { value: 'expired', label: 'Expired' },
  { value: 'theft', label: 'Theft/Loss' },
  { value: 'other', label: 'Other' },
];

export default function StockOverview() {
  const { business, branch, user } = useAuth();
  const { toast } = useToast();
  const { format: fc } = useCurrency();
  const { canEdit } = usePermissions();
  const [inventory, setInventory] = useState<(Inventory & { product: Product })[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<(Inventory & { product: Product }) | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');
  const [adjustmentQty, setAdjustmentQty] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('recount');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business?.id) {
      fetchInventory();
      fetchMovements();
    }
  }, [business?.id]);

  // Realtime subscription for inventory changes
  useEffect(() => {
    if (!branch?.id) return;
    const channel = supabase
      .channel('stock-overview-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchInventory();
        fetchMovements();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [branch?.id]);

  async function fetchInventory() {
    setLoading(true);
    const { data } = await supabase
      .from('inventory')
      .select('*, product:products(*)')
      .order('quantity', { ascending: true });
    setInventory((data as any) || []);
    setLoading(false);
  }

  async function fetchMovements() {
    if (!branch?.id) return;
    const { data } = await supabase
      .from('stock_movements')
      .select('*, product:products(name)')
      .eq('branch_id', branch.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setMovements((data as any) || []);
  }

  function openAdjustDialog(item: Inventory & { product: Product }) {
    setSelectedItem(item);
    setAdjustmentType('add');
    setAdjustmentQty(0);
    setAdjustmentReason('recount');
    setAdjustmentNotes('');
    setAdjustDialogOpen(true);
  }

  async function handleAdjustStock() {
    if (!selectedItem || !branch?.id || adjustmentQty <= 0) return;
    setSaving(true);

    const quantityChange = adjustmentType === 'add' ? adjustmentQty : -adjustmentQty;
    const newQuantity = selectedItem.quantity + quantityChange;

    // Update inventory
    const { error: invError } = await supabase
      .from('inventory')
      .update({ quantity: newQuantity, last_counted_at: new Date().toISOString() })
      .eq('id', selectedItem.id);

    if (invError) {
      toast({ variant: 'destructive', title: 'Error', description: invError.message });
      setSaving(false);
      return;
    }

    // Create stock movement record
    const { error: mvError } = await supabase.from('stock_movements').insert({
      branch_id: branch.id,
      product_id: selectedItem.product_id,
      quantity: quantityChange,
      movement_type: adjustmentType === 'add' ? 'adjustment_in' : 'adjustment_out',
      reference_type: adjustmentReason,
      notes: adjustmentNotes || `${adjustmentReasons.find(r => r.value === adjustmentReason)?.label} adjustment`,
      created_by: user?.id,
    });

    if (mvError) {
      toast({ variant: 'destructive', title: 'Movement log failed', description: mvError.message });
    }

    toast({ title: 'Stock Adjusted', description: `${selectedItem.product?.name} quantity updated to ${newQuantity}` });
    setAdjustDialogOpen(false);
    setSaving(false);
    fetchInventory();
    fetchMovements();
  }

  const filtered = inventory.filter(i =>
    i.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
    i.product?.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = inventory.filter(i => i.product && i.quantity <= (i.product.min_stock || 0));
  const totalItems = inventory.reduce((sum, i) => sum + Number(i.quantity), 0);
  const totalValue = inventory.reduce((sum, i) => sum + Number(i.quantity) * (i.product?.cost_price || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stock Overview</h1>
        <p className="text-muted-foreground">Monitor and adjust inventory levels across your branch</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalItems}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock Value</CardTitle>
            <TrendingDown className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fc(totalValue)}</div></CardContent>
        </Card>
        <Card className={lowStock.length > 0 ? 'border-destructive' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{lowStock.length}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="movements">Recent Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Inventory</CardTitle>
                <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Min Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No inventory records found</TableCell></TableRow>
                  ) : filtered.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product?.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.product?.sku || '—'}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{item.product?.min_stock || 0}</TableCell>
                      <TableCell>
                        {item.quantity <= (item.product?.min_stock || 0) ? (
                          <Badge variant="destructive">Low Stock</Badge>
                        ) : (
                          <Badge variant="secondary">In Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <PermissionButton permitted={canEdit('inventory.stock')} variant="outline" size="sm" onClick={() => openAdjustDialog(item)}>
                          <ArrowUpDown className="h-4 w-4 mr-1" /> Adjust
                        </PermissionButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" /> Recent Stock Movements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty Change</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No movements recorded</TableCell></TableRow>
                  ) : movements.map(mv => (
                    <TableRow key={mv.id}>
                      <TableCell>{format(new Date(mv.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                      <TableCell className="font-medium">{mv.product?.name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={mv.quantity > 0 ? 'default' : 'secondary'}>
                          {mv.movement_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${mv.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {mv.quantity > 0 ? '+' : ''}{mv.quantity}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{mv.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock: {selectedItem?.product?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center gap-4 p-4 bg-muted rounded-lg">
              <span className="text-muted-foreground">Current Qty:</span>
              <span className="text-2xl font-bold">{selectedItem?.quantity}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={adjustmentType === 'add' ? 'default' : 'outline'}
                onClick={() => setAdjustmentType('add')}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Stock
              </Button>
              <Button
                variant={adjustmentType === 'subtract' ? 'default' : 'outline'}
                onClick={() => setAdjustmentType('subtract')}
                className="w-full"
              >
                <Minus className="h-4 w-4 mr-2" /> Remove Stock
              </Button>
            </div>

            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min={0}
                value={adjustmentQty}
                onChange={e => setAdjustmentQty(Math.max(0, Number(e.target.value)))}
                placeholder="Enter quantity"
              />
            </div>

            <div>
              <Label>Reason</Label>
              <Select value={adjustmentReason} onValueChange={setAdjustmentReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {adjustmentReasons.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={adjustmentNotes}
                onChange={e => setAdjustmentNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-center gap-4 p-4 bg-muted rounded-lg">
              <span className="text-muted-foreground">New Qty:</span>
              <span className={`text-2xl font-bold ${adjustmentType === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                {(selectedItem?.quantity || 0) + (adjustmentType === 'add' ? adjustmentQty : -adjustmentQty)}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdjustStock} disabled={saving || adjustmentQty <= 0}>
              {saving ? 'Saving...' : 'Confirm Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

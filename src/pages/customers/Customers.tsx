import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Search, Star, Trash2, Users, TrendingUp, Award, ArrowUpDown, Eye, Minus } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PermissionButton } from '@/components/auth/PermissionButton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/lib/formatCurrency';
import { Customer, Transaction, Payment } from '@/types/database';
import { format } from 'date-fns';

const emptyCustomer = { name: '', email: '', phone: '', address: '', notes: '' };

type SortKey = 'name' | 'total_spent' | 'visit_count' | 'loyalty_points';
type SortDir = 'asc' | 'desc';

export default function Customers() {
  const { business } = useAuth();
  const { toast } = useToast();
  const { format: fc } = useCurrency();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Detail view
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<(Transaction & { payments: Payment[] })[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  // Loyalty adjust
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
  const [loyaltyAmount, setLoyaltyAmount] = useState('');
  const [loyaltyNote, setLoyaltyNote] = useState('');
  const [loyaltyMode, setLoyaltyMode] = useState<'add' | 'subtract'>('add');

  useEffect(() => { if (business?.id) fetchCustomers(); }, [business?.id]);

  async function fetchCustomers() {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').eq('business_id', business!.id).order('name');
    setCustomers((data as Customer[]) || []);
    setLoading(false);
  }

  // KPI calculations
  const kpis = useMemo(() => {
    const total = customers.length;
    const totalPoints = customers.reduce((s, c) => s + (c.loyalty_points || 0), 0);
    const totalRevenue = customers.reduce((s, c) => s + (c.total_spent || 0), 0);
    const avgSpend = total > 0 ? totalRevenue / total : 0;
    return { total, totalPoints, totalRevenue, avgSpend };
  }, [customers]);

  // Sorting & filtering
  const filtered = useMemo(() => {
    const list = customers.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    );
    list.sort((a, b) => {
      let va: string | number, vb: string | number;
      if (sortKey === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
      else { va = (a[sortKey] || 0) as number; vb = (b[sortKey] || 0) as number; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [customers, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  }

  function openCreate() { setEditing(null); setForm(emptyCustomer); setDialogOpen(true); }
  function openEdit(c: Customer, e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditing(c);
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', notes: c.notes || '' });
    setDialogOpen(true);
  }

  async function handleSave() {
    const payload = { ...form, business_id: business!.id };
    let error;
    if (editing) { ({ error } = await supabase.from('customers').update(payload).eq('id', editing.id)); }
    else { ({ error } = await supabase.from('customers').insert(payload)); }
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: editing ? 'Customer Updated' : 'Customer Added' });
    setDialogOpen(false);
    fetchCustomers();
  }

  // Delete
  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('customers').delete().eq('id', deleteTarget.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Cannot delete', description: error.message.includes('foreign') ? 'Customer has linked transactions. Remove those first.' : error.message });
    } else {
      toast({ title: 'Customer deleted' });
      fetchCustomers();
      if (detailCustomer?.id === deleteTarget.id) { setDetailOpen(false); setDetailCustomer(null); }
    }
    setDeleteTarget(null);
  }

  // Detail view
  async function openDetail(c: Customer) {
    setDetailCustomer(c);
    setDetailOpen(true);
    setHistoryLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('*, payments(*)')
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setPurchaseHistory((data as any[]) || []);
    setHistoryLoading(false);
  }

  // Loyalty points
  async function handleLoyaltyAdjust() {
    if (!detailCustomer) return;
    const amt = parseInt(loyaltyAmount);
    if (isNaN(amt) || amt <= 0) return;
    const delta = loyaltyMode === 'add' ? amt : -amt;
    const newPoints = Math.max(0, (detailCustomer.loyalty_points || 0) + delta);
    const { error } = await supabase.from('customers').update({ loyalty_points: newPoints }).eq('id', detailCustomer.id);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: `${loyaltyMode === 'add' ? 'Added' : 'Subtracted'} ${amt} points` });
    setLoyaltyOpen(false);
    setLoyaltyAmount('');
    setLoyaltyNote('');
    // Refresh
    setDetailCustomer({ ...detailCustomer, loyalty_points: newPoints });
    fetchCustomers();
  }

  // Inline notes save
  async function saveNotes(notes: string) {
    if (!detailCustomer) return;
    await supabase.from('customers').update({ notes }).eq('id', detailCustomer.id);
    setDetailCustomer({ ...detailCustomer, notes });
    fetchCustomers();
  }

  const SortButton = ({ label, field }: { label: string; field: SortKey }) => (
    <Button variant="ghost" size="sm" className="-ml-3 h-8 font-medium" onClick={() => toggleSort(field)}>
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your customer relationships</p>
        </div>
        <PermissionButton permitted={canCreate('customers')} onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Customer</PermissionButton>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{kpis.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loyalty Points</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{kpis.totalPoints.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fc(kpis.totalRevenue)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Spend / Customer</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fc(kpis.avgSpend)}</div></CardContent>
        </Card>
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortButton label="Name" field="name" /></TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right"><SortButton label="Loyalty" field="loyalty_points" /></TableHead>
                <TableHead className="text-right"><SortButton label="Total Spent" field="total_spent" /></TableHead>
                <TableHead className="text-right"><SortButton label="Visits" field="visit_count" /></TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No customers found</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(c)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone || '—'}</TableCell>
                  <TableCell>{c.email || '—'}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 text-accent-foreground" />{c.loyalty_points || 0}</span>
                  </TableCell>
                  <TableCell className="text-right">{fc(c.total_spent || 0)}</TableCell>
                  <TableCell className="text-right">{c.visit_count || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDetail(c); }}><Eye className="h-4 w-4" /></Button>
                      <PermissionButton permitted={canEdit('customers')} variant="ghost" size="icon" onClick={(e) => openEdit(c, e)}><Pencil className="h-4 w-4" /></PermissionButton>
                      <PermissionButton permitted={canDelete('customers')} variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}><Trash2 className="h-4 w-4 text-destructive" /></PermissionButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button onClick={handleSave} disabled={!form.name}>{editing ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>. If this customer has linked transactions, deletion may fail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailCustomer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {detailCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div>{detailCustomer.name}</div>
                    <div className="text-sm font-normal text-muted-foreground">Customer since {format(new Date(detailCustomer.created_at), 'MMM yyyy')}</div>
                  </div>
                </DialogTitle>
                <DialogDescription className="sr-only">Customer details and purchase history</DialogDescription>
              </DialogHeader>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3 my-2">
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Loyalty Points</div>
                  <div className="text-xl font-bold flex items-center justify-center gap-1">
                    <Star className="h-4 w-4 text-accent-foreground" />
                    {detailCustomer.loyalty_points || 0}
                  </div>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => { setLoyaltyMode('add'); setLoyaltyOpen(true); }}>Adjust</Button>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Total Spent</div>
                  <div className="text-xl font-bold">{fc(detailCustomer.total_spent || 0)}</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Visits</div>
                  <div className="text-xl font-bold">{detailCustomer.visit_count || 0}</div>
                </div>
              </div>

              <Tabs defaultValue="info" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="info" className="flex-1">Info</TabsTrigger>
                  <TabsTrigger value="history" className="flex-1">Purchase History</TabsTrigger>
                  <TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{detailCustomer.phone || '—'}</span></div>
                    <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{detailCustomer.email || '—'}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium">{detailCustomer.address || '—'}</span></div>
                  </div>
                  <Separator />
                  <div className="flex gap-2">
                    {canEdit('customers') && <Button variant="outline" size="sm" onClick={() => openEdit(detailCustomer)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>}
                    {canDelete('customers') && <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteTarget(detailCustomer)}><Trash2 className="h-3 w-3 mr-1" />Delete</Button>}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  {historyLoading ? (
                    <p className="text-center text-muted-foreground py-6">Loading history...</p>
                  ) : purchaseHistory.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6">No purchase history</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {purchaseHistory.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                          <div>
                            <div className="font-medium">{tx.transaction_number}</div>
                            <div className="text-xs text-muted-foreground">{format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm')}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{fc(tx.total_amount)}</div>
                            <div className="flex gap-1 justify-end">
                              {tx.payments?.map(p => (
                                <Badge key={p.id} variant="secondary" className="text-xs capitalize">{p.payment_method}</Badge>
                              ))}
                            </div>
                            <Badge variant={tx.status === 'completed' ? 'default' : 'destructive'} className="text-xs mt-1 capitalize">{tx.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <NotesEditor initial={detailCustomer.notes || ''} onSave={saveNotes} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Loyalty Points Adjustment */}
      <Dialog open={loyaltyOpen} onOpenChange={setLoyaltyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adjust Loyalty Points</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button variant={loyaltyMode === 'add' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setLoyaltyMode('add')}>
                <Plus className="h-3 w-3 mr-1" />Add
              </Button>
              <Button variant={loyaltyMode === 'subtract' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setLoyaltyMode('subtract')}>
                <Minus className="h-3 w-3 mr-1" />Subtract
              </Button>
            </div>
            <div>
              <Label>Points</Label>
              <Input type="number" min="1" value={loyaltyAmount} onChange={e => setLoyaltyAmount(e.target.value)} placeholder="Enter points" />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input value={loyaltyNote} onChange={e => setLoyaltyNote(e.target.value)} placeholder="e.g. Birthday bonus" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleLoyaltyAdjust} disabled={!loyaltyAmount || parseInt(loyaltyAmount) <= 0}>
              {loyaltyMode === 'add' ? 'Add' : 'Subtract'} Points
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small inline notes editor
function NotesEditor({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  const [dirty, setDirty] = useState(false);

  function handleChange(v: string) { setValue(v); setDirty(v !== initial); }

  return (
    <div className="space-y-2">
      <Textarea value={value} onChange={e => handleChange(e.target.value)} rows={4} placeholder="Add notes about this customer..." />
      {dirty && (
        <Button size="sm" onClick={() => { onSave(value); setDirty(false); }}>Save Notes</Button>
      )}
    </div>
  );
}

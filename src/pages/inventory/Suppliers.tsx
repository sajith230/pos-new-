import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PermissionButton } from '@/components/auth/PermissionButton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Supplier } from '@/types/database';

type SupplierWithPOCount = Supplier & { po_count?: number };

const emptySupplier = { name: '', contact_person: '', email: '', phone: '', address: '', tax_id: '', payment_terms: 30, notes: '' };

export default function Suppliers() {
  const { business } = useAuth();
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [suppliers, setSuppliers] = useState<SupplierWithPOCount[]>([]);
  const [search, setSearch] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptySupplier);

  useEffect(() => { if (business?.id) fetchSuppliers(); }, [business?.id]);

  async function fetchSuppliers() {
    setLoading(true);
    
    // Fetch suppliers
    const { data: suppliersData } = await supabase
      .from('suppliers')
      .select('*')
      .eq('business_id', business!.id)
      .order('name');
    
    const supps = (suppliersData as Supplier[]) || [];
    
    // Fetch PO counts per supplier
    const { data: poData } = await supabase
      .from('purchase_orders')
      .select('supplier_id')
      .eq('business_id', business!.id);
    
    const poCountMap: Record<string, number> = {};
    (poData || []).forEach((po: any) => {
      poCountMap[po.supplier_id] = (poCountMap[po.supplier_id] || 0) + 1;
    });
    
    const suppsWithCount: SupplierWithPOCount[] = supps.map(s => ({
      ...s,
      po_count: poCountMap[s.id] || 0,
    }));
    
    setSuppliers(suppsWithCount);
    setLoading(false);
  }

  function openCreate() { setEditing(null); setForm(emptySupplier); setDialogOpen(true); }
  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({ name: s.name, contact_person: s.contact_person || '', email: s.email || '', phone: s.phone || '', address: s.address || '', tax_id: s.tax_id || '', payment_terms: s.payment_terms || 30, notes: s.notes || '' });
    setDialogOpen(true);
  }

  async function handleSave() {
    const payload = { ...form, business_id: business!.id, payment_terms: Number(form.payment_terms) };
    let error;
    if (editing) { ({ error } = await supabase.from('suppliers').update(payload).eq('id', editing.id)); }
    else { ({ error } = await supabase.from('suppliers').insert(payload)); }
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: editing ? 'Supplier Updated' : 'Supplier Created' });
    setDialogOpen(false); fetchSuppliers();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('suppliers').update({ is_active: false }).eq('id', id);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: 'Supplier Deactivated' }); fetchSuppliers();
  }

  const filtered = suppliers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
      s.contact_person?.toLowerCase().includes(search.toLowerCase());
    const matchesActive = !showActiveOnly || s.is_active;
    return matchesSearch && matchesActive;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight">Suppliers</h1><p className="text-muted-foreground">Manage your supplier contacts</p></div>
        <PermissionButton permitted={canCreate('inventory.suppliers')} onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Supplier</PermissionButton>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <Input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
            <div className="flex items-center gap-2">
              <Switch id="active-filter" checked={showActiveOnly} onCheckedChange={setShowActiveOnly} />
              <Label htmlFor="active-filter" className="text-sm">Active only</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">POs</TableHead>
              <TableHead>Payment Terms</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No suppliers found</TableCell></TableRow>
              : filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contact_person || '—'}</TableCell>
                  <TableCell>{s.phone || '—'}</TableCell>
                  <TableCell>{s.email || '—'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{s.po_count}</Badge>
                  </TableCell>
                  <TableCell>{s.payment_terms} days</TableCell>
                  <TableCell><Badge variant={s.is_active ? 'secondary' : 'destructive'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <PermissionButton permitted={canEdit('inventory.suppliers')} variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></PermissionButton>
                    <PermissionButton permitted={canDelete('inventory.suppliers')} variant="ghost" size="icon" onClick={() => handleDelete(s.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></PermissionButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tax ID</Label><Input value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} /></div>
              <div><Label>Payment Terms (days)</Label><Input type="number" value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: +e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleSave} disabled={!form.name}>{editing ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

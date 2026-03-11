import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Database, Loader2 } from 'lucide-react';
import PrinterSettings from '@/components/receipt/PrinterSettings';
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';

export default function GeneralSettings() {
  const { business, user, branch } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', legal_name: '', tax_id: '', tax_rate: 0, currency: 'INR', email: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (business) {
      setForm({ name: business.name, legal_name: business.legal_name || '', tax_id: business.tax_id || '', tax_rate: business.tax_rate || 0, currency: business.currency, email: business.email || '', phone: business.phone || '', address: business.address || '' });
    }
  }, [business]);

  async function handleSave() {
    if (!business) {
      setSaving(true);
      const { error } = await supabase.rpc('setup_new_business', {
        _name: form.name,
        _legal_name: form.legal_name || null,
        _tax_id: form.tax_id || null,
        _tax_rate: Number(form.tax_rate),
        _currency: form.currency,
        _email: form.email || null,
        _phone: form.phone || null,
        _address: form.address || null,
      });
      if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); setSaving(false); return; }
      toast({ title: 'Business Created', description: 'Reloading to apply changes...' });
      setSaving(false);
      window.location.reload();
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('businesses').update({ ...form, tax_rate: Number(form.tax_rate) }).eq('id', business.id);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); }
    else { toast({ title: 'Settings Saved' }); }
    setSaving(false);
  }

  async function seedDemoData() {
    if (!business?.id || !branch?.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Business setup required first' });
      return;
    }

    setSeeding(true);
    try {
      // Create categories
      const categories = [
        { name: 'Food', description: 'Food items', business_id: business.id },
        { name: 'Beverages', description: 'Drinks and beverages', business_id: business.id },
        { name: 'Electronics', description: 'Electronic items', business_id: business.id },
        { name: 'Groceries', description: 'Daily essentials', business_id: business.id }
      ];
      const { data: catData, error: catError } = await supabase.from('categories').insert(categories).select();
      if (catError) throw catError;

      const catMap: Record<string, string> = {};
      catData?.forEach(c => { catMap[c.name] = c.id; });

      // Create products
      const products = [
        { name: 'Burger', sku: 'BRG001', price: 150, cost_price: 80, category_id: catMap['Food'], business_id: business.id },
        { name: 'Pizza Margherita', sku: 'PZA001', price: 299, cost_price: 150, category_id: catMap['Food'], business_id: business.id },
        { name: 'French Fries', sku: 'FRY001', price: 99, cost_price: 40, category_id: catMap['Food'], business_id: business.id },
        { name: 'Coke 500ml', sku: 'COK001', price: 45, cost_price: 30, category_id: catMap['Beverages'], business_id: business.id },
        { name: 'Fresh Juice', sku: 'JUS001', price: 80, cost_price: 35, category_id: catMap['Beverages'], business_id: business.id },
        { name: 'Water Bottle', sku: 'WAT001', price: 20, cost_price: 10, category_id: catMap['Beverages'], business_id: business.id },
        { name: 'USB Cable', sku: 'USB001', price: 199, cost_price: 100, category_id: catMap['Electronics'], business_id: business.id },
        { name: 'Phone Charger', sku: 'CHG001', price: 399, cost_price: 200, category_id: catMap['Electronics'], business_id: business.id },
        { name: 'Rice 1kg', sku: 'RIC001', price: 65, cost_price: 50, category_id: catMap['Groceries'], business_id: business.id },
        { name: 'Cooking Oil 1L', sku: 'OIL001', price: 180, cost_price: 140, category_id: catMap['Groceries'], business_id: business.id }
      ];
      const { data: prodData, error: prodError } = await supabase.from('products').insert(products).select();
      if (prodError) throw prodError;

      // Create inventory for products
      const inventory = prodData?.map(p => ({
        product_id: p.id,
        branch_id: branch.id,
        quantity: Math.floor(Math.random() * 100) + 10
      })) || [];
      const { error: invError } = await supabase.from('inventory').insert(inventory);
      if (invError) throw invError;

      // Create tables for restaurant
      const tables = [
        { name: 'Table 1', capacity: 4, branch_id: branch.id, position_x: 0, position_y: 0 },
        { name: 'Table 2', capacity: 4, branch_id: branch.id, position_x: 1, position_y: 0 },
        { name: 'Table 3', capacity: 2, branch_id: branch.id, position_x: 2, position_y: 0 },
        { name: 'Table 4', capacity: 6, branch_id: branch.id, position_x: 0, position_y: 1 },
        { name: 'Table 5', capacity: 8, branch_id: branch.id, position_x: 1, position_y: 1 },
        { name: 'Table 6', capacity: 4, branch_id: branch.id, position_x: 2, position_y: 1 }
      ];
      const { error: tableError } = await supabase.from('tables').insert(tables);
      if (tableError) throw tableError;

      // Create sample customers
      const customers = [
        { name: 'John Doe', email: 'john@example.com', phone: '+91 98765 43210', business_id: business.id },
        { name: 'Jane Smith', email: 'jane@example.com', phone: '+91 98765 43211', business_id: business.id },
        { name: 'Bob Wilson', email: 'bob@example.com', phone: '+91 98765 43212', business_id: business.id }
      ];
      const { error: custError } = await supabase.from('customers').insert(customers);
      if (custError) throw custError;

      // Create sample supplier
      const suppliers = [
        { name: 'ABC Distributors', contact_person: 'Rahul Kumar', email: 'abc@suppliers.com', phone: '+91 99887 76655', business_id: business.id },
        { name: 'XYZ Wholesale', contact_person: 'Priya Sharma', email: 'xyz@suppliers.com', phone: '+91 99887 76656', business_id: business.id }
      ];
      const { error: suppError } = await supabase.from('suppliers').insert(suppliers);
      if (suppError) throw suppError;

      toast({
        title: 'Demo Data Created!',
        description: '4 categories, 10 products, 6 tables, 3 customers, and 2 suppliers added.'
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message
      });
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">General Settings</h1><p className="text-muted-foreground">Configure your business details</p></div>
      
      <Card>
        <CardHeader><CardTitle>Business Information</CardTitle><CardDescription>Update your business profile and tax settings</CardDescription></CardHeader>
        <CardContent>
          <div className="grid gap-4 max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Business Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Legal Name</Label><Input value={form.legal_name} onChange={e => setForm({ ...form, legal_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Tax ID</Label><Input value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} /></div>
              <div><Label>Tax Rate (%)</Label><Input type="number" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: +e.target.value })} /></div>
              <div><Label>Currency</Label><Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <Button onClick={handleSave} disabled={saving || !form.name} className="w-fit">{saving ? 'Saving...' : business ? 'Save Changes' : 'Create Business'}</Button>
          </div>
        </CardContent>
      </Card>

      {business && <PrinterSettings />}
      
      <NotificationPreferences />

      {business && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Demo Data
            </CardTitle>
            <CardDescription>
              Seed sample data for testing the system. This will create categories, products, tables, customers, and suppliers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={seedDemoData} disabled={seeding} variant="outline">
              {seeding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating demo data...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Seed Demo Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

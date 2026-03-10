import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2 } from 'lucide-react';

interface BusinessSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BusinessSetup({ open, onOpenChange }: BusinessSetupProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    legal_name: '',
    tax_id: '',
    tax_rate: 18,
    currency: 'INR',
    email: '',
    phone: '',
    address: ''
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !user?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc('setup_new_business', {
        _name: form.name,
        _legal_name: form.legal_name || null,
        _tax_id: form.tax_id || null,
        _tax_rate: Number(form.tax_rate),
        _currency: form.currency,
        _email: form.email || null,
        _phone: form.phone || null,
        _address: form.address || null
      });

      if (error) throw error;

      toast({
        title: 'Business Created!',
        description: 'Your business has been set up successfully. Refreshing...'
      });

      // Refresh the page to load new business data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Setup Failed',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Set Up Your Business</DialogTitle>
          <DialogDescription className="text-center">
            Let's get your business up and running. Fill in the details below to start using the POS system.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Business Name *</Label>
              <Input
                id="name"
                placeholder="My Awesome Store"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal_name">Legal Name</Label>
              <Input
                id="legal_name"
                placeholder="Optional"
                value={form.legal_name}
                onChange={e => setForm({ ...form, legal_name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tax_id">Tax ID / GST</Label>
              <Input
                id="tax_id"
                placeholder="GSTIN"
                value={form.tax_id}
                onChange={e => setForm({ ...form, tax_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_rate">Tax Rate %</Label>
              <Input
                id="tax_rate"
                type="number"
                value={form.tax_rate}
                onChange={e => setForm({ ...form, tax_rate: +e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={form.currency}
                onChange={e => setForm({ ...form, currency: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@business.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="123 Main Street, City"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="submit" disabled={loading || !form.name.trim()} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Create Business & Get Started'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

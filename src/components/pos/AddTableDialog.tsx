import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface AddTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  onTableAdded: () => void;
}

export default function AddTableDialog({ open, onOpenChange, branchId, onTableAdded }: AddTableDialogProps) {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('tables').insert({
        branch_id: branchId,
        name: name.trim(),
        capacity: parseInt(capacity) || 4,
        status: 'available' as const,
      });

      if (error) throw error;

      toast({ title: 'Table added', description: `${name.trim()} created successfully.` });
      setName('');
      setCapacity('4');
      onOpenChange(false);
      onTableAdded();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add New Table</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="table-name">Table Name</Label>
            <Input
              id="table-name"
              placeholder="e.g. Table 1, Patio A"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="table-capacity">Capacity</Label>
            <Input
              id="table-capacity"
              type="number"
              min="1"
              max="50"
              value={capacity}
              onChange={e => setCapacity(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Add Table
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

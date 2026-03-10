import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface LowStockItem {
  product_id: string;
  product_name: string;
  quantity: number;
  min_stock: number;
}

export function LowStockAlert() {
  const { branch } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<LowStockItem[]>([]);

  async function fetchLowStock() {
    if (!branch?.id) return;
    const { data } = await supabase.rpc('check_low_stock', { _branch_id: branch.id });
    setItems((data as LowStockItem[]) || []);
  }

  useEffect(() => {
    fetchLowStock();
  }, [branch?.id]);

  // Realtime: re-check when inventory changes
  useEffect(() => {
    if (!branch?.id) return;
    const channel = supabase
      .channel('low-stock-alert')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchLowStock();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [branch?.id]);

  if (items.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
            {items.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Low Stock Alerts</h4>
            <Badge variant="destructive" className="text-xs">{items.length} items</Badge>
          </div>
          <ScrollArea className="max-h-60">
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Min: {item.min_stock} | Current: {item.quantity}
                    </p>
                  </div>
                  <Badge variant={item.quantity <= 0 ? 'destructive' : 'secondary'} className="text-xs">
                    {item.quantity <= 0 ? 'Out' : 'Low'}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
          <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/inventory')}>
            View Stock Overview
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

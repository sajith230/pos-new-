import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/formatCurrency';
import { Clock, Play, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActiveOrder {
  id: string;
  order_number: string;
  status: string;
  notes: string | null;
  created_at: string;
  order_items: { quantity: number; unit_price: number }[];
}

interface ActiveOrdersListProps {
  businessId: string;
  branchId: string;
  orderType: 'takeaway' | 'delivery';
  onResumeOrder: (orderId: string) => void;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  preparing: 'secondary',
  ready: 'default',
  served: 'default',
};

export default function ActiveOrdersList({ businessId, branchId, orderType, onResumeOrder }: ActiveOrdersListProps) {
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { format: fc } = useCurrency();

  async function fetchActiveOrders() {
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, notes, created_at, order_items(quantity, unit_price)')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .eq('order_type', orderType)
      .in('status', ['pending', 'preparing', 'ready', 'served'])
      .order('created_at', { ascending: false });

    setOrders((data as ActiveOrder[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchActiveOrders();

    const channel = supabase
      .channel(`active-orders-${orderType}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `branch_id=eq.${branchId}`,
      }, () => {
        fetchActiveOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [businessId, branchId, orderType]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No active {orderType === 'takeaway' ? 'takeaway' : 'delivery'} orders</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 pr-2">
        {orders.map(order => {
          const itemCount = order.order_items.reduce((s, i) => s + i.quantity, 0);
          const orderTotal = order.order_items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

          return (
            <Card key={order.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">#{order.order_number.slice(-6)}</span>
                    <Badge variant={STATUS_COLORS[order.status || 'pending']} className="text-[10px] px-1.5 py-0">
                      {order.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                    </span>
                    <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                    <span className="font-medium text-foreground">{fc(orderTotal)}</span>
                  </div>
                  {order.notes && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{order.notes}</p>
                  )}
                </div>
                <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => onResumeOrder(order.id)}>
                  <Play className="h-3 w-3" />
                  Resume
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}

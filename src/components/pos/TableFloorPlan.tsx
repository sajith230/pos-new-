import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Table as TableType, TableStatus, Order } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/lib/formatCurrency';
import {
  Users, Plus, Clock, MoreVertical, CheckCircle, Sparkles, CalendarClock, UtensilsCrossed, Filter
} from 'lucide-react';
import AddTableDialog from './AddTableDialog';

interface TableFloorPlanProps {
  tables: TableType[];
  branchId: string;
  businessId: string;
  onTableSelect: (table: TableType) => void;
  onTablesChange: () => void;
}

const statusConfig: Record<TableStatus, { label: string; icon: React.ReactNode; cssClass: string }> = {
  available: { label: 'Available', icon: <CheckCircle className="h-3.5 w-3.5" />, cssClass: 'table-status-available' },
  occupied: { label: 'Occupied', icon: <UtensilsCrossed className="h-3.5 w-3.5" />, cssClass: 'table-status-occupied' },
  reserved: { label: 'Reserved', icon: <CalendarClock className="h-3.5 w-3.5" />, cssClass: 'table-status-reserved' },
  cleaning: { label: 'Cleaning', icon: <Sparkles className="h-3.5 w-3.5" />, cssClass: 'table-status-cleaning' },
};

function formatElapsed(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export default function TableFloorPlan({ tables, branchId, businessId, onTableSelect, onTablesChange }: TableFloorPlanProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Record<string, Order>>({});
  const [statusFilter, setStatusFilter] = useState<TableStatus | 'all'>('all');
  const { toast } = useToast();
  const { format: fc } = useCurrency();

  // Fetch active orders for occupied tables
  useEffect(() => {
    async function fetchActiveOrders() {
      const occupiedIds = tables.filter(t => t.status === 'occupied').map(t => t.id);
      if (occupiedIds.length === 0) { setActiveOrders({}); return; }

      const { data } = await supabase
        .from('orders')
        .select('*, order_items:order_items(id, quantity, unit_price)')
        .in('table_id', occupiedIds)
        .in('status', ['pending', 'preparing', 'ready', 'served'])
        .order('created_at', { ascending: false });

      if (data) {
        const map: Record<string, Order> = {};
        for (const order of data) {
          if (order.table_id && !map[order.table_id]) {
            map[order.table_id] = order as Order;
          }
        }
        setActiveOrders(map);
      }
    }
    fetchActiveOrders();
  }, [tables]);

  // Elapsed time ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  async function changeTableStatus(tableId: string, newStatus: TableStatus) {
    const { error } = await supabase.from('tables').update({ status: newStatus }).eq('id', tableId);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      onTablesChange();
    }
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { available: 0, occupied: 0, reserved: 0, cleaning: 0 };
    tables.forEach(t => { counts[(t.status as string) || 'available']++; });
    return counts;
  }, [tables]);

  const filteredTables = statusFilter === 'all' ? tables : tables.filter(t => (t.status || 'available') === statusFilter);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.entries(statusConfig) as [TableStatus, typeof statusConfig[TableStatus]][]).map(([status, cfg]) => (
            <Badge
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              className="cursor-pointer gap-1.5 px-3 py-1.5 text-xs"
              onClick={() => setStatusFilter(prev => prev === status ? 'all' : status)}
            >
              {cfg.icon}
              {statusCounts[status]} {cfg.label}
            </Badge>
          ))}
          {statusFilter !== 'all' && (
            <Badge variant="secondary" className="cursor-pointer gap-1 px-3 py-1.5 text-xs" onClick={() => setStatusFilter('all')}>
              <Filter className="h-3 w-3" /> Show All
            </Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Table
        </Button>
      </div>

      {/* Table grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredTables.map(table => {
            const status = (table.status as TableStatus) || 'available';
            const cfg = statusConfig[status];
            const order = activeOrders[table.id];
            const orderTotal = order?.items
              ? (order.items as any[]).reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
              : null;
            const hasReadyItems = order?.status === 'ready';

            return (
              <Card
                key={table.id}
                className={`cursor-pointer transition-all hover:scale-[1.03] hover:shadow-md border-2 relative group ${cfg.cssClass} ${
                  hasReadyItems ? 'animate-pulse' : ''
                }`}
                onClick={() => onTableSelect(table)}
              >
                {/* Context menu */}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {status !== 'available' && (
                        <DropdownMenuItem onClick={() => changeTableStatus(table.id, 'available')}>
                          <CheckCircle className="h-3.5 w-3.5 mr-2" /> Mark Available
                        </DropdownMenuItem>
                      )}
                      {status !== 'reserved' && status !== 'occupied' && (
                        <DropdownMenuItem onClick={() => changeTableStatus(table.id, 'reserved')}>
                          <CalendarClock className="h-3.5 w-3.5 mr-2" /> Mark Reserved
                        </DropdownMenuItem>
                      )}
                      {status !== 'cleaning' && (
                        <DropdownMenuItem onClick={() => changeTableStatus(table.id, 'cleaning')}>
                          <Sparkles className="h-3.5 w-3.5 mr-2" /> Mark Cleaning
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <CardContent className="p-4 flex flex-col items-center gap-2 min-h-[100px] justify-center">
                  <p className="font-bold text-sm">{table.name}</p>
                  <div className="flex items-center gap-1 text-xs opacity-80">
                    <Users className="h-3 w-3" />
                    <span>{table.capacity || 4}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 gap-1">
                    {cfg.icon} {cfg.label}
                  </Badge>
                  {/* Occupied details */}
                  {status === 'occupied' && order && (
                    <div className="flex flex-col items-center gap-0.5 mt-1">
                      {orderTotal != null && (
                        <span className="text-xs font-semibold">{fc(orderTotal)}</span>
                      )}
                      <div className="flex items-center gap-1 text-[10px] opacity-70">
                        <Clock className="h-2.5 w-2.5" />
                        <span>{formatElapsed(order.created_at)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredTables.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <UtensilsCrossed className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">
              {tables.length === 0 ? 'No tables configured yet' : 'No tables match this filter'}
            </p>
            {tables.length === 0 && (
              <p className="text-sm mt-1">Click "Add Table" to get started.</p>
            )}
          </div>
        )}
      </ScrollArea>

      <AddTableDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        branchId={branchId}
        onTableAdded={onTablesChange}
      />
    </div>
  );
}

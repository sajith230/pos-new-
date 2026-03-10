import { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, ShoppingCart, TrendingUp, Download, CalendarIcon, Clock, Star,
  Package, AlertTriangle, ArrowUpDown, Warehouse,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/lib/formatCurrency';
import { format, startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--info))',
  'hsl(215, 16%, 47%)',
];

type Preset = 'today' | '7d' | '30d' | 'month' | 'custom';

interface TopProduct {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
}

interface CategoryData {
  name: string;
  value: number;
}

interface HourlyData {
  hour: string;
  count: number;
  revenue: number;
}

interface InventoryItem {
  productId: string;
  name: string;
  quantity: number;
  costPrice: number;
  sellPrice: number;
  minStock: number;
  stockValue: number;
  retailValue: number;
}

interface StockMovement {
  id: string;
  productName: string;
  movementType: string;
  quantity: number;
  createdAt: string;
  notes: string | null;
}

interface ProfitProduct {
  productId: string;
  name: string;
  costPrice: number;
  sellPrice: number;
  marginPercent: number;
  unitsSold: number;
  totalProfit: number;
}

export default function Reports() {
  const { business, profile } = useAuth();
  const { format: fc } = useCurrency();
  const { canExport } = usePermissions();
  const [activeTab, setActiveTab] = useState('sales');
  const [preset, setPreset] = useState<Preset>('30d');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Sales data states
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionItems, setTransactionItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Inventory data states
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const fromISO = dateRange?.from ? startOfDay(dateRange.from).toISOString() : '';
  const toISO = dateRange?.to ? endOfDay(dateRange.to).toISOString() : '';

  function applyPreset(p: Preset) {
    setPreset(p);
    const now = new Date();
    switch (p) {
      case 'today':
        setDateRange({ from: now, to: now });
        break;
      case '7d':
        setDateRange({ from: subDays(now, 7), to: now });
        break;
      case '30d':
        setDateRange({ from: subDays(now, 30), to: now });
        break;
      case 'month':
        setDateRange({ from: startOfMonth(now), to: now });
        break;
    }
  }

  useEffect(() => {
    if (business?.id && fromISO && toISO) {
      fetchSalesData();
      if (activeTab === 'inventory') fetchInventoryData();
    }
  }, [business?.id, fromISO, toISO]);

  useEffect(() => {
    if (activeTab === 'inventory' && business?.id && inventoryData.length === 0 && !inventoryLoading) {
      fetchInventoryData();
    }
  }, [activeTab, business?.id]);

  async function fetchSalesData() {
    setLoading(true);
    const bId = business!.id;

    const [txRes, , , prodRes, catRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, created_at, total_amount, subtotal, tax_amount, discount_amount, transaction_number, status')
        .eq('business_id', bId)
        .eq('status', 'completed')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: false }),
      supabase.from('transaction_items').select('transaction_id').in('transaction_id', []),
      supabase.from('payments').select('transaction_id').in('transaction_id', []),
      supabase.from('products').select('id, name, category_id, cost_price, price').eq('business_id', bId),
      supabase.from('categories').select('id, name').eq('business_id', bId),
    ]);

    const txData = txRes.data || [];
    setTransactions(txData);
    setProducts(prodRes.data || []);
    setCategories(catRes.data || []);

    const txIds = txData.map((t) => t.id);
    if (txIds.length > 0) {
      const [tiRes, payRes] = await Promise.all([
        supabase.from('transaction_items').select('transaction_id, product_id, quantity, unit_price, total_price').in('transaction_id', txIds),
        supabase.from('payments').select('transaction_id, payment_method, amount').in('transaction_id', txIds),
      ]);
      setTransactionItems(tiRes.data || []);
      setPayments(payRes.data || []);
    } else {
      setTransactionItems([]);
      setPayments([]);
    }
    setLoading(false);
  }

  async function fetchInventoryData() {
    if (!profile?.branch_id || !business?.id) return;
    setInventoryLoading(true);

    const [invRes, movRes] = await Promise.all([
      supabase
        .from('inventory')
        .select('product_id, quantity')
        .eq('branch_id', profile.branch_id),
      supabase
        .from('stock_movements')
        .select('id, product_id, movement_type, quantity, created_at, notes')
        .eq('branch_id', profile.branch_id)
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    const prods = products.length > 0 ? products : (await supabase.from('products').select('id, name, cost_price, price, min_stock').eq('business_id', business!.id)).data || [];
    if (products.length === 0) setProducts(prods);

    const prodMap = new Map(prods.map((p: any) => [p.id, p]));

    const invItems: InventoryItem[] = (invRes.data || []).map((inv: any) => {
      const prod = prodMap.get(inv.product_id) as any;
      const qty = Number(inv.quantity);
      const cost = Number(prod?.cost_price || 0);
      const sell = Number(prod?.price || 0);
      return {
        productId: inv.product_id,
        name: prod?.name || 'Unknown',
        quantity: qty,
        costPrice: cost,
        sellPrice: sell,
        minStock: Number(prod?.min_stock || 0),
        stockValue: qty * cost,
        retailValue: qty * sell,
      };
    });
    setInventoryData(invItems);

    const movItems: StockMovement[] = (movRes.data || []).map((m: any) => {
      const prod = prodMap.get(m.product_id) as any;
      return {
        id: m.id,
        productName: prod?.name || 'Unknown',
        movementType: m.movement_type,
        quantity: Number(m.quantity),
        createdAt: m.created_at,
        notes: m.notes,
      };
    });
    setStockMovements(movItems);
    setInventoryLoading(false);
  }

  // ===== Sales computed =====
  const stats = useMemo(() => {
    const total = transactions.reduce((s, t) => s + t.total_amount, 0);
    const count = transactions.length;
    return { totalSales: total, totalTransactions: count, avgOrderValue: count ? total / count : 0 };
  }, [transactions]);

  const topProducts = useMemo((): TopProduct[] => {
    const map = new Map<string, { qty: number; revenue: number }>();
    transactionItems.forEach((ti) => {
      const existing = map.get(ti.product_id) || { qty: 0, revenue: 0 };
      existing.qty += Number(ti.quantity);
      existing.revenue += Number(ti.total_price);
      map.set(ti.product_id, existing);
    });
    return Array.from(map.entries())
      .map(([productId, { qty, revenue }]) => {
        const prod = products.find((p) => p.id === productId);
        return { productId, name: prod?.name || 'Unknown', qty, revenue };
      })
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [transactionItems, products]);

  const topProductName = topProducts.length > 0 ? topProducts[0].name : '—';

  const paymentBreakdown = useMemo(() => {
    const grouped: Record<string, number> = {};
    payments.forEach((p) => { grouped[p.payment_method] = (grouped[p.payment_method] || 0) + Number(p.amount); });
    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [payments]);

  const dailySales = useMemo(() => {
    const grouped: Record<string, number> = {};
    transactions.forEach((t) => { const d = t.created_at.split('T')[0]; grouped[d] = (grouped[d] || 0) + t.total_amount; });
    return Object.entries(grouped).sort().map(([date, total]) => ({ date: date.slice(5), total }));
  }, [transactions]);

  const categoryBreakdown = useMemo((): CategoryData[] => {
    const map = new Map<string, number>();
    transactionItems.forEach((ti) => {
      const prod = products.find((p) => p.id === ti.product_id);
      const catId = prod?.category_id || 'uncategorized';
      map.set(catId, (map.get(catId) || 0) + Number(ti.total_price));
    });
    return Array.from(map.entries()).map(([catId, value]) => {
      const cat = categories.find((c) => c.id === catId);
      return { name: cat?.name || 'Uncategorized', value };
    }).sort((a, b) => b.value - a.value);
  }, [transactionItems, products, categories]);

  const hourlySales = useMemo((): HourlyData[] => {
    const hours: Record<number, { count: number; revenue: number }> = {};
    transactions.forEach((t) => {
      const h = new Date(t.created_at).getHours();
      if (!hours[h]) hours[h] = { count: 0, revenue: 0 };
      hours[h].count++;
      hours[h].revenue += t.total_amount;
    });
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      count: hours[i]?.count || 0,
      revenue: hours[i]?.revenue || 0,
    })).filter((h) => h.count > 0 || (h.hour >= '06:00' && h.hour <= '23:00'));
  }, [transactions]);

  // ===== Inventory computed =====
  const inventoryStats = useMemo(() => {
    const totalStockValue = inventoryData.reduce((s, i) => s + i.stockValue, 0);
    const totalRetailValue = inventoryData.reduce((s, i) => s + i.retailValue, 0);
    const potentialProfit = totalRetailValue - totalStockValue;
    const lowStockCount = inventoryData.filter((i) => i.minStock > 0 && i.quantity <= i.minStock).length;
    return { totalStockValue, totalRetailValue, potentialProfit, lowStockCount };
  }, [inventoryData]);

  const lowStockItems = useMemo(() => {
    return inventoryData
      .filter((i) => i.minStock > 0)
      .map((i) => ({
        ...i,
        status: i.quantity === 0 ? 'out' : i.quantity <= i.minStock * 0.5 ? 'critical' : i.quantity <= i.minStock ? 'low' : 'ok',
      }))
      .filter((i) => i.status !== 'ok')
      .sort((a, b) => (a.quantity / Math.max(a.minStock, 1)) - (b.quantity / Math.max(b.minStock, 1)));
  }, [inventoryData]);

  const profitProducts = useMemo((): ProfitProduct[] => {
    const soldMap = new Map<string, number>();
    transactionItems.forEach((ti) => {
      soldMap.set(ti.product_id, (soldMap.get(ti.product_id) || 0) + Number(ti.quantity));
    });

    return products
      .filter((p) => p.cost_price != null && p.price > 0)
      .map((p) => {
        const cost = Number(p.cost_price || 0);
        const sell = Number(p.price);
        const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
        const unitsSold = soldMap.get(p.id) || 0;
        return {
          productId: p.id,
          name: p.name,
          costPrice: cost,
          sellPrice: sell,
          marginPercent: margin,
          unitsSold,
          totalProfit: unitsSold * (sell - cost),
        };
      })
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 20);
  }, [products, transactionItems]);

  const topProfitChartData = useMemo(() => {
    return profitProducts.slice(0, 10).map((p) => ({
      name: p.name.length > 15 ? p.name.slice(0, 15) + '…' : p.name,
      margin: Math.round(p.marginPercent),
      profit: Math.round(p.totalProfit),
    }));
  }, [profitProducts]);

  // ===== CSV Exports =====
  function exportSalesCSV() {
    const headers = ['Date', 'Transaction #', 'Items', 'Total Amount', 'Payment Method'];
    const txPayments = new Map<string, string>();
    payments.forEach((p) => txPayments.set(p.transaction_id, p.payment_method));
    const txItemCounts = new Map<string, number>();
    transactionItems.forEach((ti) => txItemCounts.set(ti.transaction_id, (txItemCounts.get(ti.transaction_id) || 0) + Number(ti.quantity)));

    const rows = transactions.map((t) => [
      format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
      t.transaction_number,
      txItemCounts.get(t.id) || 0,
      t.total_amount.toFixed(2),
      txPayments.get(t.id) || '—',
    ]);

    downloadCSV([headers, ...rows], `sales-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  }

  function exportInventoryCSV() {
    const headers = ['Product', 'Quantity', 'Cost Price', 'Sell Price', 'Stock Value', 'Retail Value', 'Min Stock', 'Status'];
    const rows = inventoryData.map((i) => {
      const status = i.quantity === 0 ? 'Out of Stock' : i.minStock > 0 && i.quantity <= i.minStock ? 'Low Stock' : 'OK';
      return [i.name, i.quantity, i.costPrice.toFixed(2), i.sellPrice.toFixed(2), i.stockValue.toFixed(2), i.retailValue.toFixed(2), i.minStock, status];
    });
    downloadCSV([headers, ...rows], `inventory-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  }

  function downloadCSV(data: any[][], filename: string) {
    const csv = data.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const rangeLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'MMM d')} – ${format(dateRange.to, 'MMM d, yyyy')}`
    : 'Select dates';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">Business performance insights</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['today', '7d', '30d', 'month'] as Preset[]).map((p) => (
            <Button key={p} variant={preset === p ? 'default' : 'outline'} size="sm" onClick={() => applyPreset(p)}>
              {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : 'This Month'}
            </Button>
          ))}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant={preset === 'custom' ? 'default' : 'outline'} size="sm">
                <CalendarIcon className="mr-1 h-4 w-4" />
                {preset === 'custom' ? rangeLabel : 'Custom'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range);
                  if (range?.from && range?.to) { setPreset('custom'); setCalendarOpen(false); }
                }}
                numberOfMonths={2}
                disabled={(date) => date > new Date()}
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
          {canExport('reports') && (
            <Button
              variant="outline"
              size="sm"
              onClick={activeTab === 'sales' ? exportSalesCSV : exportInventoryCSV}
              disabled={activeTab === 'sales' ? transactions.length === 0 : inventoryData.length === 0}
            >
              <Download className="mr-1 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sales" className="gap-1.5">
            <DollarSign className="h-4 w-4" /> Sales
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1.5">
            <Package className="h-4 w-4" /> Inventory
          </TabsTrigger>
        </TabsList>

        {/* ===== SALES TAB ===== */}
        <TabsContent value="sales" className="space-y-6 mt-4">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fc(stats.totalSales)}</div>
                <p className="text-xs text-muted-foreground mt-1">{rangeLabel}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
                <ShoppingCart className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTransactions}</div>
                <p className="text-xs text-muted-foreground mt-1">Completed orders</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order Value</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fc(stats.avgOrderValue)}</div>
                <p className="text-xs text-muted-foreground mt-1">Per transaction</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Top Product</CardTitle>
                <Star className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold truncate">{topProductName}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {topProducts.length > 0 ? `${topProducts[0].qty} sold` : 'No data'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Sales + Payment Methods */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Daily Sales</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                {dailySales.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailySales}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(val: number) => [fc(val), 'Revenue']} />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    {loading ? 'Loading...' : 'No sales data for this period'}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                {paymentBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {paymentBreakdown.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(val: number) => [fc(val), 'Amount']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    {loading ? 'Loading...' : 'No payment data for this period'}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Products + Category Breakdown */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Top Selling Products</CardTitle></CardHeader>
              <CardContent>
                {topProducts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty Sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((p, i) => (
                        <TableRow key={p.productId}>
                          <TableCell className="font-medium">{i + 1}</TableCell>
                          <TableCell>{p.name}</TableCell>
                          <TableCell className="text-right">{p.qty}</TableCell>
                          <TableCell className="text-right">{fc(p.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    {loading ? 'Loading...' : 'No product data for this period'}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Category Breakdown</CardTitle></CardHeader>
              <CardContent className="h-[350px]">
                {categoryBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {categoryBreakdown.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(val: number) => [fc(val), 'Revenue']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    {loading ? 'Loading...' : 'No category data for this period'}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Hourly Sales Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" /> Hourly Sales Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {hourlySales.some((h) => h.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlySales}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="hour" fontSize={11} />
                    <YAxis yAxisId="left" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(val: number, name: string) => name === 'revenue' ? [fc(val), 'Revenue'] : [val, 'Orders']} />
                    <Bar yAxisId="left" dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Orders" />
                    <Bar yAxisId="right" dataKey="revenue" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Revenue" opacity={0.6} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {loading ? 'Loading...' : 'No hourly data for this period'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== INVENTORY TAB ===== */}
        <TabsContent value="inventory" className="space-y-6 mt-4">
          {/* Stock Valuation KPIs */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Stock Value (Cost)</CardTitle>
                <Warehouse className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fc(inventoryStats.totalStockValue)}</div>
                <p className="text-xs text-muted-foreground mt-1">At cost price</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Retail Value</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fc(inventoryStats.totalRetailValue)}</div>
                <p className="text-xs text-muted-foreground mt-1">At sell price</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Potential Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{fc(inventoryStats.potentialProfit)}</div>
                <p className="text-xs text-muted-foreground mt-1">If all stock sold</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{inventoryStats.lowStockCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Items below minimum</p>
              </CardContent>
            </Card>
          </div>

          {/* Profit Margin Chart + Low Stock Alerts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Profit Margin by Product</CardTitle></CardHeader>
              <CardContent className="h-[350px]">
                {topProfitChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProfitChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" fontSize={12} />
                      <YAxis dataKey="name" type="category" width={120} fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(val: number, name: string) => name === 'profit' ? [fc(val), 'Profit'] : [`${val}%`, 'Margin']} />
                      <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="profit" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    {inventoryLoading ? 'Loading...' : 'No profit data available'}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" /> Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lowStockItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">Min Stock</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowStockItems.slice(0, 10).map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{item.minStock}</TableCell>
                          <TableCell>
                            <Badge variant={item.status === 'out' ? 'destructive' : item.status === 'critical' ? 'destructive' : 'secondary'}>
                              {item.status === 'out' ? 'Out of Stock' : item.status === 'critical' ? 'Critical' : 'Low'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    {inventoryLoading ? 'Loading...' : 'All items well-stocked 👍'}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Profit Margin Analysis Table */}
          <Card>
            <CardHeader><CardTitle>Profit Margin Analysis</CardTitle></CardHeader>
            <CardContent>
              {profitProducts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Cost Price</TableHead>
                      <TableHead className="text-right">Sell Price</TableHead>
                      <TableHead className="text-right">Margin %</TableHead>
                      <TableHead className="text-right">Units Sold</TableHead>
                      <TableHead className="text-right">Total Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profitProducts.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">{fc(p.costPrice)}</TableCell>
                        <TableCell className="text-right">{fc(p.sellPrice)}</TableCell>
                        <TableCell className="text-right">
                          <span className={cn(p.marginPercent >= 50 ? 'text-success' : p.marginPercent >= 20 ? 'text-warning' : 'text-destructive')}>
                            {p.marginPercent.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{p.unitsSold}</TableCell>
                        <TableCell className="text-right font-medium">{fc(p.totalProfit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  {inventoryLoading ? 'Loading...' : 'No product data available'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stock Movement History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" /> Stock Movement History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stockMovements.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockMovements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-muted-foreground">{format(new Date(m.createdAt), 'MMM d, HH:mm')}</TableCell>
                        <TableCell className="font-medium">{m.productName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.movementType}</Badge>
                        </TableCell>
                        <TableCell className={cn('text-right font-medium', m.quantity > 0 ? 'text-success' : 'text-destructive')}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[200px]">{m.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  {inventoryLoading ? 'Loading...' : 'No stock movements in this period'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

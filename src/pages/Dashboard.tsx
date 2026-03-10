import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

import { supabase } from '@/integrations/supabase/client';
import BusinessSetup from '@/components/onboarding/BusinessSetup';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
}

function StatCard({ title, value, change, icon, trend, loading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{loading ? '...' : value}</div>
        {change !== undefined && (
          <div className="flex items-center text-xs mt-1">
            {trend === 'up' ? (
              <>
                <ArrowUpRight className="h-3 w-3 text-primary mr-1" />
                <span className="text-primary">+{change}%</span>
              </>
            ) : trend === 'down' ? (
              <>
                <ArrowDownRight className="h-3 w-3 text-destructive mr-1" />
                <span className="text-destructive">-{change}%</span>
              </>
            ) : (
              <span className="text-muted-foreground">{change}%</span>
            )}
            <span className="text-muted-foreground ml-1">from last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SalesTrendPoint {
  date: string;
  label: string;
  sales: number;
}

interface LowStockItem {
  productName: string;
  quantity: number;
  minStock: number;
}

interface RecentTransaction {
  id: string;
  transaction_number: string;
  total_amount: number;
  created_at: string;
  status: string | null;
  paymentMethod: string | null;
}

interface ActiveShift {
  id: string;
  started_at: string;
  total_sales: number;
  total_transactions: number;
  opening_cash: number;
}

interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  lowStockItems: number;
  totalCustomers: number;
  recentTransactions: RecentTransaction[];
  salesTrend: SalesTrendPoint[];
  lowStockList: LowStockItem[];
  activeShift: ActiveShift | null;
}

const paymentIcons: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-3 w-3" />,
  card: <CreditCard className="h-3 w-3" />,
  upi: <Smartphone className="h-3 w-3" />,
  wallet: <Wallet className="h-3 w-3" />,
};

export default function Dashboard() {
  const { profile, business, branch, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayOrders: 0,
    lowStockItems: 0,
    totalCustomers: 0,
    recentTransactions: [],
    salesTrend: [],
    lowStockList: [],
    activeShift: null,
  });
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!business?.id) return;
    setLoading(true);

    const today = startOfDay(new Date());
    const todayISO = today.toISOString();
    const sevenDaysAgo = subDays(today, 6).toISOString();

    // Parallel fetches
    const [txnsRes, customerRes, trendRes, recentRes, shiftRes] = await Promise.all([
      // Today's transactions
      supabase
        .from('transactions')
        .select('id, total_amount, transaction_number, created_at')
        .eq('business_id', business.id)
        .gte('created_at', todayISO),
      // Customer count
      supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id),
      // 7-day trend
      supabase
        .from('transactions')
        .select('total_amount, created_at')
        .eq('business_id', business.id)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: true }),
      // Recent transactions with status
      supabase
        .from('transactions')
        .select('id, transaction_number, total_amount, created_at, status')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(5),
      // Active shift
      user
        ? supabase
            .from('shifts')
            .select('id, started_at, total_sales, total_transactions, opening_cash')
            .eq('user_id', user.id)
            .eq('status', 'open')
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const txns = txnsRes.data || [];
    const todaySales = txns.reduce((sum, t) => sum + Number(t.total_amount), 0);

    // Build 7-day trend
    const trendMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      trendMap.set(format(d, 'yyyy-MM-dd'), 0);
    }
    (trendRes.data || []).forEach((t) => {
      const key = format(new Date(t.created_at), 'yyyy-MM-dd');
      trendMap.set(key, (trendMap.get(key) || 0) + Number(t.total_amount));
    });
    const salesTrend: SalesTrendPoint[] = Array.from(trendMap.entries()).map(([date, sales]) => ({
      date,
      label: format(new Date(date), 'EEE'),
      sales,
    }));

    // Low stock
    let lowStockCount = 0;
    let lowStockList: LowStockItem[] = [];
    if (branch?.id) {
      const { data: invData } = await supabase
        .from('inventory')
        .select('quantity, products!inner(name, min_stock, business_id)')
        .eq('branch_id', branch.id);

      const lowItems = (invData || [])
        .filter((inv: any) => Number(inv.quantity) <= Number(inv.products?.min_stock || 0))
        .map((inv: any) => ({
          productName: inv.products?.name || 'Unknown',
          quantity: Number(inv.quantity),
          minStock: Number(inv.products?.min_stock || 0),
        }))
        .sort((a: LowStockItem, b: LowStockItem) => a.quantity - b.quantity);

      lowStockCount = lowItems.length;
      lowStockList = lowItems.slice(0, 5);
    }

    // Payment methods for recent transactions
    const recentTxns = recentRes.data || [];
    let enrichedTxns: RecentTransaction[] = recentTxns.map((t) => ({
      ...t,
      paymentMethod: null,
    }));

    if (recentTxns.length > 0) {
      const txnIds = recentTxns.map((t) => t.id);
      const { data: payments } = await supabase
        .from('payments')
        .select('transaction_id, payment_method')
        .in('transaction_id', txnIds);

      const payMap = new Map<string, string>();
      (payments || []).forEach((p) => payMap.set(p.transaction_id, p.payment_method));
      enrichedTxns = recentTxns.map((t) => ({
        ...t,
        paymentMethod: payMap.get(t.id) || null,
      }));
    }

    setStats({
      todaySales,
      todayOrders: txns.length,
      lowStockItems: lowStockCount,
      totalCustomers: customerRes.count || 0,
      recentTransactions: enrichedTxns,
      salesTrend,
      lowStockList,
      activeShift: shiftRes.data as ActiveShift | null,
    });
    setLoading(false);
  }, [business?.id, branch?.id, user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!business) {
      setShowSetup(true);
      setLoading(false);
      return;
    }
    fetchStats();
  }, [business, authLoading, fetchStats]);

  // Realtime subscriptions
  useEffect(() => {
    if (!business?.id) return;

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `business_id=eq.${business.id}` }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `business_id=eq.${business.id}` }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [business?.id, fetchStats]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: business?.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStockStatus = (qty: number, min: number) => {
    if (qty <= 0) return { label: 'Out of Stock', variant: 'destructive' as const };
    if (qty <= min * 0.5) return { label: 'Critical', variant: 'destructive' as const };
    return { label: 'Low', variant: 'secondary' as const };
  };

  const getStatusVariant = (status: string | null) => {
    switch (status) {
      case 'completed': return 'default' as const;
      case 'refunded': return 'destructive' as const;
      case 'partially_refunded': return 'secondary' as const;
      case 'voided': return 'outline' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className="space-y-6">
      <BusinessSetup open={showSetup} onOpenChange={setShowSetup} />

      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}!
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Business Setup Alert */}
      {!business && (
        <Card className="border-warning bg-warning/10 cursor-pointer" onClick={() => setShowSetup(true)}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center">
                <Package className="h-5 w-5 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold">Complete Your Setup</h3>
                <p className="text-sm text-muted-foreground">
                  Set up your business profile to start using the POS system. Click here to get started.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Today's Sales" value={formatCurrency(stats.todaySales)} icon={<DollarSign className="h-4 w-4" />} loading={loading} />
        <StatCard title="Today's Orders" value={stats.todayOrders.toString()} icon={<ShoppingCart className="h-4 w-4" />} loading={loading} />
        <StatCard title="Low Stock Items" value={stats.lowStockItems.toString()} icon={<Package className="h-4 w-4" />} loading={loading} />
        <StatCard title="Total Customers" value={stats.totalCustomers.toString()} icon={<Users className="h-4 w-4" />} loading={loading} />
      </div>

      {/* Charts Row: Sales Trend + Active Shift */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Sales Trend (7 Days)
            </CardTitle>
            <CardDescription>Daily revenue over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">Loading...</div>
            ) : stats.salesTrend.every((p) => p.sales === 0) ? (
              <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-3 opacity-50" />
                <p>No sales data yet</p>
                <p className="text-sm">Complete transactions to see trends</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stats.salesTrend}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [formatCurrency(value), 'Sales']}
                  />
                  <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" fill="url(#salesGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Active Shift Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Active Shift
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.activeShift ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p className="font-medium">{format(new Date(stats.activeShift.started_at), 'hh:mm a')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Opening Cash</p>
                  <p className="font-medium">{formatCurrency(stats.activeShift.opening_cash)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold">{stats.activeShift.total_transactions}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Sales</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(stats.activeShift.total_sales)}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mb-3 opacity-50" />
                <p>No active shift</p>
                <p className="text-sm">Start a shift from the POS</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Row: Recent Transactions + Low Stock Alerts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/reports')} className="text-xs text-muted-foreground">
              View All <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No recent transactions</p>
                <p className="text-sm">Start selling to see your activity here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentTransactions.map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-sm">{txn.transaction_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(txn.created_at), 'MMM d, hh:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {txn.paymentMethod && (
                        <Badge variant="outline" className="text-xs gap-1">
                          {paymentIcons[txn.paymentMethod]}
                          {txn.paymentMethod.toUpperCase()}
                        </Badge>
                      )}
                      {txn.status && txn.status !== 'completed' && (
                        <Badge variant={getStatusVariant(txn.status)} className="text-xs">
                          {txn.status}
                        </Badge>
                      )}
                      <p className="font-semibold text-sm">{formatCurrency(txn.total_amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Low Stock Alerts
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/inventory/stock')} className="text-xs text-muted-foreground">
              View All <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {stats.lowStockList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>All stock levels are healthy</p>
                <p className="text-sm">No items below minimum threshold</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.lowStockList.map((item, idx) => {
                  const status = getStockStatus(item.quantity, item.minStock);
                  return (
                    <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          Min: {item.minStock} | Current: {item.quantity}
                        </p>
                      </div>
                      <Badge variant={status.variant} className="text-xs">
                        {status.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/pos')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              New Sale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Start a new transaction in the POS system</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/inventory/products')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Add Product
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Add a new product to your inventory</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/customers')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Add Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Register a new customer in your CRM</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

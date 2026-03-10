import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Clock, CheckCircle, ChefHat, Play, Volume2, VolumeX, RefreshCw,
  Maximize, Minimize, AlertTriangle, BarChart3, Timer
} from 'lucide-react';
import { toast } from 'sonner';

interface KOTItem {
  product_name: string;
  quantity: number;
  notes?: string;
  modifiers?: unknown[];
  prep_time?: number | null;
  image_url?: string | null;
}

interface KOTTicketData {
  id: string;
  ticket_number: string;
  order_id: string;
  items: KOTItem[];
  printed_at: string | null;
  created_at: string;
  order: {
    id: string;
    order_number: string;
    status: string;
    order_type: string;
    notes: string | null;
    table_id: string | null;
    created_at: string;
    table: { name: string } | null;
  };
}

type LaneStatus = 'pending' | 'preparing' | 'ready';
type OrderTypeFilter = 'all' | 'dine_in' | 'takeaway' | 'delivery';

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'square';
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      osc2.type = 'square';
      gain2.gain.value = 0.3;
      osc2.start();
      osc2.stop(ctx.currentTime + 0.2);
    }, 180);
  } catch {
    // Audio not supported
  }
}

function getTimeSince(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function getMinutesSince(dateString: string): number {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
}

function getTimeColor(dateString: string): string {
  const minutes = getMinutesSince(dateString);
  if (minutes < 10) return 'text-emerald-500';
  if (minutes < 20) return 'text-yellow-500';
  return 'text-destructive font-bold animate-pulse';
}

function getLaneBorderColor(status: LaneStatus): string {
  switch (status) {
    case 'pending': return 'border-l-yellow-500';
    case 'preparing': return 'border-l-blue-500';
    case 'ready': return 'border-l-emerald-500';
  }
}

export default function KitchenDisplay() {
  const [tickets, setTickets] = useState<KOTTicketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>('all');
  const [completedItemsMap, setCompletedItemsMap] = useState<Record<string, Set<number>>>({});
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [todayStats, setTodayStats] = useState({ completed: 0, avgPrepTime: 0 });
  const [, setTick] = useState(0);
  const prevTicketCount = useRef(0);
  const { business } = useAuth();

  const fetchTickets = useCallback(async () => {
    if (!business?.id) return;

    const { data, error } = await supabase
      .from('kot_tickets')
      .select(`
        *,
        order:orders!kot_tickets_order_id_fkey(
          id, order_number, status, order_type, notes, table_id, created_at,
          table:tables(name)
        )
      `)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching KOT tickets:', error);
      return;
    }

    const activeTickets = (data || []).filter((t: any) =>
      t.order && ['pending', 'preparing', 'ready'].includes(t.order.status)
    ).map((t: any) => ({
      ...t,
      items: Array.isArray(t.items) ? t.items : [],
      order: {
        ...t.order,
        table: Array.isArray(t.order.table) ? t.order.table[0] || null : t.order.table,
      }
    })) as KOTTicketData[];

    if (activeTickets.length > prevTicketCount.current && prevTicketCount.current > 0 && soundEnabled) {
      playBeep();
      toast.info('New KOT ticket received!');
    }
    prevTicketCount.current = activeTickets.length;

    setTickets(activeTickets);
    setIsLoading(false);
  }, [business?.id, soundEnabled]);

  const fetchTodayStats = useCallback(async () => {
    if (!business?.id) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('orders')
      .select('created_at, updated_at, status')
      .eq('business_id', business.id)
      .in('status', ['completed', 'served'])
      .gte('created_at', todayStart.toISOString());

    if (!error && data) {
      const completed = data.length;
      let totalPrepMs = 0;
      let countWithTime = 0;
      data.forEach((o: any) => {
        const diff = new Date(o.updated_at).getTime() - new Date(o.created_at).getTime();
        if (diff > 0 && diff < 3600000) {
          totalPrepMs += diff;
          countWithTime++;
        }
      });
      const avgPrepTime = countWithTime > 0 ? Math.round(totalPrepMs / countWithTime / 60000) : 0;
      setTodayStats({ completed, avgPrepTime });
    }
  }, [business?.id]);

  useEffect(() => {
    if (!business?.id) return;

    fetchTickets();
    fetchTodayStats();

    const channel = supabase
      .channel('kitchen-display')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kot_tickets' }, () => fetchTickets())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchTickets())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `business_id=eq.${business.id}` }, () => {
        fetchTickets();
        fetchTodayStats();
      })
      .subscribe();

    const timer = setInterval(() => setTick(t => t + 1), 30000);
    const statsTimer = setInterval(fetchTodayStats, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
      clearInterval(statsTimer);
    };
  }, [business?.id, fetchTickets, fetchTodayStats]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const filteredTickets = getFilteredTickets();
      if (filteredTickets.length === 0) return;

      const currentIndex = selectedTicketId
        ? filteredTickets.findIndex(t => t.id === selectedTicketId)
        : -1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIndex < filteredTickets.length - 1 ? currentIndex + 1 : 0;
        setSelectedTicketId(filteredTickets[next].id);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : filteredTickets.length - 1;
        setSelectedTicketId(filteredTickets[prev].id);
      } else if ((e.key === 'Enter' || e.key === ' ') && selectedTicketId) {
        e.preventDefault();
        const ticket = filteredTickets.find(t => t.id === selectedTicketId);
        if (ticket) {
          const status = ticket.order.status as LaneStatus;
          if (status === 'pending') updateOrderStatus(ticket.order.id, 'preparing');
          else if (status === 'preparing') updateOrderStatus(ticket.order.id, 'ready');
          else if (status === 'ready') updateOrderStatus(ticket.order.id, 'served');
        }
      } else if (e.key === 'Escape') {
        setSelectedTicketId(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Fullscreen change listener
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  async function updateOrderStatus(orderId: string, status: 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled') {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      fetchTickets();
      fetchTodayStats();
    }
  }

  function toggleItemComplete(ticketId: string, itemIndex: number) {
    setCompletedItemsMap(prev => {
      const next = { ...prev };
      const set = new Set(prev[ticketId] || []);
      if (set.has(itemIndex)) set.delete(itemIndex);
      else set.add(itemIndex);
      next[ticketId] = set;
      return next;
    });
  }

  function areAllItemsComplete(ticket: KOTTicketData): boolean {
    const completedSet = completedItemsMap[ticket.id];
    if (!completedSet) return false;
    return ticket.items.length > 0 && completedSet.size >= ticket.items.length;
  }

  function getFilteredTickets(): KOTTicketData[] {
    if (orderTypeFilter === 'all') return tickets;
    return tickets.filter(t => t.order.order_type === orderTypeFilter);
  }

  function getTicketsByOrderStatus(status: LaneStatus): KOTTicketData[] {
    return getFilteredTickets().filter(t => t.order.status === status);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        toast.error('Fullscreen not supported');
      });
    }
  }

  if (!business) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Business Setup Required</h2>
            <p className="text-muted-foreground">
              Please set up your business profile to use the kitchen display.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lanes: { status: LaneStatus; label: string; icon: React.ReactNode; bgClass: string }[] = [
    { status: 'pending', label: 'New Orders', icon: <Clock className="h-5 w-5" />, bgClass: 'bg-yellow-500/10' },
    { status: 'preparing', label: 'Preparing', icon: <ChefHat className="h-5 w-5" />, bgClass: 'bg-blue-500/10' },
    { status: 'ready', label: 'Ready to Serve', icon: <CheckCircle className="h-5 w-5" />, bgClass: 'bg-emerald-500/10' },
  ];

  const filteredTickets = getFilteredTickets();
  const activeCount = filteredTickets.filter(t => t.order.status !== 'ready').length;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="h-6 w-6" />
            Kitchen Display
          </h1>
          <p className="text-muted-foreground text-sm">
            {filteredTickets.length} active ticket{filteredTickets.length !== 1 ? 's' : ''} •
            Use ←→ to navigate, Enter to bump
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={toggleFullscreen} title="Toggle fullscreen">
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={fetchTickets}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 shrink-0 text-sm">
        <div className="flex items-center gap-4 bg-muted/50 rounded-lg px-4 py-2">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Today:</span>
            <span className="font-semibold">{todayStats.completed} completed</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Avg prep:</span>
            <span className="font-semibold">{todayStats.avgPrepTime}m</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5">
            <ChefHat className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Active:</span>
            <span className="font-semibold">{activeCount}</span>
          </div>
        </div>

        {/* Order Type Filter */}
        <Tabs value={orderTypeFilter} onValueChange={(v) => setOrderTypeFilter(v as OrderTypeFilter)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs px-2.5 h-6">All</TabsTrigger>
            <TabsTrigger value="dine_in" className="text-xs px-2.5 h-6">Dine-in</TabsTrigger>
            <TabsTrigger value="takeaway" className="text-xs px-2.5 h-6">Takeaway</TabsTrigger>
            <TabsTrigger value="delivery" className="text-xs px-2.5 h-6">Delivery</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Swim Lanes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {lanes.map(({ status, label, icon, bgClass }) => {
          const laneTickets = getTicketsByOrderStatus(status);
          return (
            <div key={status} className="flex flex-col min-h-0">
              {/* Lane Header */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${bgClass}`}>
                {icon}
                <span className="font-semibold">{label}</span>
                <Badge variant="secondary" className="ml-auto">{laneTickets.length}</Badge>
              </div>

              {/* Lane Content */}
              <ScrollArea className="flex-1 border border-t-0 rounded-b-lg bg-muted/30 p-2">
                {laneTickets.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    No tickets
                  </div>
                ) : (
                  <div className="space-y-3">
                    {laneTickets.map((ticket) => {
                      const isSelected = selectedTicketId === ticket.id;
                      const isUrgent = getMinutesSince(ticket.created_at) >= 15 && status !== 'ready';
                      const hasNotes = !!ticket.order.notes;
                      const allDone = areAllItemsComplete(ticket);
                      const completedSet = completedItemsMap[ticket.id] || new Set();

                      return (
                        <Card
                          key={ticket.id}
                          className={`border-l-4 ${getLaneBorderColor(status)} shadow-sm cursor-pointer transition-all
                            ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}
                            ${isUrgent ? 'border-destructive/50 shadow-destructive/20 shadow-md animate-pulse' : ''}
                          `}
                          onClick={() => setSelectedTicketId(ticket.id)}
                        >
                          <CardHeader className="pb-2 px-3 pt-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base font-bold flex items-center gap-1.5">
                                KOT #{ticket.ticket_number}
                                {hasNotes && (
                                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                )}
                                {isUrgent && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">
                                    URGENT
                                  </Badge>
                                )}
                              </CardTitle>
                              <span className={`text-xs flex items-center gap-1 ${getTimeColor(ticket.created_at)}`}>
                                <Clock className="h-3 w-3" />
                                {getTimeSince(ticket.created_at)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Order {ticket.order.order_number}</span>
                              {ticket.order.table && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {ticket.order.table.name}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                                {ticket.order.order_type.replace('_', ' ')}
                              </Badge>
                              {(() => {
                                const maxPrep = Math.max(...ticket.items.map(i => i.prep_time || 0));
                                return maxPrep > 0 ? (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    ⏱ ~{maxPrep}m
                                  </Badge>
                                ) : null;
                              })()}
                            </div>
                          </CardHeader>

                          <CardContent className="px-3 pb-2">
                            <ul className="space-y-1">
                              {ticket.items.map((item, idx) => {
                                const isDone = completedSet.has(idx);
                                return (
                                  <li
                                    key={idx}
                                    className={`flex items-start gap-2 text-sm cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-muted/50
                                      ${isDone ? 'opacity-50 line-through' : ''}
                                    `}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleItemComplete(ticket.id, idx);
                                    }}
                                  >
                                    {item.image_url && (
                                      <img src={item.image_url} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                                    )}
                                    <span className={`font-mono font-bold min-w-[24px] ${isDone ? 'text-muted-foreground' : 'text-primary'}`}>
                                      {item.quantity}×
                                    </span>
                                    <div className="flex-1">
                                      <span className="flex items-center gap-1.5">
                                        {item.product_name}
                                        {item.prep_time && item.prep_time > 0 && (
                                          <span className="text-[10px] text-muted-foreground bg-muted rounded px-1 py-0.5">⏱ {item.prep_time}m</span>
                                        )}
                                      </span>
                                      {item.notes && (
                                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">📝 {item.notes}</p>
                                      )}
                                    </div>
                                    {isDone && <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />}
                                  </li>
                                );
                              })}
                            </ul>

                            {ticket.order.notes && (
                              <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 border-t border-border pt-1.5 font-medium">
                                ⚠️ {ticket.order.notes}
                              </p>
                            )}
                          </CardContent>

                          <div className="px-3 pb-3">
                            {status === 'pending' && (
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={(e) => { e.stopPropagation(); updateOrderStatus(ticket.order.id, 'preparing'); }}
                              >
                                <Play className="h-3 w-3 mr-1.5" />
                                Start Preparing
                              </Button>
                            )}
                            {status === 'preparing' && (
                              <Button
                                size="sm"
                                className={`w-full ${allDone ? 'animate-pulse' : ''}`}
                                variant={allDone ? 'default' : 'outline'}
                                onClick={(e) => { e.stopPropagation(); updateOrderStatus(ticket.order.id, 'ready'); }}
                              >
                                <CheckCircle className="h-3 w-3 mr-1.5" />
                                {allDone ? '✨ All Done — Mark Ready' : 'Mark Ready'}
                              </Button>
                            )}
                            {status === 'ready' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={(e) => { e.stopPropagation(); updateOrderStatus(ticket.order.id, 'served'); }}
                              >
                                Served ✓
                              </Button>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}

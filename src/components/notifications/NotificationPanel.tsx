import { useMemo } from 'react';
import { Bell, CheckCheck, Package, ShoppingCart, Info, AlertTriangle, Settings, ChefHat, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { NotificationPreferences } from './NotificationPreferences';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

function getIcon(category: string | null) {
  switch (category) {
    case 'low_stock':
      return <Package className="h-4 w-4 text-warning shrink-0" />;
    case 'new_order':
      return <ShoppingCart className="h-4 w-4 text-primary shrink-0" />;
    case 'order_ready':
      return <ChefHat className="h-4 w-4 text-primary shrink-0" />;
    case 'order_cancelled':
      return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function getTypeIcon(type: string) {
  if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-warning shrink-0" />;
  return null;
}

function getRoute(n: Notification): string | null {
  if (n.reference_type === 'product') return '/inventory';
  if (n.reference_type === 'order') return '/pos/restaurant';
  return null;
}

export function NotificationPanel() {
  const { notifications: allNotifications, unreadCount: rawUnreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const { preferences } = useNotificationPreferences();
  const navigate = useNavigate();

  const notifications = useMemo(() => {
    return allNotifications.filter((n) => {
      if (n.category === 'low_stock') return preferences.low_stock;
      if (n.category === 'new_order') return preferences.new_order;
      if (n.category === 'order_ready') return preferences.order_ready;
      if (n.category === 'order_cancelled') return preferences.order_cancelled;
      if (n.category === 'system') return preferences.system;
      return true;
    });
  }, [allNotifications, preferences]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    const route = getRoute(n);
    if (route) navigate(route);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs" onClick={markAllAsRead}>
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md p-0 border-0">
                <NotificationPreferences />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No notifications yet</div>
          ) : (
            <div>
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-muted/50 transition-colors border-b last:border-b-0',
                    !n.is_read && 'bg-primary/5'
                  )}
                >
                  {getIcon(n.category)}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-tight', !n.is_read && 'font-medium')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

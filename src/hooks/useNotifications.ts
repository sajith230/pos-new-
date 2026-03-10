import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Notification {
  id: string;
  business_id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  category: string | null;
  is_read: boolean;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
}

export function useNotifications() {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const permissionRef = useRef<NotificationPermission>('default');

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((p) => {
          permissionRef.current = p;
        });
      } else {
        permissionRef.current = Notification.permission;
      }
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user || !profile?.business_id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('business_id', profile.business_id)
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  }, [user, profile?.business_id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.business_id) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `business_id=eq.${profile.business_id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          if (newNotif.user_id === null || newNotif.user_id === user?.id) {
            setNotifications((prev) => [newNotif, ...prev]);

            if (
              document.hidden &&
              permissionRef.current === 'granted' &&
              'Notification' in window
            ) {
              new window.Notification(newNotif.title, {
                body: newNotif.message,
                icon: '/favicon.ico',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.business_id, user?.id]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user || !profile?.business_id) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [notifications, user, profile?.business_id]);

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead };
}

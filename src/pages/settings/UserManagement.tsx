import { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PermissionButton } from '@/components/auth/PermissionButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { AppRole } from '@/types/database';
import { Plus, X, ShieldAlert, UserPlus } from 'lucide-react';

const ALL_ROLES: AppRole[] = ['admin', 'manager', 'cashier', 'waiter', 'kitchen'];

type UserWithRole = {
  id: string;
  user_id: string;
  full_name: string | null;
  is_active: boolean | null;
  created_at: string;
  roles: { id: string; role: AppRole }[];
};

export default function UserManagement() {
  const { business, isAdmin, user } = useAuth();
  const { toast } = useToast();
  const { canCreate: canCreateUser, canEdit: canEditUser, canDelete: canDeleteUser } = usePermissions();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingRole, setAddingRole] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState({ full_name: '', email: '', password: '', role: 'cashier' as AppRole });

  useEffect(() => { if (business?.id) fetchUsers(); }, [business?.id]);

  async function fetchUsers() {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*').eq('business_id', business!.id);
    if (!profiles) { setLoading(false); return; }

    const { data: roles } = await supabase.from('user_roles').select('*');
    const roleMap: Record<string, { id: string; role: AppRole }[]> = {};
    roles?.forEach(r => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push({ id: r.id, role: r.role as AppRole });
    });

    setUsers(profiles.map(p => ({ ...p, roles: roleMap[p.user_id] || [] })));
    setLoading(false);
  }

  function getAdminCount() {
    return users.filter(u => u.roles.some(r => r.role === 'admin')).length;
  }

  async function addRole(userId: string, role: AppRole) {
    if (!isAdmin()) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'Only admins can assign roles.' });
      return;
    }
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Role added', description: `Assigned ${role} role successfully.` });
    setAddingRole(null);
    fetchUsers();
  }

  async function removeRole(userRoleId: string, userId: string, role: AppRole) {
    if (!isAdmin()) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'Only admins can remove roles.' });
      return;
    }
    if (role === 'admin' && getAdminCount() <= 1) {
      toast({ variant: 'destructive', title: 'Cannot Remove', description: 'Cannot remove the last admin. At least one admin must exist.' });
      return;
    }
    const { error } = await supabase.from('user_roles').delete().eq('id', userRoleId);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Role removed', description: `Removed ${role} role successfully.` });
    fetchUsers();
  }

  function getAvailableRoles(userRoles: { role: AppRole }[]) {
    return ALL_ROLES.filter(r => !userRoles.some(ur => ur.role === r));
  }

  async function handleInvite() {
    if (!inviteForm.email || !inviteForm.password || !inviteForm.role) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill in all required fields.' });
      return;
    }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteForm.email,
          password: inviteForm.password,
          full_name: inviteForm.full_name,
          role: inviteForm.role,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Team member added', description: `${inviteForm.email} has been added as ${inviteForm.role}.` });
      setInviteOpen(false);
      setInviteForm({ full_name: '', email: '', password: '', role: 'cashier' });
      fetchUsers();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to invite user' });
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight">User Management</h1><p className="text-muted-foreground">Manage team members and their roles</p></div>
        <PermissionButton permitted={canCreateUser('settings.users') && isAdmin()} onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Add Team Member
        </PermissionButton>
      </div>
      <Card>
        <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Roles</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              : users.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No team members found</TableCell></TableRow>
              : users.map(u => {
                const available = getAvailableRoles(u.roles);
                const isLastAdmin = u.roles.some(r => r.role === 'admin') && getAdminCount() <= 1;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || 'Unnamed User'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap items-center">
                        {u.roles.length > 0 ? u.roles.map(r => (
                          <Badge key={r.id} variant={r.role === 'admin' ? 'default' : 'secondary'} className="flex items-center gap-1">
                            {r.role}
                            {canDeleteUser('settings.users') && isAdmin() && !(r.role === 'admin' && isLastAdmin) && (
                              <button
                                onClick={() => removeRole(r.id, u.user_id, r.role)}
                                className="ml-0.5 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                            {r.role === 'admin' && isLastAdmin && (
                              <ShieldAlert className="h-3 w-3 ml-0.5 text-muted-foreground" />
                            )}
                          </Badge>
                        )) : <span className="text-muted-foreground text-sm">No roles</span>}

                        {canEditUser('settings.users') && isAdmin() && available.length > 0 && (
                          addingRole === u.id ? (
                            <Select onValueChange={(val) => addRole(u.user_id, val as AppRole)}>
                              <SelectTrigger className="w-28 h-7 text-xs">
                                <SelectValue placeholder="Add role" />
                              </SelectTrigger>
                              <SelectContent>
                                {available.map(r => (
                                  <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setAddingRole(u.id)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          )
                        )}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={u.is_active ? 'default' : 'destructive'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>Create a new user account and assign them to your business.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Full Name</Label>
              <Input id="invite-name" placeholder="e.g. John Doe" value={inviteForm.full_name} onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input id="invite-email" type="email" placeholder="user@example.com" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-password">Temporary Password *</Label>
              <Input id="invite-password" type="password" placeholder="Min 6 characters" value={inviteForm.password} onChange={e => setInviteForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={inviteForm.role} onValueChange={val => setInviteForm(f => ({ ...f, role: val as AppRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map(r => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting}>{inviting ? 'Creating...' : 'Create User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

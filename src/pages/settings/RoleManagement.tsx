import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Permission, AppRole } from '@/types/database';
import { ChevronRight, ChevronDown, ShieldCheck } from 'lucide-react';

const ROLES: AppRole[] = ['admin', 'manager', 'cashier', 'waiter', 'kitchen'];
const ACTIONS = ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_export'] as const;

interface ModuleNode {
  key: string;
  label: string;
  children?: ModuleNode[];
}

const MODULES: ModuleNode[] = [
  { key: 'pos', label: 'Point of Sale', children: [
    { key: 'pos.retail', label: 'Retail POS' },
    { key: 'pos.restaurant', label: 'Restaurant POS' },
    { key: 'pos.waiter', label: 'Waiter Mode' },
    { key: 'pos.kitchen', label: 'Kitchen Display' },
  ]},
  { key: 'inventory', label: 'Inventory', children: [
    { key: 'inventory.stock', label: 'Stock Overview' },
    { key: 'inventory.products', label: 'Products' },
    { key: 'inventory.suppliers', label: 'Suppliers' },
    { key: 'inventory.orders', label: 'Purchase Orders' },
  ]},
  { key: 'customers', label: 'Customers' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings', children: [
    { key: 'settings.general', label: 'General' },
    { key: 'settings.users', label: 'Users' },
    { key: 'settings.roles', label: 'Roles' },
  ]},
];

function getAllModuleKeys(nodes: ModuleNode[]): string[] {
  const keys: string[] = [];
  for (const n of nodes) {
    keys.push(n.key);
    if (n.children) keys.push(...getAllModuleKeys(n.children));
  }
  return keys;
}

export default function RoleManagement() {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<AppRole>('admin');
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  useEffect(() => { fetchPermissions(); }, []);

  // Auto-ensure admin has full access whenever permissions load
  useEffect(() => {
    if (!loading && permissions.length >= 0) {
      ensureAdminFullAccess();
    }
  }, [loading]);

  async function ensureAdminFullAccess() {
    const allKeys = getAllModuleKeys(MODULES);
    const adminPerms = permissions.filter(p => p.role === 'admin');
    const missingOrIncomplete: string[] = [];

    for (const key of allKeys) {
      const existing = adminPerms.find(p => p.module === key);
      if (!existing || !existing.can_view || !existing.can_create || !existing.can_edit || !existing.can_delete || !existing.can_export) {
        missingOrIncomplete.push(key);
      }
    }

    if (missingOrIncomplete.length === 0) return;

    for (const key of missingOrIncomplete) {
      const existing = adminPerms.find(p => p.module === key);
      const fullAccess = { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true };
      if (existing) {
        await supabase.from('permissions').update(fullAccess).eq('id', existing.id);
      } else {
        await supabase.from('permissions').insert({ module: key, role: 'admin' as AppRole, ...fullAccess });
      }
    }
    // Refresh after seeding
    const { data } = await supabase.from('permissions').select('*');
    setPermissions((data as Permission[]) || []);
  }

  async function fetchPermissions() {
    setLoading(true);
    const { data } = await supabase.from('permissions').select('*');
    setPermissions((data as Permission[]) || []);
    setLoading(false);
  }

  function getPermission(module: string, role: AppRole) {
    return permissions.find(p => p.module === module && p.role === role);
  }

  const isAdminSelected = selectedRole === 'admin';

  async function togglePermission(module: string, action: typeof ACTIONS[number], value: boolean) {
    if (isAdminSelected) return; // Cannot modify admin permissions
    const existing = getPermission(module, selectedRole);
    if (existing) {
      const { error } = await supabase.from('permissions').update({ [action]: value }).eq('id', existing.id);
      if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    } else {
      const payload: any = { module, role: selectedRole, [action]: value };
      const { error } = await supabase.from('permissions').insert(payload);
      if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    }
    fetchPermissions();
  }

  async function toggleParentPermission(parent: ModuleNode, action: typeof ACTIONS[number], value: boolean) {
    if (isAdminSelected) return;
    await togglePermission(parent.key, action, value);
    if (parent.children) {
      for (const child of parent.children) {
        await togglePermission(child.key, action, value);
      }
    }
  }

  function getParentCheckState(parent: ModuleNode, action: typeof ACTIONS[number]): 'checked' | 'unchecked' | 'indeterminate' {
    if (isAdminSelected) return 'checked';
    if (!parent.children?.length) {
      const perm = getPermission(parent.key, selectedRole);
      return perm?.[action] ? 'checked' : 'unchecked';
    }
    const childStates = parent.children.map(c => {
      const perm = getPermission(c.key, selectedRole);
      return perm?.[action] ?? false;
    });
    const allChecked = childStates.every(Boolean);
    const someChecked = childStates.some(Boolean);
    if (allChecked) return 'checked';
    if (someChecked) return 'indeterminate';
    return 'unchecked';
  }

  function toggleOpen(key: string) {
    setOpenModules(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function renderModuleRow(mod: ModuleNode, indent = false) {
    const perm = getPermission(mod.key, selectedRole);
    return (
      <TableRow key={mod.key} className={indent ? 'bg-muted/30' : ''}>
        <TableCell className={`font-medium ${indent ? 'pl-10' : ''}`}>
          {mod.label}
        </TableCell>
        {ACTIONS.map(action => (
          <TableCell key={action} className="text-center">
            <Checkbox
              checked={isAdminSelected ? true : (perm?.[action] ?? false)}
              disabled={isAdminSelected}
              onCheckedChange={(v) => togglePermission(mod.key, action, !!v)}
            />
          </TableCell>
        ))}
      </TableRow>
    );
  }

  function renderParentRow(mod: ModuleNode) {
    if (!mod.children?.length) {
      return renderModuleRow(mod);
    }

    const isOpen = openModules[mod.key] ?? true;

    return (
      <Collapsible key={mod.key} open={isOpen} onOpenChange={() => toggleOpen(mod.key)} asChild>
        <>
          <CollapsibleTrigger asChild>
            <TableRow className="cursor-pointer hover:bg-muted/50">
              <TableCell className="font-semibold">
                <div className="flex items-center gap-1">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {mod.label}
                </div>
              </TableCell>
              {ACTIONS.map(action => {
                const state = getParentCheckState(mod, action);
                return (
                  <TableCell key={action} className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isAdminSelected ? true : state === 'checked' ? true : state === 'indeterminate' ? 'indeterminate' : false}
                      disabled={isAdminSelected}
                      onCheckedChange={(v) => toggleParentPermission(mod, action, !!v)}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          </CollapsibleTrigger>
          <CollapsibleContent asChild>
            <>{mod.children.map(child => renderModuleRow(child, true))}</>
          </CollapsibleContent>
        </>
      </Collapsible>
    );
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Role Management</h1><p className="text-muted-foreground">Configure permissions for each role</p></div>

      <div className="flex gap-2">
        {ROLES.map(role => (
          <Button key={role} variant={selectedRole === role ? 'default' : 'outline'} onClick={() => setSelectedRole(role)} className="capitalize">{role}</Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="capitalize flex items-center gap-2">
            {selectedRole} Permissions
            {isAdminSelected && <Badge variant="secondary" className="ml-2"><ShieldCheck className="h-3 w-3 mr-1" />Full Access</Badge>}
          </CardTitle>
          <CardDescription>
            {isAdminSelected
              ? 'Admin has full access to all modules. These permissions cannot be modified.'
              : 'Toggle access levels for each module and sub-module'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Module</TableHead>
              {ACTIONS.map(a => <TableHead key={a} className="text-center capitalize">{a.replace('can_', '')}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {MODULES.map(mod => renderParentRow(mod))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

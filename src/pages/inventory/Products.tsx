import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Upload, ImageIcon, FileSpreadsheet, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PermissionButton } from '@/components/auth/PermissionButton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/lib/formatCurrency';
import { Product, Category, Recipe } from '@/types/database';

type ProductWithStock = Product & { stock_qty?: number; recipe_cost?: number };

interface RecipeRow {
  ingredient_id: string;
  quantity: number;
  unit: string;
  ingredient_name: string;
  cost_price: number;
}

const emptyProduct = { name: '', sku: '', barcode: '', price: 0, cost_price: 0, tax_rate: 0, category_id: '', description: '', min_stock: 0, unit: 'pcs', is_ingredient: false, prep_time: 0, image_url: '' };

export default function Products() {
  const { business, branch } = useAuth();
  const { toast } = useToast();
  const { format: fc } = useCurrency();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);

  // Recipe state
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([]);
  const [ingredientProducts, setIngredientProducts] = useState<Product[]>([]);
  const [newIngredientId, setNewIngredientId] = useState('');
  const [newIngredientQty, setNewIngredientQty] = useState<number>(1);
  const [newIngredientUnit, setNewIngredientUnit] = useState('pcs');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvErrors, setCsvErrors] = useState<Record<number, string>>({});
  const [csvImporting, setCsvImporting] = useState(false);

  // Add category inline
  const [newCatDialogOpen, setNewCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSaving, setNewCatSaving] = useState(false);

  async function handleAddCategory() {
    if (!newCatName.trim() || !business?.id) return;
    setNewCatSaving(true);
    const { data, error } = await supabase.from('categories').insert({ business_id: business.id, name: newCatName.trim() }).select('id').single();
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else if (data) {
      await fetchCategories();
      setForm(f => ({ ...f, category_id: data.id }));
      toast({ title: 'Category created' });
    }
    setNewCatName('');
    setNewCatDialogOpen(false);
    setNewCatSaving(false);
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(current); current = ''; }
        else { current += ch; }
      }
    }
    result.push(current);
    return result;
  }

  function parseCSV(text: string): Record<string, string>[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (values[i] || '').trim(); });
      return row;
    });
  }

  function validateCSVRows(rows: Record<string, string>[]): Record<number, string> {
    const errors: Record<number, string> = {};
    rows.forEach((row, i) => {
      if (!row.name) { errors[i] = 'Name is required'; return; }
      if (row.price && isNaN(Number(row.price))) { errors[i] = 'Invalid price'; return; }
      if (row.cost_price && isNaN(Number(row.cost_price))) { errors[i] = 'Invalid cost price'; return; }
      if (row.tax_rate && isNaN(Number(row.tax_rate))) { errors[i] = 'Invalid tax rate'; return; }
      if (row.min_stock && isNaN(Number(row.min_stock))) { errors[i] = 'Invalid min stock'; return; }
    });
    return errors;
  }

  function handleCSVFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      const errors = validateCSVRows(rows);
      setCsvData(rows);
      setCsvErrors(errors);
      setCsvDialogOpen(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleCSVImport() {
    if (!business?.id) return;
    setCsvImporting(true);
    try {
      const validRows = csvData.filter((_, i) => !csvErrors[i]);
      if (validRows.length === 0) {
        toast({ variant: 'destructive', title: 'No valid rows to import' });
        setCsvImporting(false);
        return;
      }

      const uniqueCategoryNames = [...new Set(validRows.map(r => r.category).filter(Boolean))];
      const categoryMap: Record<string, string> = {};
      categories.forEach(c => { categoryMap[c.name.toLowerCase()] = c.id; });

      for (const catName of uniqueCategoryNames) {
        if (!categoryMap[catName.toLowerCase()]) {
          const { data } = await supabase.from('categories').insert({ business_id: business.id, name: catName }).select('id').single();
          if (data) categoryMap[catName.toLowerCase()] = data.id;
        }
      }

      const insertRows = validRows.map(row => ({
        business_id: business.id,
        name: row.name,
        sku: row.sku || null,
        barcode: row.barcode || null,
        price: Number(row.price) || 0,
        cost_price: Number(row.cost_price) || 0,
        tax_rate: Number(row.tax_rate) || 0,
        category_id: row.category ? (categoryMap[row.category.toLowerCase()] || null) : null,
        unit: row.unit || 'pcs',
        min_stock: Number(row.min_stock) || 0,
        description: row.description || null,
        is_ingredient: row.is_ingredient?.toLowerCase() === 'true',
      }));

      const { error } = await supabase.from('products').insert(insertRows);
      if (error) {
        toast({ variant: 'destructive', title: 'Import failed', description: error.message });
      } else {
        toast({ title: 'Import Complete', description: `${validRows.length} product(s) imported, ${Object.keys(csvErrors).length} skipped.` });
        setCsvDialogOpen(false);
        setCsvData([]);
        setCsvErrors({});
        fetchProducts();
        fetchCategories();
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Import error', description: err.message });
    }
    setCsvImporting(false);
  }

  function downloadCSVTemplate() {
    const header = 'name,sku,barcode,price,cost_price,tax_rate,category,unit,min_stock,description,is_ingredient';
    const example = 'Sample Product,SKU001,123456789,99.99,50,5,Beverages,pcs,10,A sample product,false';
    const blob = new Blob([header + '\n' + example + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'products_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (business?.id) { fetchProducts(); fetchCategories(); }
  }, [business?.id, branch?.id]);

  async function fetchProducts() {
    setLoading(true);
    const { data: productsData } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('business_id', business!.id)
      .order('name');

    const prods = (productsData as Product[]) || [];

    // Fetch recipe costs in bulk
    const productIds = prods.map(p => p.id);
    const { data: recipesData } = await supabase
      .from('recipes')
      .select('product_id, quantity, ingredient:products!recipes_ingredient_id_fkey(cost_price)')
      .in('product_id', productIds.length > 0 ? productIds : ['00000000-0000-0000-0000-000000000000']);

    const recipeCostMap: Record<string, number> = {};
    ((recipesData as any[]) || []).forEach((r: any) => {
      const ingCost = r.ingredient?.cost_price || 0;
      const lineCost = ingCost * r.quantity;
      recipeCostMap[r.product_id] = (recipeCostMap[r.product_id] || 0) + lineCost;
    });

    const stockMap: Record<string, number> = {};
    if (branch?.id) {
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('product_id, quantity')
        .eq('branch_id', branch.id);
      (inventoryData || []).forEach((inv: any) => {
        stockMap[inv.product_id] = inv.quantity;
      });
    }

    const prodsWithStock: ProductWithStock[] = prods.map(p => ({
      ...p,
      stock_qty: branch?.id ? (stockMap[p.id] ?? 0) : undefined,
      recipe_cost: recipeCostMap[p.id] || undefined,
    }));
    setProducts(prodsWithStock);
    setLoading(false);
  }

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*').eq('business_id', business!.id).eq('is_active', true).order('name');
    setCategories((data as Category[]) || []);
  }

  async function fetchIngredientProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', business!.id)
      .eq('is_active', true)
      .order('name');
    setIngredientProducts((data as Product[]) || []);
  }

  async function fetchRecipeForProduct(productId: string) {
    const { data } = await supabase
      .from('recipes')
      .select('*, ingredient:products!recipes_ingredient_id_fkey(*)')
      .eq('product_id', productId);

    const rows: RecipeRow[] = ((data as any[]) || []).map((r: any) => ({
      ingredient_id: r.ingredient_id,
      quantity: r.quantity,
      unit: r.unit || 'pcs',
      ingredient_name: r.ingredient?.name || 'Unknown',
      cost_price: r.ingredient?.cost_price || 0,
    }));
    setRecipeRows(rows);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyProduct);
    setRecipeRows([]);
    setNewIngredientId('');
    setNewIngredientQty(1);
    setNewIngredientUnit('pcs');
    fetchIngredientProducts();
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku || '', barcode: p.barcode || '', price: p.price, cost_price: p.cost_price || 0, tax_rate: p.tax_rate || 0, category_id: p.category_id || '', description: p.description || '', min_stock: p.min_stock || 0, unit: p.unit || 'pcs', is_ingredient: p.is_ingredient || false, prep_time: (p as any).prep_time || 0, image_url: p.image_url || '' });
    setRecipeRows([]);
    setNewIngredientId('');
    setNewIngredientQty(1);
    setNewIngredientUnit('pcs');
    fetchIngredientProducts();
    fetchRecipeForProduct(p.id);
    setDialogOpen(true);
  }

  function addRecipeRow() {
    if (!newIngredientId || recipeRows.some(r => r.ingredient_id === newIngredientId)) return;
    const ing = ingredientProducts.find(p => p.id === newIngredientId);
    if (!ing) return;
    setRecipeRows([...recipeRows, {
      ingredient_id: ing.id,
      quantity: newIngredientQty,
      unit: newIngredientUnit,
      ingredient_name: ing.name,
      cost_price: ing.cost_price || 0,
    }]);
    setNewIngredientId('');
    setNewIngredientQty(1);
    setNewIngredientUnit('pcs');
  }

  function removeRecipeRow(ingredientId: string) {
    setRecipeRows(recipeRows.filter(r => r.ingredient_id !== ingredientId));
  }

  async function saveRecipes(productId: string) {
    // Delete existing recipes
    await supabase.from('recipes').delete().eq('product_id', productId);
    // Insert new ones
    if (recipeRows.length > 0) {
      const rows = recipeRows.map(r => ({
        product_id: productId,
        ingredient_id: r.ingredient_id,
        quantity: r.quantity,
        unit: r.unit || null,
      }));
      await supabase.from('recipes').insert(rows);
    }
  }

  async function handleSave() {
    const payload = { ...form, business_id: business!.id, category_id: form.category_id || null, price: Number(form.price), cost_price: Number(form.cost_price), tax_rate: Number(form.tax_rate), min_stock: Number(form.min_stock), is_ingredient: form.is_ingredient, prep_time: Number(form.prep_time) || null, image_url: form.image_url || null };
    let error;
    let productId = editing?.id;
    if (editing) {
      ({ error } = await supabase.from('products').update(payload).eq('id', editing.id));
    } else {
      const { data, error: insertError } = await supabase.from('products').insert(payload).select('id').single();
      error = insertError;
      productId = data?.id;
    }
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }

    // Save recipes
    if (productId) {
      await saveRecipes(productId);
    }

    toast({ title: editing ? 'Product Updated' : 'Product Created' });
    setDialogOpen(false);
    fetchProducts();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: 'Product Deactivated' });
    fetchProducts();
  }

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category_id === categoryFilter;
    const matchesActive = !showActiveOnly || p.is_active;
    return matchesSearch && matchesCategory && matchesActive;
  });

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const filePath = `${business!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(filePath, file);
    if (error) {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
    setForm({ ...form, image_url: urlData.publicUrl });
    setUploading(false);
  }

  const recipeCost = recipeRows.reduce((sum, r) => sum + r.cost_price * r.quantity, 0);
  const availableIngredients = ingredientProducts.filter(p =>
    !recipeRows.some(r => r.ingredient_id === p.id) && p.id !== editing?.id
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <div className="flex gap-2">
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFileSelect} />
          <PermissionButton permitted={canCreate('inventory.products')} variant="outline" onClick={() => setCsvDialogOpen(true)}><FileSpreadsheet className="h-4 w-4 mr-2" />Import CSV</PermissionButton>
          <PermissionButton permitted={canCreate('inventory.products')} onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Product</PermissionButton>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <Input placeholder="Search by name, SKU, barcode..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch id="active-filter" checked={showActiveOnly} onCheckedChange={setShowActiveOnly} />
              <Label htmlFor="active-filter" className="text-sm">Active only</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No products found</TableCell></TableRow>
              ) : filtered.map(p => {
                const effectiveCost = p.recipe_cost && p.recipe_cost > 0 ? p.recipe_cost : (p.cost_price || 0);
                const hasRecipe = !!(p.recipe_cost && p.recipe_cost > 0);
                const margin = p.price > 0 && effectiveCost > 0 ? ((p.price - effectiveCost) / p.price) * 100 : null;
                const marginColor = margin === null ? 'text-muted-foreground' : margin > 30 ? 'text-green-600' : margin > 10 ? 'text-yellow-600' : 'text-destructive';
                return (
                <TableRow key={p.id}>
                  <TableCell className="p-1">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.name}
                    {p.is_ingredient && <Badge variant="outline" className="ml-2 text-xs">ingredient</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.sku || '—'}</TableCell>
                  <TableCell>{p.category?.name || '—'}</TableCell>
                  <TableCell className="text-right">{fc(p.price)}</TableCell>
                  <TableCell className="text-right">
                    <div>{fc(effectiveCost)}</div>
                    {hasRecipe && <span className="text-xs text-muted-foreground">(recipe)</span>}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${marginColor}`}>
                    {margin !== null ? `${margin.toFixed(1)}%` : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.stock_qty !== undefined ? (
                      <span className={p.stock_qty <= (p.min_stock || 0) ? 'text-destructive font-medium' : ''}>
                        {p.stock_qty}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell><Badge variant={p.is_active ? 'secondary' : 'destructive'}>{p.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <PermissionButton permitted={canEdit('inventory.products')} variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></PermissionButton>
                    <PermissionButton permitted={canDelete('inventory.products')} variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></PermissionButton>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
          <Tabs defaultValue="details">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="recipe" className="flex-1">Recipe / Ingredients</TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <div className="grid gap-4 py-4">
                {/* Image Upload */}
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 rounded-lg border border-dashed border-muted-foreground/40 flex items-center justify-center overflow-hidden bg-muted">
                    {form.image_url ? (
                      <img src={form.image_url} alt="Product" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-1" />{uploading ? 'Uploading...' : 'Upload Image'}
                    </Button>
                    {form.image_url && (
                      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setForm({ ...form, image_url: '' })}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Barcode</Label><Input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} /></div>
                  <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>Price *</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })} /></div>
                  <div><Label>Cost Price</Label><Input type="number" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: +e.target.value })} /></div>
                  <div><Label>Tax Rate %</Label><Input type="number" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: +e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        <Separator className="my-1" />
                        <button
                          type="button"
                          className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm text-primary hover:bg-accent outline-none"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setNewCatDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />Add Category
                        </button>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Min Stock</Label><Input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: +e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Prep Time (mins)</Label><Input type="number" min={0} placeholder="e.g. 15" value={form.prep_time || ''} onChange={e => setForm({ ...form, prep_time: +e.target.value })} /></div>
                  <div></div>
                </div>
                <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="is-ingredient">Raw Ingredient</Label>
                    <p className="text-xs text-muted-foreground">Mark as a raw ingredient (not sold directly, used in recipes)</p>
                  </div>
                  <Switch id="is-ingredient" checked={form.is_ingredient} onCheckedChange={v => setForm({ ...form, is_ingredient: v })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="recipe">
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Define the ingredients required to make this product. This helps track ingredient usage and estimate production costs.
                </p>

                {recipeRows.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ingredient</TableHead>
                          <TableHead className="text-right w-24">Qty</TableHead>
                          <TableHead className="w-20">Unit</TableHead>
                          <TableHead className="text-right w-28">Cost</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipeRows.map(row => (
                          <TableRow key={row.ingredient_id}>
                            <TableCell className="font-medium">{row.ingredient_name}</TableCell>
                            <TableCell className="text-right">{row.quantity}</TableCell>
                            <TableCell>{row.unit}</TableCell>
                            <TableCell className="text-right">{fc(row.cost_price * row.quantity)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRecipeRow(row.ingredient_id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Separator />
                    <div className="flex justify-between items-center px-4 py-2 bg-muted/50">
                      <span className="text-sm font-medium">Estimated Recipe Cost</span>
                      <span className="text-sm font-bold">{fc(recipeCost)}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Ingredient</Label>
                    <Select value={newIngredientId} onValueChange={setNewIngredientId}>
                      <SelectTrigger><SelectValue placeholder="Select ingredient..." /></SelectTrigger>
                      <SelectContent>
                        {availableIngredients.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.is_ingredient ? '(ingredient)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" min={0.01} step={0.01} value={newIngredientQty} onChange={e => setNewIngredientQty(+e.target.value)} />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Unit</Label>
                    <Input value={newIngredientUnit} onChange={e => setNewIngredientUnit(e.target.value)} />
                  </div>
                  <Button size="sm" onClick={addRecipeRow} disabled={!newIngredientId}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button onClick={handleSave} disabled={!form.name}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={(open) => { setCsvDialogOpen(open); if (!open) { setCsvData([]); setCsvErrors({}); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Products from CSV</DialogTitle>
          </DialogHeader>

          {csvData.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with columns: <span className="font-medium text-foreground">name</span> (required), sku, barcode, price, cost_price, tax_rate, category, unit, min_stock, description, is_ingredient.
              </p>
              <div className="flex flex-col items-center gap-4 py-6 border border-dashed rounded-lg">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={downloadCSVTemplate}>
                    <Download className="h-4 w-4 mr-2" />Download Template
                  </Button>
                  <Button onClick={() => csvInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />Select CSV File
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {csvData.length} row(s) found — {csvData.length - Object.keys(csvErrors).length} valid, {Object.keys(csvErrors).length} with errors
                </p>
                <Button variant="ghost" size="sm" onClick={() => { setCsvData([]); setCsvErrors({}); }}>
                  <X className="h-4 w-4 mr-1" />Clear
                </Button>
              </div>
              <div className="border rounded-lg overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.map((row, i) => (
                      <TableRow key={i} className={csvErrors[i] ? 'bg-destructive/5' : ''}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{row.name || <span className="text-destructive italic">Missing</span>}</TableCell>
                        <TableCell className="text-muted-foreground">{row.sku || '—'}</TableCell>
                        <TableCell className="text-right">{row.price || '0'}</TableCell>
                        <TableCell>{row.category || '—'}</TableCell>
                        <TableCell>
                          {csvErrors[i] ? (
                            <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />{csvErrors[i]}</span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3 w-3" />Valid</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCsvDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCSVImport} disabled={csvImporting || csvData.length === Object.keys(csvErrors).length}>
                  {csvImporting ? 'Importing...' : `Import ${csvData.length - Object.keys(csvErrors).length} Product(s)`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={newCatDialogOpen} onOpenChange={setNewCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Category Name</Label>
            <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Beverages" autoFocus onKeyDown={e => e.key === 'Enter' && handleAddCategory()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCatDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCategory} disabled={!newCatName.trim() || newCatSaving}>{newCatSaving ? 'Saving...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { create } from 'zustand';
import { CartItem, Product, Customer } from '@/types/database';

interface CartStore {
  items: CartItem[];
  customer: Customer | null;
  discountAmount: number;
  discountPercent: number;
  notes: string;
  
  // Actions
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateItemNotes: (productId: string, notes: string) => void;
  setCustomer: (customer: Customer | null) => void;
  setDiscount: (amount: number, percent: number) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
  
  // Computed
  getSubtotal: () => number;
  getTaxAmount: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  customer: null,
  discountAmount: 0,
  discountPercent: 0,
  notes: '',

  addItem: (product, quantity = 1) => {
    set((state) => {
      const existingItem = state.items.find((item) => item.product.id === product.id);
      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          ),
        };
      }
      return { items: [...state.items, { product, quantity }] };
    });
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    }));
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      ),
    }));
  },

  updateItemNotes: (productId, notes) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, notes } : item
      ),
    }));
  },

  setCustomer: (customer) => set({ customer }),

  setDiscount: (amount, percent) => set({ discountAmount: amount, discountPercent: percent }),

  setNotes: (notes) => set({ notes }),

  clearCart: () =>
    set({
      items: [],
      customer: null,
      discountAmount: 0,
      discountPercent: 0,
      notes: '',
    }),

  getSubtotal: () => {
    return get().items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  },

  getTaxAmount: () => {
    const items = get().items;
    return items.reduce((sum, item) => {
      const itemTotal = item.product.price * item.quantity;
      const taxRate = item.product.tax_rate || 0;
      return sum + itemTotal * (taxRate / 100);
    }, 0);
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const tax = get().getTaxAmount();
    const { discountAmount, discountPercent } = get();
    
    let total = subtotal + tax;
    if (discountPercent > 0) {
      total = total * (1 - discountPercent / 100);
    }
    total = total - discountAmount;
    
    return Math.max(0, total);
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
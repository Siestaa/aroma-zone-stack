import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CartLine } from "@/lib/api/types";
import type { RootState } from "./store";

const initialState: CartLine[] = [];

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    setQty(state, action: PayloadAction<{ productVariantId: string; qty: number }>) {
      const { productVariantId, qty } = action.payload;
      const line = state.find((l) => l.productVariantId === productVariantId);
      if (!line) return;
      if (qty <= 0) {
        return state.filter((l) => l !== line);
      }
      line.qty = qty;
    },
    removeLine(state, action: PayloadAction<{ productVariantId: string }>) {
      return state.filter((l) => l.productVariantId !== action.payload.productVariantId);
    },
    addLine(state, action: PayloadAction<CartLine>) {
      const existing = state.find((l) => l.productVariantId === action.payload.productVariantId);
      if (existing) {
        existing.qty += action.payload.qty;
      } else {
        state.push(action.payload);
      }
    },
    // Bulk-replaces the cart — used to hydrate from localStorage on mount.
    replaceCart(_state, action: PayloadAction<CartLine[]>) {
      return action.payload;
    },
    clearCart() {
      return [];
    },
  },
});

export const { setQty, removeLine, addLine, replaceCart, clearCart } = cartSlice.actions;
export const cartReducer = cartSlice.reducer;

export const selectCartLines = (state: RootState) => state.cart;
export const selectCartCount = (state: RootState) => state.cart.reduce((sum, l) => sum + l.qty, 0);

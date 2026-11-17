"use client";

import { useMeQuery } from "./authApi";
import { mapServerCartItems, useAddServerCartItemMutation, useRemoveServerCartItemMutation, useUpdateServerCartItemQtyMutation } from "./cartApi";
import { addLine as addLineAction, removeLine as removeLineAction, replaceCart, setQty as setQtyAction } from "./cartSlice";
import { useAppDispatch } from "./hooks";
import type { CartLine } from "@/lib/api/types";

// Cart mutations go one of two ways: guests dispatch straight to the local
// (localStorage-backed) Redux slice, same as before server sync existed.
// Logged-in users hit the server first — the cart endpoints all return the
// full, authoritative items list after every mutation, so we just replace
// local state with that rather than trying to keep two copies of the merge/
// qty logic (one client-side, one in api/src/services/cartService.ts) in
// sync by hand.
export function useCartActions() {
  const dispatch = useAppDispatch();
  const { data: user } = useMeQuery();
  const [addServerCartItem] = useAddServerCartItemMutation();
  const [updateServerCartItemQty] = useUpdateServerCartItemQtyMutation();
  const [removeServerCartItem] = useRemoveServerCartItemMutation();

  async function addLine(line: CartLine) {
    if (user) {
      const items = await addServerCartItem({ productVariantId: line.productVariantId, qty: line.qty }).unwrap();
      dispatch(replaceCart(mapServerCartItems(items)));
    } else {
      dispatch(addLineAction(line));
    }
  }

  async function setQty(line: CartLine, qty: number) {
    if (user && line.cartItemId) {
      const items = await updateServerCartItemQty({ id: line.cartItemId, qty }).unwrap();
      dispatch(replaceCart(mapServerCartItems(items)));
    } else {
      dispatch(setQtyAction({ productVariantId: line.productVariantId, qty }));
    }
  }

  async function removeLine(line: CartLine) {
    if (user && line.cartItemId) {
      const items = await removeServerCartItem({ id: line.cartItemId }).unwrap();
      dispatch(replaceCart(mapServerCartItems(items)));
    } else {
      dispatch(removeLineAction({ productVariantId: line.productVariantId }));
    }
  }

  return { addLine, setQty, removeLine, isAuthed: Boolean(user) };
}

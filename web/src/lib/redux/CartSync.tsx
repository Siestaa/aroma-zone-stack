"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "./hooks";
import { replaceCart, selectCartLines } from "./cartSlice";
import { useMeQuery } from "./authApi";
import { mapServerCartItems, useAddServerCartItemMutation, useLazyGetServerCartQuery } from "./cartApi";

const STORAGE_KEY = "az-cart";

// Cart lives in Redux for everyone; this component is what keeps it in sync
// with the outside world on both sides:
//
// - Guests: localStorage only (hydrate once on mount, persist on every
//   subsequent change). store.subscribe (not a second useEffect keyed on the
//   selected cart value) deliberately avoids a hydration race — see the git
//   history on this file / web/CLAUDE.md's cartSlice note for why a
//   dependency-array effect here can persist the pre-hydration empty state
//   over the real one.
// - Logged-in users: once `useMeQuery()` resolves to a user we haven't
//   synced yet this session, push local lines that don't have a `cartItemId`
//   yet (genuine unsynced guest additions — server-side addToCart merges qty
//   if the account already had that variant from another device) up to the
//   server, then replace local state with the server's authoritative
//   result. Runs again after every fresh login (ref keyed on user id, reset
//   to null on logout) — including a page reload with an already-valid
//   session, so a second device's changes still show up. Only pushing
//   *unsynced* lines matters: every local line already carries a
//   `cartItemId` after the first successful sync (it's baked into
//   localStorage), so re-running this on a plain reload must not re-POST
//   them — that would double the qty server-side on every reload.
export function CartSync() {
  const store = useAppStore();
  const { data: user } = useMeQuery();
  const [addServerCartItem] = useAddServerCartItemMutation();
  const [fetchServerCart] = useLazyGetServerCartQuery();
  const syncedForUserId = useRef<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        store.dispatch(replaceCart(JSON.parse(raw)));
      } catch {
        // corrupt localStorage value — ignore, start from empty cart
      }
    }

    const unsubscribe = store.subscribe(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectCartLines(store.getState())));
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  useEffect(() => {
    if (!user) {
      syncedForUserId.current = null;
      return;
    }
    if (syncedForUserId.current === user.id) return;
    syncedForUserId.current = user.id;

    const unsyncedLines = selectCartLines(store.getState()).filter((l) => !l.cartItemId);

    (async () => {
      let items;
      for (const line of unsyncedLines) {
        items = await addServerCartItem({ productVariantId: line.productVariantId, qty: line.qty }).unwrap();
      }
      if (!items) items = await fetchServerCart().unwrap();
      store.dispatch(replaceCart(mapServerCartItems(items)));
    })().catch(() => {
      // best-effort — if the merge fails, the local (pre-merge) cart just
      // stays as-is rather than the user losing their in-progress cart
    });
  }, [user, store, addServerCartItem, fetchServerCart]);

  return null;
}

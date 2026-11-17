"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/redux/store";
import { CartSync } from "@/lib/redux/CartSync";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export function Providers({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);

  return (
    <Provider store={store}>
      <CartSync />
      <ServiceWorkerRegister />
      {children}
    </Provider>
  );
}

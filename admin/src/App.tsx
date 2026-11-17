import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./auth/LoginPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AppLayout } from "./layout/AppLayout";
import { OrdersListPage } from "./orders/OrdersListPage";
import { OrderDetailPage } from "./orders/OrderDetailPage";
import { ProductsListPage } from "./products/ProductsListPage";
import { HomeConfigPage } from "./home/HomeConfigPage";
import { InfoPagesPage } from "./pages/InfoPagesPage";
import { CatalogFiltersPage } from "./catalog/CatalogFiltersPage";
import { SettingsPage } from "./settings/SettingsPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/orders" replace />} />
          <Route path="/orders" element={<OrdersListPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/products" element={<ProductsListPage />} />
          <Route path="/home-config" element={<HomeConfigPage />} />
          <Route path="/catalog-filters" element={<CatalogFiltersPage />} />
          <Route path="/pages" element={<InfoPagesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  );
}

export default App;

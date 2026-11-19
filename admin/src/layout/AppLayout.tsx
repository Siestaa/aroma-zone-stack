import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAdminMe, useInvalidateAdminMe } from "../auth/useAdminMe";
import { ThemeToggle } from "../theme/ThemeToggle";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  const { data: me } = useAdminMe();
  const invalidateMe = useInvalidateAdminMe();
  const navigate = useNavigate();

  async function handleLogout() {
    await api.post("/auth/logout");
    invalidateMe();
    navigate("/login", { replace: true });
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/orders" className={styles.brand}>
          <img src="/favicon.png" alt="" className={styles.brandIcon} />
          аромазон-тут / admin
        </Link>
        <nav className={styles.nav}>
          <NavLink
            to="/orders"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
          >
            Заказы
          </NavLink>
          <NavLink
            to="/products"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
          >
            Товары
          </NavLink>
          <NavLink
            to="/home-config"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
          >
            Главная
          </NavLink>
          <NavLink
            to="/catalog-filters"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
          >
            Фильтры каталога
          </NavLink>
          <NavLink
            to="/pages"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
          >
            Страницы
          </NavLink>
          <NavLink
            to="/email-templates"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
          >
            Письма
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
          >
            Настройки
          </NavLink>
        </nav>
        {me && <span className={styles.email}>{me.email}</span>}
        <ThemeToggle />
        <button type="button" className={styles.logoutButton} onClick={handleLogout}>
          Выйти
        </button>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

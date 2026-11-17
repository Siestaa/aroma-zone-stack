"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useLogoutMutation } from "@/lib/redux/authApi";
import { useAppDispatch } from "@/lib/redux/hooks";
import { clearCart } from "@/lib/redux/cartSlice";
import styles from "./AccountNav.module.css";

const LINKS = [
  { href: "/account/orders", label: "Заказы" },
  { href: "/account/favorites", label: "Избранное" },
  { href: "/account/profile", label: "Личные данные" },
  { href: "/account/addresses", label: "Адреса" },
];

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [logout, { isLoading }] = useLogoutMutation();

  return (
    <nav className={styles.nav}>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={pathname === link.href ? styles.active : undefined}
          transitionTypes={["nav-back"]}
        >
          {link.label}
        </Link>
      ))}
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button type="button" className={styles.logoutBtn} disabled={isLoading}>
            Выйти
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.confirmContent} aria-describedby={undefined}>
            <Dialog.Title className={styles.confirmTitle}>
              Точно ли вы хотите выйти из аккаунта?
            </Dialog.Title>
            <div className={styles.confirmActions}>
              <Dialog.Close asChild>
                <button type="button" className={styles.cancelBtn}>
                  Отмена
                </button>
              </Dialog.Close>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={styles.confirmBtn}
                  onClick={async () => {
                    await logout();
                    // Drop the account's cart from local state/localStorage so it
                    // doesn't leak into whatever guest session (or different account)
                    // uses this browser next — the server-side cart is unaffected,
                    // it's still there next time this account logs back in.
                    dispatch(clearCart());
                    router.push("/account");
                    router.refresh();
                  }}
                >
                  Выйти
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </nav>
  );
}

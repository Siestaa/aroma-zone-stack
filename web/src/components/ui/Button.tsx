import type { ButtonHTMLAttributes } from "react";
import Link, { type LinkProps } from "next/link";
import styles from "./Button.module.css";

type Variant = "primary" | "outline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  block?: boolean;
  href?: undefined;
};

type LinkButtonProps = Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: LinkProps["href"];
  variant?: Variant;
  block?: boolean;
};

function classNames(variant: Variant, block: boolean | undefined, className: string | undefined) {
  return [styles.btn, styles[variant], block ? styles.block : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
}

export function Button(props: ButtonProps | LinkButtonProps) {
  const { variant = "primary", block, className, ...rest } = props;
  const classes = classNames(variant, block, className);

  if ("href" in rest && rest.href !== undefined) {
    const { href, ...linkRest } = rest as Omit<LinkButtonProps, "variant" | "block" | "className">;
    return <Link href={href} className={classes} {...linkRest} />;
  }

  return <button type="button" className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}

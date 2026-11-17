import type { Metadata } from "next";

export const SITE_URL = "https://xn--80aavshcdl.xn--p1ai";

export function productPath(slug: string): string {
  return `/product/${encodeURIComponent(slug)}`;
}

export function pageMetadata(path: string, title: string | { absolute: string }, description: string): Metadata {
  return { title, description, alternates: { canonical: path } };
}

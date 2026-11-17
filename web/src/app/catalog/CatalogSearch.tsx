"use client";

import { startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBox } from "@/components/search/SearchBox";

export function CatalogSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(query: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (query) params.set("q", query);
    else params.delete("q");

    // a new search changes the result set — page N from before may no longer exist
    params.delete("page");

    startTransition(() => {
      router.replace(`/catalog?${params.toString()}`);
    });
  }

  return (
    <SearchBox
      placeholder="Найти в каталоге…"
      defaultValue={searchParams.get("q") ?? ""}
      onSubmitQuery={handleSubmit}
    />
  );
}

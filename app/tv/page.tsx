import type { Metadata } from "next";
import { Suspense } from "react";
import { ModoTv } from "@/components/ModoTv";

export const metadata: Metadata = { title: "Apuração 2026 · Modo TV" };

export default function PaginaTv() {
  return (
    <Suspense>
      <ModoTv />
    </Suspense>
  );
}

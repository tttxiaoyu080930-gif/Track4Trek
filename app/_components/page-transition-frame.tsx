"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function PageTransitionFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.classList.remove("is-route-leaving");
  }, [pathname]);

  return <div className="page-transition-layer">{children}</div>;
}

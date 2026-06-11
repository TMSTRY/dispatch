"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/",         label: "Dispatchlijst" },
  { href: "/mutaties", label: "Mutatielijst"  },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 flex items-center gap-1 px-4 py-2"
      style={{ background: "rgba(8,12,20,0.72)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      {links.map(({ href, label }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              active
                ? "bg-brand-500/20 text-brand-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

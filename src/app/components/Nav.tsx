"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/assistant", label: "Assistant" },
  { href: "/calendar", label: "Calendar" },
  { href: "/contacts", label: "Contacts" },
  { href: "/todos", label: "Todos" },
  { href: "/trains", label: "Trains" },
  { href: "/didi", label: "Didi" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-[var(--mint-soft)] bg-[var(--cream)]/90 px-4 py-2.5 shadow-sm backdrop-blur-sm">
      <ul className="flex flex-wrap items-center gap-2 text-sm">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className={
                pathname === href
                  ? "rounded-lg bg-[var(--mint)] px-3 py-1.5 font-medium text-[var(--text)]"
                  : "rounded-lg px-3 py-1.5 text-[var(--text-muted)] hover:bg-[var(--mint-soft)] hover:text-[var(--text)]"
              }
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

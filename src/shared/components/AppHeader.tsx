import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";

export function AppHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="w-full">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 pt-8 pb-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/feed"
            aria-label="Scriba"
            className="flex items-center gap-2 rounded-full text-scriba-blue-ink transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 155 155"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M153.581 1.41213C152.579 0.411689 151.204 -0.079072 149.764 0.0108023C117.744 2.61952 89.9854 12.2171 67.252 28.5435C65.7797 29.6031 65.024 31.3923 65.283 33.1803C66.6973 42.8099 62.5442 54.1837 58.3911 62.6437C56.6929 57.839 54.2001 53.428 51.8172 49.8685C50.9776 48.6162 49.6082 47.8286 48.1099 47.7246C46.6045 47.6406 45.1453 48.2413 44.1507 49.3648C24.7178 71.4916 18.2847 94.7477 23.7753 122.086L1.89445 143.967C-0.631485 146.492 -0.631485 150.574 1.89445 153.099C3.15269 154.358 4.80709 154.992 6.4603 154.992C8.11352 154.992 9.76673 154.358 11.0262 153.099L66.4774 97.6473C69.0021 95.1226 73.0843 95.1226 75.6091 97.6473C78.135 100.173 78.135 104.254 75.6091 106.78L49.2653 133.124C49.7631 133.13 50.2799 133.22 50.7707 133.22C73.0772 133.22 92.9181 123.933 111.957 104.842C138.953 77.8466 151.417 48.984 154.982 5.22233C155.105 3.80799 154.588 2.41376 153.581 1.41213Z" />
            </svg>
            <span
              className="text-[19px] font-semibold leading-none"
              style={{ fontFamily: "var(--font-poppins)", letterSpacing: "-0.015em" }}
            >
              scriba
            </span>
          </Link>
          <span aria-hidden className="hidden h-6 w-px bg-scriba-hairline sm:block" />
          <AppNav />
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}

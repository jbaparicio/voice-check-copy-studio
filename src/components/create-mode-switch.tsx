import { Link } from "@tanstack/react-router";
import { PenLine, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** The choice at the top of Create: write a new draft, or check a post someone already wrote. */
export function CreateModeSwitch({ mode }: { mode: "write" | "check" }) {
  const item = (active: boolean) =>
    cn(
      "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-card text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );
  return (
    <nav
      aria-label="What do you want to do?"
      className="mb-5 inline-flex rounded-lg border bg-muted p-1"
    >
      <Link to="/create" className={item(mode === "write")} aria-current={mode === "write" ? "page" : undefined}>
        <PenLine className="size-4" aria-hidden="true" /> Write a new draft
      </Link>
      <Link
        to="/create/check"
        className={item(mode === "check")}
        aria-current={mode === "check" ? "page" : undefined}
      >
        <ShieldCheck className="size-4" aria-hidden="true" /> Check an existing post
      </Link>
    </nav>
  );
}

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ListItem {
  id: string;
  text: string;
  secondary?: string | null;
}

/** A simple add/remove list with one (or two, for "say X, not Y") text fields. */
export function SimpleList({
  id,
  items,
  onAdd,
  onRemove,
  placeholder,
  secondPlaceholder,
  empty,
  addLabel = "Add",
  render,
}: {
  id: string;
  items: ListItem[];
  onAdd: (text: string, secondary?: string) => void;
  onRemove: (id: string) => void;
  placeholder: string;
  secondPlaceholder?: string;
  empty: string;
  addLabel?: string;
  render?: (item: ListItem) => React.ReactNode;
}) {
  const [text, setText] = useState("");
  const [second, setSecond] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || (secondPlaceholder && !second.trim())) return;
    onAdd(text.trim(), secondPlaceholder ? second.trim() : undefined);
    setText("");
    setSecond("");
  }
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span className="min-w-0 break-words">{render ? render(item) : item.text}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={`Remove ${item.text}`}
                onClick={() => onRemove(item.id)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        {secondPlaceholder && <span className="sr-only">Say</span>}
        <Input
          id={`${id}-text`}
          aria-label={secondPlaceholder ? "Say this" : placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
        />
        {secondPlaceholder && (
          <Input
            id={`${id}-second`}
            aria-label="Instead of this"
            value={second}
            onChange={(e) => setSecond(e.target.value)}
            placeholder={secondPlaceholder}
          />
        )}
        <Button type="submit" variant="outline" className="shrink-0">
          <Plus className="size-4" aria-hidden="true" /> {addLabel}
        </Button>
      </form>
    </div>
  );
}

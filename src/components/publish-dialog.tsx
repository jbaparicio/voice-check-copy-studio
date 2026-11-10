import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Linkedin,
  Newspaper,
  Send,
  Twitter,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getChannel } from "@/lib/channels";
import {
  LINKEDIN_MAX_CHARS,
  PLATFORMS,
  inPreviewFrame,
  linkedInComposerUrl,
  type PlatformId,
} from "@/lib/publish";
import { getLinkedInStatus, postToLinkedIn } from "@/lib/linkedin.functions";
import { cn } from "@/lib/utils";

/** The platforms offered in the Library's Publish pop-up, in order. */
const DIALOG_PLATFORMS: { id: PlatformId; label: string; icon: LucideIcon }[] = [
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "substack", label: "Substack", icon: Newspaper },
  { id: "x", label: "X", icon: Twitter },
  { id: "blog", label: "Blog post", icon: FileText },
];

/** Publish button + pop-up for one approved piece. Nothing is sent until "Publish" is pressed. */
export function PublishButton({
  item,
  text,
  className,
}: {
  item: { id: string; brand_id: string; channel: string; status: string };
  text: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (item.status !== "approved") return null;
  return (
    <>
      <Button
        size="sm"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Send className="size-3.5" aria-hidden="true" /> Publish
      </Button>
      {open && <PublishDialog item={item} text={text} onClose={() => setOpen(false)} />}
    </>
  );
}

function PublishDialog({
  item,
  text,
  onClose,
}: {
  item: { id: string; brand_id: string; channel: string; status: string };
  text: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const statusFn = useServerFn(getLinkedInStatus);
  const postFn = useServerFn(postToLinkedIn);
  const status = useQuery({
    queryKey: ["linkedin-status", item.id],
    queryFn: () => statusFn({ data: { itemId: item.id } }),
  });

  const fits = (id: PlatformId) =>
    PLATFORMS.find((p) => p.id === id)?.channels.includes(item.channel) ?? false;
  const linkedInFits = fits("linkedin");
  const [selected, setSelected] = useState<PlatformId[]>(linkedInFits ? ["linkedin"] : []);
  const [busy, setBusy] = useState(false);
  const [postedUrl, setPostedUrl] = useState<string | null>(null);

  const canPost = Boolean(status.data?.canPost);
  const already = status.data?.posted ?? null;
  const tooLong = text.length > LINKEDIN_MAX_CHARS;
  const linkedInOn = selected.includes("linkedin");
  const done = postedUrl ?? already?.url ?? null;

  async function logOpened() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("activity_log").insert({
      brand_id: item.brand_id,
      content_item_id: item.id,
      actor: data.user.id,
      action: "opened_in_linkedin",
      details: {},
    });
  }

  async function publish() {
    if (!linkedInOn) return;
    if (!canPost) {
      // Open LinkedIn's own post box during the click so it isn't blocked.
      window.open(linkedInComposerUrl(text), "_blank", "noopener,noreferrer");
      void navigator.clipboard.writeText(text).catch(() => undefined);
      void logOpened();
      toast.success(
        "LinkedIn opened with your post filled in. Press Post there when you're happy.",
      );
      onClose();
      return;
    }
    setBusy(true);
    try {
      const res = await postFn({ data: { itemId: item.id } });
      setPostedUrl(res.url);
      toast.success(res.alreadyPosted ? "This was already on LinkedIn." : "Posted to LinkedIn.");
      void qc.invalidateQueries({ queryKey: ["linkedin-status", item.id] });
      void qc.invalidateQueries({ queryKey: ["activity", item.id] });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "LinkedIn couldn't publish this. Nothing was posted.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish this {getChannel(item.channel).short} piece</DialogTitle>
          <DialogDescription>
            Choose where it should go. Nothing is sent until you press Publish.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <p className="line-clamp-2">{text}</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Channels</legend>
          {DIALOG_PLATFORMS.map((p) => {
            const live = p.id === "linkedin";
            const fit = fits(p.id);
            const disabled = !live || !fit || Boolean(done);
            const on = selected.includes(p.id);
            const Icon = p.icon;
            let note: string;
            if (!live) note = "Coming soon — not connected yet";
            else if (done) note = "Already live on LinkedIn";
            else if (!fit)
              note = "Only LinkedIn posts can go here. Create a LinkedIn version first.";
            else if (status.isLoading) note = "Checking your LinkedIn connection…";
            else if (canPost)
              note = `Posts straight away as ${status.data?.accountName ?? "the connected account"}`;
            else note = "Opens LinkedIn with your post filled in — you press Post there";
            return (
              <label
                key={p.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                  disabled ? "cursor-not-allowed bg-muted/40" : "cursor-pointer hover:bg-muted/50",
                  on && !disabled && "border-primary bg-primary/5",
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={on && !disabled}
                  disabled={disabled}
                  onChange={() =>
                    setSelected((l) =>
                      l.includes(p.id) ? l.filter((x) => x !== p.id) : [...l, p.id],
                    )
                  }
                />
                <Icon
                  className={cn(
                    "size-5 shrink-0",
                    disabled ? "text-muted-foreground" : "text-primary",
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn("block text-sm font-medium", disabled && "text-muted-foreground")}
                  >
                    {p.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{note}</span>
                </span>
                {live ? (
                  done ? (
                    <CheckCircle2 className="size-4 text-success" aria-label="Posted" />
                  ) : (
                    <Badge className="shrink-0 bg-success-soft text-success hover:bg-success-soft">
                      Connected
                    </Badge>
                  )
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    Coming soon
                  </Badge>
                )}
              </label>
            );
          })}
        </fieldset>

        {linkedInOn && !done && canPost && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm">
            This goes live straight away on LinkedIn, visible to everyone, as text only.
          </p>
        )}
        {linkedInOn && !done && !canPost && inPreviewFrame() && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm">
            LinkedIn won't open from inside the editor preview. Open the app in its own tab — your
            text is also copied so you can paste it.
          </p>
        )}
        {linkedInOn && tooLong && !done && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm">
            This is too long for LinkedIn ({text.length.toLocaleString("en-GB")} of{" "}
            {LINKEDIN_MAX_CHARS.toLocaleString("en-GB")} characters).
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {done ? (
            <>
              <Button variant="outline" asChild>
                <a href={done} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" aria-hidden="true" /> View post
                </a>
              </Button>
              <Button onClick={onClose}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                onClick={() => void publish()}
                disabled={!linkedInOn || busy || tooLong || status.isLoading}
              >
                <Send className="size-4" aria-hidden="true" />
                {busy ? "Publishing…" : canPost ? "Publish" : "Open in LinkedIn"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { CheckCircle2, Copy, ExternalLink, PartyPopper, Send } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HelpTip } from "@/components/common";
import { LINKEDIN_MAX_CHARS, canPublish, inPreviewFrame, linkedInComposerUrl } from "@/lib/publish";
import { useHydrated } from "@tanstack/react-router";
import { getLinkedInStatus, postToLinkedIn } from "@/lib/linkedin.functions";

/**
 * Sending approved LinkedIn posts out.
 * - "Open in LinkedIn": anyone; LinkedIn's own post box opens filled in, the person presses Post.
 * - "Post now": only the owner of the connected LinkedIn account, after a confirmation.
 * Nothing is ever posted automatically.
 */
export function PublishPanel({
  itemId,
  brandId,
  channel,
  status,
  text,
}: {
  itemId: string;
  brandId: string;
  channel: string;
  status: string;
  text: string;
}) {
  if (channel !== "linkedin") return <ApprovedOtherChannel status={status} text={text} />;
  return <LinkedInPanel itemId={itemId} brandId={brandId} status={status} text={text} />;
}

/** Approved pieces for other channels: copy and publish by hand. */
function ApprovedOtherChannel({ status, text }: { status: string; text: string }) {
  if (!canPublish(status)) return null;
  return (
    <section
      aria-label="Ready to publish"
      className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-5 md:p-6"
    >
      <h2 className="flex items-center gap-2 font-sans text-lg font-semibold">
        <PartyPopper className="size-5 text-primary" aria-hidden="true" /> Approved and ready to
        publish
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Copy the text and paste it where it goes. Posting straight to LinkedIn works for LinkedIn
        posts —{" "}
        <Link to="/create" className="font-medium text-primary underline">
          create a LinkedIn version
        </Link>{" "}
        to use it.
      </p>
      <Button
        className="mt-4"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          toast.success("Copied as plain text.");
        }}
      >
        <Copy className="size-4" aria-hidden="true" /> Copy text
      </Button>
    </section>
  );
}

function LinkedInPanel({
  itemId,
  brandId,
  status,
  text,
}: {
  itemId: string;
  brandId: string;
  status: string;
  text: string;
}) {
  const qc = useQueryClient();
  const ready = canPublish(status);
  const statusFn = useServerFn(getLinkedInStatus);
  const postFn = useServerFn(postToLinkedIn);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const hydrated = useHydrated();
  const framed = hydrated && inPreviewFrame();

  const linkedIn = useQuery({
    queryKey: ["linkedin-status", itemId],
    queryFn: () => statusFn({ data: { itemId } }),
    enabled: ready,
  });

  const tooLong = text.length > LINKEDIN_MAX_CHARS;
  const posted = linkedIn.data?.posted ?? null;

  async function openInLinkedIn() {
    // Open during the click so the browser doesn't block it.
    window.open(linkedInComposerUrl(text), "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Copy is only a backup; ignore if the browser refuses.
    }
    toast.success(
      "LinkedIn opened with your post filled in. It's also copied, in case you need to paste it.",
    );
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("activity_log").insert({
        brand_id: brandId,
        content_item_id: itemId,
        actor: data.user.id,
        action: "opened_in_linkedin",
        details: {},
      });
      void qc.invalidateQueries({ queryKey: ["activity", itemId] });
    }
  }

  async function postNow() {
    setPosting(true);
    try {
      const res = await postFn({ data: { itemId } });
      toast.success(res.alreadyPosted ? "This was already on LinkedIn." : "Posted to LinkedIn.", {
        action: {
          label: "View post",
          onClick: () => window.open(res.url, "_blank", "noopener,noreferrer"),
        },
      });
      setConfirmOpen(false);
      void qc.invalidateQueries({ queryKey: ["linkedin-status", itemId] });
      void qc.invalidateQueries({ queryKey: ["activity", itemId] });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "LinkedIn couldn't publish this. Nothing was posted.",
      );
    } finally {
      setPosting(false);
    }
  }

  return (
    <section
      aria-label="Post to LinkedIn"
      className={
        ready
          ? "rounded-2xl border-2 border-primary/40 bg-primary/5 p-5 md:p-6"
          : "rounded-xl border bg-card p-5"
      }
    >
      <h2
        className={`flex items-center gap-1.5 font-sans font-semibold ${ready ? "text-lg" : "text-base"}`}
      >
        {ready && !posted ? "Approved — ready to post to LinkedIn" : "Post to LinkedIn"}
        <HelpTip>
          "Open in LinkedIn" fills in LinkedIn's own post box so you can check it, add an image and
          press Post yourself. "Post now" publishes straight away from the connected account.
        </HelpTip>
      </h2>
      {!canPublish(status) ? (
        <p className="mt-2 text-sm text-muted-foreground">
          The buttons to post on LinkedIn appear here once an approver has approved this post.
        </p>
      ) : posted ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          <p>
            Live on LinkedIn since{" "}
            {new Date(posted.postedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            .{" "}
            <a href={posted.url} target="_blank" rel="noreferrer" className="font-medium underline">
              View post
            </a>
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing goes live until you choose to post it.
          </p>
          {tooLong && (
            <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-sm">
              This is {text.length.toLocaleString("en-GB")} characters. LinkedIn allows{" "}
              {LINKEDIN_MAX_CHARS.toLocaleString("en-GB")}, so shorten it first.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant={linkedIn.data?.canPost ? "outline" : "default"}
              onClick={openInLinkedIn}
              disabled={tooLong}
            >
              <ExternalLink className="size-3.5" aria-hidden="true" /> Open in LinkedIn
            </Button>
            {linkedIn.data?.canPost && (
              <Button onClick={() => setConfirmOpen(true)} disabled={tooLong}>
                <Send className="size-3.5" aria-hidden="true" /> Post now
              </Button>
            )}
          </div>
          {framed && (
            <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm">
              LinkedIn won't open from inside the editor preview — it blocks itself there. Open the
              app in its own browser tab (or use the published site) and it works.
              {linkedIn.data?.canPost && ' "Post now" works here too.'} Your text is copied when you
              click, so you can also paste it into LinkedIn yourself.
            </p>
          )}
          {linkedIn.data?.canPost && (
            <p className="mt-2 text-xs text-muted-foreground">
              "Post now" publishes as{" "}
              {linkedIn.data.accountName ?? "the connected LinkedIn account"}.
            </p>
          )}
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !posting && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post this to LinkedIn now?</AlertDialogTitle>
            <AlertDialogDescription>
              It goes live straight away on{" "}
              {linkedIn.data?.accountName ?? "the connected LinkedIn account"}'s profile, visible to
              everyone, as text only. To add an image, use "Open in LinkedIn" instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={posting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={posting}
              onClick={(e) => {
                e.preventDefault();
                void postNow();
              }}
            >
              {posting ? "Posting…" : "Post now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

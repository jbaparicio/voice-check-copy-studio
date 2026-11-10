import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emptyFields, type ContentFields } from "./content-types";
import { LINKEDIN_MAX_CHARS, canPublish, linkedInPostUrl, plainCopy } from "./publish";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/linkedin";

function gatewayHeaders(): Record<string, string> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const linkedInKey = process.env["LINKEDIN_API_KEY"];
  if (!lovableKey || !linkedInKey) throw new Error("LinkedIn isn't connected to this app yet.");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": linkedInKey,
  };
}

async function linkedInProfile(): Promise<{ sub: string; name: string }> {
  const res = await fetch(`${GATEWAY_URL}/v2/userinfo`, { headers: gatewayHeaders() });
  if (!res.ok) {
    const body = await res.text();
    console.error(`LinkedIn profile lookup failed [${res.status}]: ${body}`);
    throw new Error(`LinkedIn didn't respond as expected (${res.status}). Try again in a moment.`);
  }
  const data = (await res.json()) as { sub?: string; name?: string };
  if (!data.sub) throw new Error("LinkedIn didn't say which account is connected.");
  return { sub: data.sub, name: data.name ?? "your LinkedIn account" };
}

/** Whether the signed-in person may post, which account it goes to, and whether this piece already went out. */
export const getLinkedInStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: canPost }, { data: post }] = await Promise.all([
      supabase.rpc("is_linkedin_poster"),
      data.itemId
        ? supabase
            .from("linkedin_posts")
            .select("post_urn, posted_at, posted_by")
            .eq("content_item_id", data.itemId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    let accountName: string | null = null;
    if (canPost) {
      try {
        accountName = (await linkedInProfile()).name;
      } catch {
        accountName = null;
      }
    }
    return {
      canPost: Boolean(canPost),
      accountName,
      posted: post ? { url: linkedInPostUrl(post.post_urn), postedAt: post.posted_at } : null,
    };
  });

/** Publish an approved LinkedIn piece right now. Only runs when the person presses the button. */
export const postToLinkedIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string }) => {
    if (typeof input?.itemId !== "string" || !input.itemId) throw new Error("Missing piece.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: canPost } = await supabase.rpc("is_linkedin_poster");
    if (!canPost) throw new Error("Only the owner of the connected LinkedIn account can post.");

    const { data: item, error } = await supabase
      .from("content_items")
      .select("id, brand_id, channel, status, fields")
      .eq("id", data.itemId)
      .maybeSingle();
    if (error || !item) throw new Error("We couldn't find that piece.");
    if (item.channel !== "linkedin")
      throw new Error("Only LinkedIn posts can be posted to LinkedIn.");
    if (!canPublish(item.status)) throw new Error("This post needs to be approved first.");

    const { data: existing } = await supabase
      .from("linkedin_posts")
      .select("post_urn")
      .eq("content_item_id", item.id)
      .maybeSingle();
    if (existing) return { url: linkedInPostUrl(existing.post_urn), alreadyPosted: true };

    const fields = { ...emptyFields(), ...(item.fields as unknown as Partial<ContentFields>) };
    const text = plainCopy(fields);
    if (!text.trim()) throw new Error("This post has no text.");
    if (text.length > LINKEDIN_MAX_CHARS) throw new Error("This post is too long for LinkedIn.");

    const profile = await linkedInProfile();
    const res = await fetch(`${GATEWAY_URL}/v2/ugcPosts`, {
      method: "POST",
      headers: {
        ...gatewayHeaders(),
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: `urn:li:person:${profile.sub}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`LinkedIn post failed [${res.status}]: ${body}`);
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          "LinkedIn refused the post. The LinkedIn connection may need reconnecting.",
        );
      }
      if (res.status === 429)
        throw new Error("LinkedIn says too many posts right now. Try again later.");
      throw new Error(`LinkedIn couldn't publish this (${res.status}). Nothing was posted.`);
    }
    const created = (await res.json().catch(() => ({}))) as { id?: string };
    const urn = res.headers.get("x-restli-id") ?? created.id;
    if (!urn) throw new Error("LinkedIn posted it but didn't return a link. Check your profile.");

    await supabase.from("linkedin_posts").insert({
      content_item_id: item.id,
      brand_id: item.brand_id,
      post_urn: urn,
      posted_by: userId,
    });
    await supabase.from("activity_log").insert({
      brand_id: item.brand_id,
      content_item_id: item.id,
      actor: userId,
      action: "posted_to_linkedin",
      details: { account: profile.name },
    });
    return { url: linkedInPostUrl(urn), alreadyPosted: false };
  });

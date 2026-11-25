import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function decodeEntities(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("This doesn't look like a Word document.");
  const text = strFromU8(xml)
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text);
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

/** Reads an uploaded guideline file and stores its text so the team can see it. */
export const extractGuideline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileId: string }) => input)
  .handler(async ({ data, context }) => {
    const { claimDemoAiAction } = await import("./demo-quota.server");
    await claimDemoAiAction(context.supabase);
    const { supabase } = context;
    const { data: file, error } = await supabase
      .from("guideline_files")
      .select("*")
      .eq("id", data.fileId)
      .single();
    if (error || !file) throw new Error("We couldn't find that file.");

    try {
      const { data: blob, error: dlError } = await supabase.storage
        .from("guidelines")
        .download(file.storage_path);
      if (dlError || !blob) throw new Error("We couldn't open the file.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const name = file.file_name.toLowerCase();
      let text: string;
      if (name.endsWith(".pdf")) text = await extractPdf(bytes);
      else if (name.endsWith(".docx")) text = await extractDocx(bytes);
      else text = new TextDecoder().decode(bytes);
      text = text
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, 200_000);
      await supabase
        .from("guideline_files")
        .update({ extracted_text: text, status: "ready" })
        .eq("id", file.id);
      return { ok: true, length: text.length };
    } catch (e) {
      console.error("Guideline extraction failed", e);
      await supabase.from("guideline_files").update({ status: "failed" }).eq("id", file.id);
      return { ok: false, length: 0 };
    }
  });

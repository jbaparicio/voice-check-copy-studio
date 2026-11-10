import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, Section } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extractGuideline } from "@/lib/guidelines.functions";
import { useQuery } from "@tanstack/react-query";
import type { GuidelineFile } from "@/lib/brand-kit";

const ACCEPT =
  ".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function useGuidelineFiles(brandId: string) {
  return useQuery({
    queryKey: ["guidelines", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guideline_files")
        .select("*")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function GuidelineUploader({
  brandId,
  compact = false,
}: {
  brandId: string;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const extract = useServerFn(extractGuideline);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    for (const file of Array.from(files)) {
      const ok = /\.(pdf|docx|txt)$/i.test(file.name);
      if (!ok) {
        toast.error(`${file.name}: please upload a PDF, Word (.docx) or text file.`);
        continue;
      }
      const path = `${brandId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("guidelines")
        .upload(path, file, file.type ? { contentType: file.type } : {});
      if (upErr) {
        toast.error(`${file.name} didn't upload. Please try again.`);
        continue;
      }
      const { data: row, error } = await supabase
        .from("guideline_files")
        .insert({
          brand_id: brandId,
          file_name: file.name,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: auth.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error || !row) {
        toast.error(`${file.name} didn't save.`);
        continue;
      }
      qc.invalidateQueries({ queryKey: ["guidelines", brandId] });
      const res = await extract({ data: { fileId: row.id } });
      if (res.ok) toast.success(`${file.name} uploaded and read.`);
      else toast.warning(`${file.name} uploaded, but we couldn't read the text inside it.`);
      qc.invalidateQueries({ queryKey: ["guidelines", brandId] });
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-dashed bg-card p-6 text-center"
          : "rounded-2xl border border-dashed bg-card p-10 text-center"
      }
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFiles(e.dataTransfer.files);
      }}
    >
      <Upload className="mx-auto size-6 text-primary" aria-hidden="true" />
      <p className="mt-3 font-medium">Drop your brand guidelines here</p>
      <p className="mt-1 text-sm text-muted-foreground">
        PDF, Word (.docx) or text files, up to 20 MB.
      </p>
      <input
        ref={input}
        id={`guideline-upload-${brandId}`}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? "Uploading…" : "Choose files"}
      </Button>
    </div>
  );
}

export function GuidelinesTab({ brandId }: { brandId: string }) {
  const files = useGuidelineFiles(brandId);
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<GuidelineFile | null>(null);

  async function remove(f: GuidelineFile) {
    await supabase.storage.from("guidelines").remove([f.storage_path]);
    await supabase.from("guideline_files").delete().eq("id", f.id);
    qc.invalidateQueries({ queryKey: ["guidelines", brandId] });
  }

  return (
    <div className="space-y-10">
      <Section
        title="Upload guidelines"
        description="Keep your brand book in one place. We'll read the text so your team can search and reference it."
        help="Soon, we'll also pull rules out of these files automatically and suggest them for your Brand Kit."
      >
        <GuidelineUploader brandId={brandId} />
      </Section>
      <Section title="Your files">
        {files.data?.length ? (
          <ul className="divide-y rounded-lg border bg-card">
            {files.data.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{f.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(f.size_bytes / 1024).toFixed(0)} KB · added{" "}
                    {new Date(f.created_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <Badge
                  variant={
                    f.status === "ready"
                      ? "secondary"
                      : f.status === "failed"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {f.status === "ready"
                    ? "Text ready"
                    : f.status === "failed"
                      ? "Couldn't read text"
                      : "Reading…"}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!f.extracted_text}
                  onClick={() => setViewing(f)}
                >
                  View text
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${f.file_name}`}
                  onClick={() => remove(f)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<FileText className="size-5" />} title="No guidelines uploaded yet">
            Upload your brand book or tone of voice guide. It's optional — your Brand Kit works
            without it.
          </EmptyState>
        )}
      </Section>

      <Dialog open={Boolean(viewing)} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{viewing?.file_name}</DialogTitle>
            <DialogDescription>The text we found in this file.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 font-sans text-sm leading-relaxed">
            {viewing?.extracted_text}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

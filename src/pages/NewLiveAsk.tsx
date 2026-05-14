import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Camera, X } from "lucide-react";
import PhotoCropper from "@/components/live-ask/PhotoCropper";

export default function NewLiveAsk() {
  const { user } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [rawPhotoSrc, setRawPhotoSrc] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [targetGender, setTargetGender] = useState<string>("");
  const [durationMin, setDurationMin] = useState<number>(1440);
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    nav("/auth");
    return null;
  }

  const onPick = (f: File | null) => {
    if (!f) return;
    if (!/\.(png|webp|jpe?g)$/i.test(f.name)) {
      toast({ title: "Use a PNG, WEBP, or JPG photo" });
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast({ title: "Photo must be under 8MB" });
      return;
    }
    setRawPhotoSrc(URL.createObjectURL(f));
  };

  const onCropConfirm = (f: File) => {
    setPhotoFile(f);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(f));
    if (rawPhotoSrc) URL.revokeObjectURL(rawPhotoSrc);
    setRawPhotoSrc(null);
  };

  const submit = async () => {
    if (!photoFile) return toast({ title: "Add a photo" });
    if (question.trim().length < 3) return toast({ title: "Add a question" });
    if (!optionA.trim() || !optionB.trim()) return toast({ title: "Add both options" });

    setSubmitting(true);
    try {
      const ext = photoFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("live-ask-photos")
        .upload(path, photoFile, { contentType: photoFile.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("live-ask-photos").getPublicUrl(path);

      const { data, error } = await supabase.functions.invoke("create-live-ask", {
        body: {
          photo_url: pub.publicUrl,
          question: question.trim(),
          option_a: optionA.trim(),
          option_b: optionB.trim(),
          target_gender: targetGender || null,
          duration_minutes: durationMin,
        },
      });
      if (error) throw error;
      const askId = (data as any)?.live_ask?.id;
      toast({ title: "Live Ask posted" });
      nav(`/live-ask/${askId}`);
    } catch (e: any) {
      const msg = e?.context?.body ? await tryJson(e.context.body) : null;
      if (msg?.code === "PHOTO_REJECTED") {
        toast({
          title: "Try a different photo",
          description: "We couldn't use this image. Please pick another — avoid faces, alcohol, big brand logos, or anything NSFW.",
          variant: "destructive",
        });
      } else {
        const reasons = Array.isArray(msg?.reasons) && msg.reasons.length ? ` — ${msg.reasons.join(", ")}` : "";
        toast({ title: (msg?.error || e?.message || "Failed to post") + reasons, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header
        className="flex items-center justify-between px-4 pb-3 border-b"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      >
        <button onClick={() => nav(-1)} className="p-2"><X className="h-5 w-5" /></button>
        <h1 className="font-semibold">Live Ask</h1>
        <Button size="sm" onClick={submit} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
        </Button>
      </header>

      <div className="p-4 space-y-5 max-w-md mx-auto">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="aspect-[4/5] w-full rounded-2xl bg-muted flex items-center justify-center overflow-hidden border relative"
        >
          {photoPreview ? (
            <>
              <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
              <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                Tap to change
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Camera className="h-8 w-8" />
              <span className="text-sm">Add a photo</span>
            </div>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        {rawPhotoSrc && (
          <PhotoCropper
            src={rawPhotoSrc}
            onCancel={() => {
              if (rawPhotoSrc) URL.revokeObjectURL(rawPhotoSrc);
              setRawPhotoSrc(null);
            }}
            onConfirm={onCropConfirm}
          />
        )}

        <div className="space-y-2">
          <Label>Question</Label>
          <Textarea
            maxLength={140}
            placeholder="Post this or not?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
          />
          <div className="text-xs text-muted-foreground text-right">{question.length}/140</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Option A</Label>
            <Input maxLength={40} value={optionA} onChange={(e) => setOptionA(e.target.value)} placeholder="Yes" />
          </div>
          <div className="space-y-2">
            <Label>Option B</Label>
            <Input maxLength={40} value={optionB} onChange={(e) => setOptionB(e.target.value)} placeholder="No" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Ask only (optional)</Label>
          <div className="flex gap-2">
            {["", "female", "male"].map((g) => (
              <button
                key={g || "any"}
                type="button"
                onClick={() => setTargetGender(g)}
                className={`flex-1 py-2 rounded-lg text-sm border ${targetGender === g ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
              >
                {g === "" ? "Everyone" : g === "female" ? "Women" : "Men"}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Photos are auto-checked for safety. No faces, logos, alcohol, or political content.
          1 free Live Ask per week — extras cost 5 credits.
        </p>
      </div>
    </div>
  );
}

async function tryJson(s: any) {
  try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return null; }
}

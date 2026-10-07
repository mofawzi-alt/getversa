// One-time / repeatable: converts heavy PNG poll pictures in storage to small JPEGs
// and points the polls at the new files. Admin only. POST { limit?: number, dry_run?: boolean }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { compressToJpeg } from "../_shared/compressImage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const URL_ = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MARK = "/storage/v1/object/public/poll-images/";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(URL_, SRK);
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "unauthorized" }, 401);
  const token = auth.replace(/^Bearer\s+/i, "");
  const isService = token === SRK;
  if (!isService) {
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json({ error: "unauthorized" }, 401);
    const { data: r } = await sb.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!r) return json({ error: "admin only" }, 403);
  }
  let body: any = {};
  try { body = await req.json(); } catch { /* ok */ }
  const limit = Math.min(Math.max(Number(body.limit) || 5, 1), 15);

  const { data: polls, error } = await sb
    .from("polls")
    .select("id, image_a_url, image_b_url")
    .or("image_a_url.ilike.%poll-images/%.png,image_b_url.ilike.%poll-images/%.png")
    .limit(limit);
  if (error) return json({ error: error.message }, 500);

  const results: any[] = [];
  for (const p of polls || []) {
    const update: Record<string, string> = {};
    for (const col of ["image_a_url", "image_b_url"] as const) {
      const url: string | null = (p as any)[col];
      if (!url || !url.includes(MARK) || !/\.png(\?|$)/i.test(url)) continue;
      const path = decodeURIComponent(url.split(MARK)[1].split("?")[0]);
      const { data: file, error: dErr } = await sb.storage.from("poll-images").download(path);
      if (dErr || !file) { results.push({ id: p.id, col, status: "download_failed" }); continue; }
      const before = file.size;
      const jpg = await compressToJpeg(new Uint8Array(await file.arrayBuffer()));
      if (!jpg) { results.push({ id: p.id, col, status: "compress_failed" }); continue; }
      const newPath = path.replace(/\.png$/i, ".jpg");
      if (body.dry_run) { results.push({ id: p.id, col, before, after: jpg.length, dry: true }); continue; }
      const { error: uErr } = await sb.storage.from("poll-images").upload(newPath, jpg, { contentType: "image/jpeg", upsert: true });
      if (uErr) { results.push({ id: p.id, col, status: "upload_failed", err: uErr.message }); continue; }
      update[col] = sb.storage.from("poll-images").getPublicUrl(newPath).data.publicUrl;
      results.push({ id: p.id, col, before, after: jpg.length, status: "ok" });
    }
    if (Object.keys(update).length) await sb.from("polls").update(update).eq("id", p.id);
  }
  const { count } = await sb.from("polls").select("id", { count: "exact", head: true })
    .or("image_a_url.ilike.%poll-images/%.png,image_b_url.ilike.%poll-images/%.png");
  return json({ processed: polls?.length || 0, remaining: count ?? null, results });
});

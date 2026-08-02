import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BloodGroup } from "@/lib/brand";

const BUCKET = "rakhtha-donor-media";

export type DonorWallCard = {
  id: string;
  full_name: string;
  city: string | null;
  area: string | null;
  blood_group: BloodGroup | null;
  photo_url: string | null;
  blood_proof_url: string | null;
  blood_proof_status: string | null;
  blood_attested_at: string | null;
};

function extFromFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".pdf")) return "pdf";
  return "jpg";
}

export function isImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(jpe?g|png|webp)(\?|$)/i.test(url) || url.includes("/proof-") || url.includes("/photo-");
}

export async function uploadDonorMedia(
  userId: string,
  kind: "photo" | "proof",
  file: File,
): Promise<string> {
  if (userId.startsWith("demo-")) {
    throw new Error("Demo account cannot upload. Use a real registered login.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File must be under 5 MB.");
  }
  const okTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (kind === "photo" && file.type === "application/pdf") {
    throw new Error("Profile photo must be an image (JPG/PNG/WebP).");
  }
  if (!okTypes.includes(file.type)) {
    throw new Error("Use JPG, PNG, WebP, or PDF (proof only).");
  }

  const supabase = getSupabaseBrowserClient();
  const ext = extFromFile(file);
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function listDonorWall(): Promise<DonorWallCard[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("rakhtha_donor_wall")
    .select(
      "id,full_name,city,area,blood_group,photo_url,blood_proof_url,blood_proof_status,blood_attested_at",
    )
    .order("blood_attested_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DonorWallCard[];
}

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

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(file.name);
}

function mimeForUpload(file: File, kind: "photo" | "proof"): string {
  if (file.type) return file.type;
  if (kind === "photo" || isImageFile(file)) return "image/jpeg";
  if (file.name.toLowerCase().endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

/** Center-square crop — works on mobile gallery (HEIC, empty MIME). */
async function cropImageToSquare(file: File, size = 720): Promise<File> {
  if (!isImageFile(file)) return file;

  const drawToSquare = async (source: CanvasImageSource, w: number, h: number) => {
    const side = Math.min(w, h);
    const sx = Math.floor((w - side) / 2);
    const sy = Math.floor((h - side) * 0.18);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}-square.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  };

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        return await drawToSquare(bitmap, bitmap.width, bitmap.height);
      } finally {
        bitmap.close();
      }
    } catch {
      // HEIC / some Android gallery formats — fall through
    }
  }

  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    URL.revokeObjectURL(url);
    return await drawToSquare(img, img.naturalWidth, img.naturalHeight);
  } catch {
    return file;
  }
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
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("File must be under 8 MB.");
  }
  if (kind === "photo") {
    if (!isImageFile(file)) {
      throw new Error("Profile photo must be an image from camera or gallery.");
    }
  } else if (!isImageFile(file) && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Use a photo from gallery or a PDF for proof.");
  }

  const uploadFile =
    kind === "photo" && isImageFile(file) ? await cropImageToSquare(file) : file;

  const supabase = getSupabaseBrowserClient();
  const ext = extFromFile(uploadFile);
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const contentType = mimeForUpload(uploadFile, kind);

  const { error } = await supabase.storage.from(BUCKET).upload(path, uploadFile, {
    cacheControl: "3600",
    upsert: true,
    contentType,
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

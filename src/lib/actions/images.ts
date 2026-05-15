"use server";

import sharp from "sharp";
import vision from "@google-cloud/vision";

import { getAuthClient } from "@/lib/actions/auth";

export type OptimizeListingPhotoResult =
  | { dataUrl: string }
  | { error: string };

export type DeleteListingImageResult = { ok: true } | { error: string };

const LISTING_IMAGE_BUCKET = "gown-images";
const OUT_W = 1200;
const OUT_H = 1600;
const BLUR_PAD = 0.1;
const BLUR_SIGMA = 18;
const MAX_OPTIMIZE_INPUT_BYTES = 10 * 1024 * 1024;

type Region = { left: number; top: number; width: number; height: number };

let visionClient: InstanceType<typeof vision.ImageAnnotatorClient> | null =
  null;

function getVisionClient(): InstanceType<typeof vision.ImageAnnotatorClient> {
  if (visionClient) return visionClient;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Google Cloud Vision env vars are missing (GOOGLE_CLOUD_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY).",
    );
  }

  visionClient = new vision.ImageAnnotatorClient({
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey },
    fallback: "rest",
  });
  return visionClient;
}

export async function optimizeListingPhoto(
  formData: FormData,
): Promise<OptimizeListingPhotoResult> {
  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };

  const file = formData.get("image");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return { error: "Please upload a valid image file." };
  }
  if (file.size === 0 || file.size > MAX_OPTIMIZE_INPUT_BYTES) {
    return { error: "Image must be between 1 byte and 10 MB." };
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());

    const resized = await sharp(input)
      .resize(OUT_W, OUT_H, { fit: "cover", position: "attention" })
      .toBuffer();

    const faces = await detectFaces(resized);

    const blurred =
      faces.length === 0 ? resized : await blurFaces(resized, faces);

    const webp = await sharp(blurred)
      .webp({ quality: 85, effort: 6 })
      .toBuffer();

    return { dataUrl: `data:image/webp;base64,${webp.toString("base64")}` };
  } catch (e) {
    console.error("optimizeListingPhoto failed:", e);
    return {
      error:
        e instanceof Error && e.message
          ? e.message
          : "Image optimization failed.",
    };
  }
}

async function detectFaces(buffer: Buffer): Promise<Region[]> {
  try {
    const client = getVisionClient();
    const [result] = await client.faceDetection({ image: { content: buffer } });

    if (result.error?.message) {
      console.warn("Vision returned non-fatal error:", result.error.message);
    }

    const annotations = result.faceAnnotations ?? [];
    if (annotations.length === 0) {
      console.log("optimizeListingPhoto: no faces detected; skipping blur.");
    }

    return annotations
      .map((f) => regionFromVertices(f.fdBoundingPoly?.vertices))
      .filter((r): r is Region => r !== null);
  } catch (e) {
    console.warn(
      "Vision face detection failed; continuing without blur:",
      describeVisionError(e),
    );
    return [];
  }
}

function describeVisionError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const err = e as Error & {
    code?: unknown;
    details?: unknown;
    note?: unknown;
    cause?: unknown;
  };
  const parts: string[] = [];
  if (typeof err.code !== "undefined") parts.push(`code=${String(err.code)}`);
  if (err.message && err.message !== "undefined undefined: undefined") {
    parts.push(err.message);
  }
  if (typeof err.details === "string" && err.details) {
    parts.push(`details=${err.details}`);
  }
  if (typeof err.note === "string" && err.note) parts.push(`note=${err.note}`);
  if (err.cause instanceof Error && err.cause.message) {
    parts.push(`cause=${err.cause.message}`);
  }
  return parts.length > 0 ? parts.join(" | ") : err.toString();
}

async function blurFaces(canvas: Buffer, faces: Region[]): Promise<Buffer> {
  const composites = await Promise.all(
    faces.map(async (face) => {
      const region = padAndClamp(face);
      const tile = await sharp(canvas)
        .extract(region)
        .blur(BLUR_SIGMA)
        .toBuffer();
      return {
        input: tile,
        left: region.left,
        top: region.top,
        blend: "over" as const,
      };
    }),
  );
  return sharp(canvas).composite(composites).toBuffer();
}

function regionFromVertices(
  vertices: { x?: number | null; y?: number | null }[] | null | undefined,
): Region | null {
  if (!vertices?.length) return null;

  const xs = vertices.map((v) => v.x ?? 0);
  const ys = vertices.map((v) => v.y ?? 0);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;

  return width > 0 && height > 0 ? { left, top, width, height } : null;
}

function padAndClamp({ left, top, width, height }: Region): Region {
  const l = Math.max(0, Math.round(left - width * BLUR_PAD));
  const t = Math.max(0, Math.round(top - height * BLUR_PAD));
  const w = Math.max(
    1,
    Math.min(OUT_W - l, Math.round(width * (1 + 2 * BLUR_PAD))),
  );
  const h = Math.max(
    1,
    Math.min(OUT_H - t, Math.round(height * (1 + 2 * BLUR_PAD))),
  );
  return { left: l, top: t, width: w, height: h };
}

/**
 * Removes a previously uploaded listing image from Supabase Storage.
 *
 * Safe to call with any URL: non-Supabase URLs (e.g. legacy Cloudinary)
 * are skipped silently. Security is enforced by the storage RLS policy
 * "Users can delete own images" — only the original uploader can delete
 * their own files.
 */
export async function deleteListingImage(
  imageUrl: string,
): Promise<DeleteListingImageResult> {
  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    return { ok: true };
  }

  const path = listingImagePathFromUrl(imageUrl);
  if (!path) return { ok: true };

  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase.storage
    .from(LISTING_IMAGE_BUCKET)
    .remove([path]);

  if (error) {
    console.warn("deleteListingImage failed:", error.message);
    return { error: error.message };
  }
  return { ok: true };
}

function listingImagePathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const marker = `/storage/v1/object/public/${LISTING_IMAGE_BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const tail = u.pathname.slice(idx + marker.length);
    return tail ? decodeURIComponent(tail) : null;
  } catch {
    return null;
  }
}

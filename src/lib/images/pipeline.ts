import "server-only";
import sharp from "sharp";
import vision from "@google-cloud/vision";

import { MAX_BLUR_DATA_URL_LENGTH } from "@/lib/types";

import type { OverlayOptions, ResizeOptions, SharpOptions } from "sharp";

/**
 * The listing image pipeline, shared by the seller upload (optimizeListingPhoto)
 * and the admin reprocess action. Buffer in, buffer out: neither a browser nor
 * Supabase Storage is a concern here.
 *
 * `visionOk: false` means face detection could not run (credentials, network,
 * quota, or an error carried in the response body). It is deliberately distinct
 * from a successful detection that found zero faces, because a caller that
 * exists to guarantee a blur has to tell those two apart.
 */
export type ProcessedListingImage = {
  image: Buffer;
  contentType: typeof OUTPUT_CONTENT_TYPE;
  facesDetected: number;
  visionOk: boolean;
};

const OUTPUT_CONTENT_TYPE = "image/avif";
const OUT_W = 1200;
const OUT_H = 1600;
const BLUR_PAD = 0.1;
const BLUR_SIGMA = 32;
const PLACEHOLDER_DIM = 32;
const MIN_COVER_KEEP = 0.85;
const FILL_COLOR = "#efe7dc";

type Region = { left: number; top: number; width: number; height: number };

type FaceDetectionResult = { ok: boolean; regions: Region[] };

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

/**
 * `autoOrient` matters: sharp leaves EXIF orientation alone by default, so a
 * phone JPEG that reached storage without passing through here would otherwise
 * be cropped sideways and rewritten that way permanently. The crop stays raw
 * pixels until the single AVIF encode, so no lossy step compounds on another.
 */
export async function processListingImage(
  input: Buffer,
): Promise<ProcessedListingImage> {
  const source = sharp(input, { autoOrient: true });
  const { autoOrient } = await source.metadata();
  const { data, info } = await source
    .resize(OUT_W, OUT_H, resizeOptions(autoOrient.width, autoOrient.height))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raw = {
    raw: { width: info.width, height: info.height, channels: info.channels },
  };

  const faces = await detectFaces(
    await sharp(data, raw).jpeg({ quality: 90 }).toBuffer(),
  );

  const canvas = sharp(data, raw);
  if (faces.regions.length > 0) {
    canvas.composite(await blurredFaceTiles(data, raw, faces.regions));
  }
  const image = await canvas.avif({ quality: 65, effort: 2 }).toBuffer();

  return {
    image,
    contentType: OUTPUT_CONTENT_TYPE,
    facesDetected: faces.regions.length,
    visionOk: faces.ok,
  };
}

/**
 * Crops to 3:4 when that keeps most of the photo. A far-off ratio (a very tall
 * or wide shot) is letterboxed in the card's own fill instead, so a full-length
 * gown is never cut to the busiest region.
 */
function resizeOptions(width: number, height: number): ResizeOptions {
  const ratio = width / height;
  const target = OUT_W / OUT_H;
  const kept = Math.min(ratio / target, target / ratio);

  return kept >= MIN_COVER_KEEP
    ? { fit: "cover", position: "attention" }
    : { fit: "contain", background: FILL_COLOR };
}

/**
 * The server-side twin of the client's canvas placeholder. Returns null rather
 * than an oversized string so a caller never stores something the seller form's
 * own bound would have rejected.
 */
export async function blurPlaceholderDataUrl(
  image: Buffer,
): Promise<string | null> {
  try {
    const tiny = await sharp(image)
      .resize(PLACEHOLDER_DIM, PLACEHOLDER_DIM, { fit: "inside" })
      .jpeg({ quality: 60 })
      .toBuffer();

    const dataUrl = `data:image/jpeg;base64,${tiny.toString("base64")}`;
    return dataUrl.length > MAX_BLUR_DATA_URL_LENGTH ? null : dataUrl;
  } catch (e) {
    console.warn("blurPlaceholderDataUrl failed:", e);
    return null;
  }
}

async function detectFaces(buffer: Buffer): Promise<FaceDetectionResult> {
  try {
    const client = getVisionClient();
    const [result] = await client.faceDetection({ image: { content: buffer } });

    // Vision reports some failures in the response body rather than by
    // throwing. Treating that as "zero faces" would let a caller commit an
    // unblurred image believing detection had run.
    if (result.error?.message) {
      console.warn("Vision returned an error:", result.error.message);
      return { ok: false, regions: [] };
    }

    const annotations = result.faceAnnotations ?? [];

    return {
      ok: true,
      regions: annotations
        .map((f) => regionFromVertices(f.fdBoundingPoly?.vertices))
        .filter((r): r is Region => r !== null),
    };
  } catch (e) {
    console.warn(
      "Vision face detection failed; continuing without blur:",
      describeVisionError(e),
    );
    return { ok: false, regions: [] };
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

/** PNG tiles, so the blur adds no compression loss of its own. */
function blurredFaceTiles(
  data: Buffer,
  raw: SharpOptions,
  faces: Region[],
): Promise<OverlayOptions[]> {
  return Promise.all(
    faces.map(async (face) => {
      const region = padAndClamp(face);
      const tile = await sharp(data, raw)
        .extract(region)
        .blur(BLUR_SIGMA)
        .png()
        .toBuffer();
      return { input: tile, left: region.left, top: region.top, blend: "over" };
    }),
  );
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

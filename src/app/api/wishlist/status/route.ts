import { NextResponse, type NextRequest } from "next/server";

import { getWishlistStatus } from "@/lib/queries/wishlist";
import { WISHLIST_MAX_ITEMS } from "@/lib/types";
import { isValidUUID } from "@/lib/utils";

import type { WishlistStatusResponse } from "@/lib/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("ids");

  if (!raw) {
    return NextResponse.json<WishlistStatusResponse>({ items: [] });
  }

  const ids = Array.from(
    new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );

  if (ids.length > WISHLIST_MAX_ITEMS) {
    return NextResponse.json(
      { error: `At most ${WISHLIST_MAX_ITEMS} ids are allowed per request.` },
      { status: 400 },
    );
  }

  if (ids.some((id) => !isValidUUID(id))) {
    return NextResponse.json({ error: "Invalid listing id." }, { status: 400 });
  }

  let items: WishlistStatusResponse["items"];
  try {
    items = await getWishlistStatus(ids);
  } catch {
    return NextResponse.json(
      { error: "Failed to load wishlist status." },
      { status: 502 },
    );
  }

  return NextResponse.json<WishlistStatusResponse>(
    { items },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}

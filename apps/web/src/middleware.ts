import { NextResponse, type NextRequest } from "next/server";
import { isBlockedPerimeterPath } from "@/lib/perimeter";

export function middleware(request: NextRequest) {
  if (isBlockedPerimeterPath(request.nextUrl.pathname)) {
    return new NextResponse(null, {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};

import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_BASE ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type RouteContext = {
  params: {
    path: string[];
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const upstreamPath = params.path.join("/");
  const upstreamUrl = new URL(`${API_BASE}/api/${upstreamPath}`);
  upstreamUrl.search = request.nextUrl.search;

  try {
    const upstream = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: {
        accept: request.headers.get("accept") ?? "*/*"
      }
    });

    const body = await upstream.arrayBuffer();
    const response = new NextResponse(body, { status: upstream.status });
    const contentType = upstream.headers.get("content-type");

    if (contentType) {
      response.headers.set("content-type", contentType);
    }

    return response;
  } catch {
    return NextResponse.json(
      { detail: "Failed to reach upstream API from proxy route" },
      { status: 502 }
    );
  }
}

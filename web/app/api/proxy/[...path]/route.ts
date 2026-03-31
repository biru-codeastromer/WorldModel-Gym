import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_BASE ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type RouteContext = {
  params: {
    path: string[];
  };
};

function getUpstreamUrl(request: NextRequest, params: RouteContext["params"]) {
  const normalizedPath = params.path[0] === "api" ? params.path.slice(1) : params.path;
  const upstreamPath = normalizedPath.join("/");
  const upstreamUrl = new URL(`${API_BASE}/api/${upstreamPath}`);
  upstreamUrl.search = request.nextUrl.search;
  return upstreamUrl;
}

function copyRequestHeaders(request: NextRequest) {
  const headers = new Headers();
  for (const header of ["accept", "authorization", "x-api-key", "x-upload-token"]) {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }
  return headers;
}

async function forwardRequest(
  request: NextRequest,
  { params }: RouteContext,
  method: "GET" | "POST"
) {
  const upstreamUrl = getUpstreamUrl(request, params);
  const headers = copyRequestHeaders(request);

  try {
    let body: FormData | string | ArrayBuffer | undefined;

    if (method === "POST") {
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("multipart/form-data")) {
        body = await request.formData();
      } else if (contentType.includes("application/json") || contentType.includes("text/")) {
        body = await request.text();
        if (contentType) {
          headers.set("content-type", contentType);
        }
      } else {
        const buffer = await request.arrayBuffer();
        body = buffer.byteLength > 0 ? buffer : undefined;
        if (contentType) {
          headers.set("content-type", contentType);
        }
      }
    }

    const upstream = await fetch(upstreamUrl, {
      method,
      cache: "no-store",
      headers,
      body
    });

    const responseBody = await upstream.arrayBuffer();
    const response = new NextResponse(responseBody, { status: upstream.status });
    const contentType = upstream.headers.get("content-type");
    const requestId = upstream.headers.get("x-request-id");

    if (contentType) {
      response.headers.set("content-type", contentType);
    }
    if (requestId) {
      response.headers.set("x-request-id", requestId);
    }

    return response;
  } catch {
    return NextResponse.json(
      { detail: "Failed to reach upstream API from proxy route" },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return forwardRequest(request, context, "GET");
}

export async function POST(request: NextRequest, context: RouteContext) {
  return forwardRequest(request, context, "POST");
}

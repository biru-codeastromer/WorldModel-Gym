import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/proxy/[...path]/route";

// API_BASE is read at module load time; the proxy route defaults to
// http://localhost:8000 when no env vars are set.
const API_BASE = "http://localhost:8000";

const fetchMock = vi.fn();

function upstreamResponse(
  body: string,
  init?: { status?: number; headers?: Record<string, string> }
) {
  return new Response(body, {
    status: init?.status ?? 200,
    headers: init?.headers ?? { "content-type": "application/json" }
  });
}

function ctx(path: string[]) {
  return { params: { path } };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("proxy GET", () => {
  it("strips a leading 'api' segment and rebuilds the upstream URL with the search string", async () => {
    fetchMock.mockResolvedValueOnce(upstreamResponse("[]"));

    const request = new NextRequest("http://localhost/api/proxy/api/leaderboard?track=control");
    await GET(request, ctx(["api", "leaderboard"]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as URL;
    expect(calledUrl.toString()).toBe(`${API_BASE}/api/leaderboard?track=control`);
  });

  it("forwards only allow-listed request headers", async () => {
    fetchMock.mockResolvedValueOnce(upstreamResponse("{}"));

    const request = new NextRequest("http://localhost/api/proxy/runs/r1", {
      headers: {
        accept: "application/json",
        authorization: "Bearer tok",
        "x-api-key": "secret",
        "x-upload-token": "up",
        cookie: "should-not-forward",
        "x-evil": "drop-me"
      }
    });
    await GET(request, ctx(["runs", "r1"]));

    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = opts.headers as Headers;
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("authorization")).toBe("Bearer tok");
    expect(headers.get("x-api-key")).toBe("secret");
    expect(headers.get("x-upload-token")).toBe("up");
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("x-evil")).toBeNull();
  });

  it("mirrors upstream status and propagates content-type and x-request-id response headers", async () => {
    fetchMock.mockResolvedValueOnce(
      upstreamResponse('{"ok":true}', {
        status: 201,
        headers: { "content-type": "application/json", "x-request-id": "abc-123" }
      })
    );

    const request = new NextRequest("http://localhost/api/proxy/runs/r1");
    const res = await GET(request, ctx(["runs", "r1"]));

    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("x-request-id")).toBe("abc-123");
    expect(await res.text()).toBe('{"ok":true}');
  });

  it("returns a 502 with a detail message when the upstream fetch throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connection refused"));

    const request = new NextRequest("http://localhost/api/proxy/runs/r1");
    const res = await GET(request, ctx(["runs", "r1"]));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ detail: "Failed to reach upstream API from proxy route" });
  });
});

describe("proxy POST", () => {
  it("forwards a JSON body and re-applies the content-type header", async () => {
    fetchMock.mockResolvedValueOnce(upstreamResponse('{"id":"r2"}', { status: 201 }));

    const request = new NextRequest("http://localhost/api/proxy/runs", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({ env: "e" })
    });
    await POST(request, ctx(["runs"]));

    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect(opts.body).toBe(JSON.stringify({ env: "e" }));
    expect((opts.headers as Headers).get("content-type")).toBe("application/json");
    expect((opts.headers as Headers).get("x-api-key")).toBe("k");
  });

  it("takes the multipart branch (calls request.formData, not text) and does not copy the content-type", async () => {
    fetchMock.mockResolvedValueOnce(upstreamResponse('{"id":"r3"}'));

    // undici's real multipart parser can't run under jsdom (cross-realm File
    // checks fail), so we drive the branch selection directly: set a
    // multipart content-type header and stub the body-reading methods to assert
    // the route reads formData() rather than text()/arrayBuffer().
    const request = new NextRequest("http://localhost/api/proxy/runs/r3/upload", {
      method: "POST",
      headers: {
        "x-api-key": "k",
        "content-type": "multipart/form-data; boundary=----abc"
      }
    });
    const forwarded = new FormData();
    forwarded.append("metrics_file", new File(["{}"], "m.json"));
    const formDataSpy = vi.spyOn(request, "formData").mockResolvedValue(forwarded);
    const textSpy = vi.spyOn(request, "text");
    const arrayBufferSpy = vi.spyOn(request, "arrayBuffer");

    const res = await POST(request, ctx(["runs", "r3", "upload"]));

    expect(res.status).toBe(200);
    expect(formDataSpy).toHaveBeenCalledTimes(1);
    expect(textSpy).not.toHaveBeenCalled();
    expect(arrayBufferSpy).not.toHaveBeenCalled();

    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect(opts.body).toBe(forwarded);
    // For multipart, the route does NOT copy the incoming content-type so fetch
    // can recompute the boundary for the re-serialized FormData.
    expect((opts.headers as Headers).get("content-type")).toBeNull();
    expect((opts.headers as Headers).get("x-api-key")).toBe("k");
  });

  it("falls back to arrayBuffer for binary/unknown content types and copies the content-type", async () => {
    fetchMock.mockResolvedValueOnce(upstreamResponse("ok"));

    const request = new NextRequest("http://localhost/api/proxy/runs/r4/raw", {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array([1, 2, 3])
    });
    const res = await POST(request, ctx(["runs", "r4", "raw"]));

    expect(res.status).toBe(200);
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect(opts.body).toBeInstanceOf(ArrayBuffer);
    expect((opts.body as ArrayBuffer).byteLength).toBe(3);
    expect((opts.headers as Headers).get("content-type")).toBe("application/octet-stream");
  });
});

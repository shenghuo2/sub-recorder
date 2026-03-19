import { NextRequest, NextResponse } from "next/server";

function getBackendUrl() {
  return process.env.BACKEND_URL || "http://127.0.0.1:3456";
}

async function proxyRequest(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const backendUrl = getBackendUrl();
  const url = `${backendUrl}/api/${path.join("/")}${request.nextUrl.search}`;
  
  console.log(`[Proxy GET] ${url}`);
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  try {
    const res = await proxyRequest(url, { headers });
    const data = await res.json();
    console.log(`[Proxy GET] ${url} -> ${res.status}`);
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[Proxy GET] ${url} failed:`, error);
    return NextResponse.json(
      { success: false, error: "Backend unavailable" },
      { status: 502 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = `${getBackendUrl()}/api/${path.join("/")}`;
  
  console.log(`[Proxy POST] ${url}`);
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  try {
    const body = await request.text();
    const res = await proxyRequest(url, {
      method: "POST",
      headers,
      body,
    });
    const data = await res.json();
    console.log(`[Proxy POST] ${url} -> ${res.status}`);
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[Proxy POST] ${url} failed:`, error);
    return NextResponse.json(
      { success: false, error: "Backend unavailable" },
      { status: 502 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = `${getBackendUrl()}/api/${path.join("/")}`;
  
  console.log(`[Proxy PUT] ${url}`);
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  try {
    const body = await request.text();
    const res = await proxyRequest(url, {
      method: "PUT",
      headers,
      body,
    });
    const data = await res.json();
    console.log(`[Proxy PUT] ${url} -> ${res.status}`);
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[Proxy PUT] ${url} failed:`, error);
    return NextResponse.json(
      { success: false, error: "Backend unavailable" },
      { status: 502 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = `${getBackendUrl()}/api/${path.join("/")}`;
  
  console.log(`[Proxy DELETE] ${url}`);
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  try {
    const res = await proxyRequest(url, {
      method: "DELETE",
      headers,
    });
    const data = await res.json();
    console.log(`[Proxy DELETE] ${url} -> ${res.status}`);
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[Proxy DELETE] ${url} failed:`, error);
    return NextResponse.json(
      { success: false, error: "Backend unavailable" },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import { getBrand, updateBrand, type Brand } from "@/lib/server/brand";

export async function GET() {
  try {
    const ws = await getActiveWorkspace();
    return NextResponse.json({ ok: true, brand: await getBrand(ws) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const b = (await req.json()) as Brand;
    if (!b || typeof b.tenantName !== "string") {
      return NextResponse.json({ ok: false, error: "Brand name is required." }, { status: 400 });
    }
    await updateBrand(ws, b);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}


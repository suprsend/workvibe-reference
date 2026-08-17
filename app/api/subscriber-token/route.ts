import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import jwt from "jsonwebtoken";
import { getActiveWorkspace, getWorkspaceSecrets, publicEnvPrefix } from "@/lib/server/workspace";

// ES256 subscriber JWT for the @suprsend/react Inbox SDK, per active workspace.
export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const distinctId = new URL(req.url).searchParams.get("distinct_id");
    if (!distinctId) {
      return NextResponse.json({ error: "distinct_id required" }, { status: 400 });
    }
    const { signingKeyB64, signingKeyUid } = getWorkspaceSecrets(ws);

    const prefix = publicEnvPrefix(ws);
    const publicApiKey = process.env[`${prefix}_PUBLIC_KEY`];
    if (!publicApiKey) {
      return NextResponse.json({ error: "public key not configured" }, { status: 500 });
    }

    const privateKey = Buffer.from(signingKeyB64, "base64").toString("utf-8");
    const now = Math.floor(Date.now() / 1000);
    // scope the subscriber to the tenant whose notifications it should see — the
    // feed is tenant-scoped (our triggers send to tenant_id:"default").
    //
    // demo only: distinct_id arrives as a query param, so any caller can mint a
    // token for any subscriber. in production derive it from the authenticated
    // server-side session instead — never from client input.
    const token = jwt.sign(
      { entity_type: "subscriber", entity_id: distinctId, iat: now, exp: now + 60 * 60, scope: { tenant_id: "default" } },
      privateKey,
      { algorithm: "ES256", header: { alg: "ES256", typ: "JWT", kid: signingKeyUid } },
    );

    return NextResponse.json({ token, distinctId, publicApiKey });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

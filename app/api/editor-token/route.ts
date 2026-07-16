import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import jwt from "jsonwebtoken";
import { getActiveWorkspace, getWorkspaceSecrets } from "@/lib/server/workspace";

// ES256-signed JWT for @suprsend/react-editor (accessToken prop), per active workspace.
// No tenant variants in WorkVibe → variant_scope is empty (master variant).
export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const { workspaceKey, signingKeyUid, signingKeyB64 } = getWorkspaceSecrets(ws);
    const recipient = new URL(req.url).searchParams.get("recipient") || "preview-user";

    const privateKey = Buffer.from(signingKeyB64, "base64").toString("utf-8");
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      workspace_uid: workspaceKey,
      entity_type: "template",
      entity_id: "*",
      iat: now,
      exp: now + 60 * 60,
      scope: {
        variant_scope: {},
        recipients: [{ distinct_id: recipient }],
      },
    };

    const accessToken = jwt.sign(payload, privateKey, {
      algorithm: "ES256",
      header: { alg: "ES256", typ: "JWT", kid: signingKeyUid },
    });

    return NextResponse.json({ accessToken, workspaceUid: workspaceKey });
  } catch (e) {
    const msg = errMsg(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

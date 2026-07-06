import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SignedDataVerifier,
  Environment,
  VerificationException,
} from "@apple/app-store-server-library";
import { getAppleRootCertificates } from "@/lib/apple-root-certs";
import { subscriptionService } from "@/services/subscription.service";

// apps/mobile/app.json -> expo.ios.bundleIdentifier / apps/mobile/eas.json -> submit.production.ios.ascAppId
const BUNDLE_ID = "com.Sara.assetapp";
const APP_APPLE_ID = 6785747999;

// Peeks the notification's claimed environment WITHOUT verifying the
// signature, purely to pick which SignedDataVerifier config to construct.
// This is safe: the real security check happens in verifyAndDecodeNotification
// below, which independently validates the environment against its own
// verified payload and throws if the claimed and configured environments
// don't match — a forged peek can't bypass that.
function peekEnvironment(signedPayload: string): Environment {
  try {
    const payloadB64 = signedPayload.split(".")[1];
    if (!payloadB64) return Environment.PRODUCTION;
    const json = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    return json?.data?.environment === "Sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;
  } catch {
    return Environment.PRODUCTION;
  }
}

export async function POST(req: NextRequest) {
  const rootCerts = getAppleRootCertificates();
  if (rootCerts.length === 0) {
    // Not configured yet (no APPLE_ROOT_CA_CERTS_BASE64) — ack without
    // processing so Apple doesn't retry forever once this URL is registered.
    return NextResponse.json({ error: "not configured" }, { status: 200 });
  }

  const body = (await req.json().catch(() => null)) as { signedPayload?: string } | null;
  if (!body?.signedPayload) {
    return NextResponse.json({ error: "missing signedPayload" }, { status: 400 });
  }

  const environment = peekEnvironment(body.signedPayload);
  const verifier = new SignedDataVerifier(
    rootCerts,
    true,
    environment,
    BUNDLE_ID,
    environment === Environment.PRODUCTION ? APP_APPLE_ID : undefined
  );

  try {
    const decoded = await verifier.verifyAndDecodeNotification(body.signedPayload);

    const signedTransactionInfo = decoded.data?.signedTransactionInfo;
    if (signedTransactionInfo) {
      const transaction = await verifier.verifyAndDecodeTransaction(signedTransactionInfo);
      await subscriptionService.upsertFromNotification(decoded, transaction);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof VerificationException) {
      return NextResponse.json({ error: "verification failed" }, { status: 400 });
    }
    throw e;
  }
}

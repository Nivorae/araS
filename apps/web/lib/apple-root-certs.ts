// Apple's public root CA certificates, required to verify the authenticity of
// App Store Server Notifications. These are NOT secrets — they're Apple's own
// public certificates — but they must be provided as raw DER bytes, which
// can't be safely hand-typed into source (a single wrong byte would silently
// weaken or break verification). Download the current root certificate from
// Apple's official PKI page: https://www.apple.com/certificateauthority/
// (currently "Apple Root CA - G3"), then base64-encode it, e.g.:
//   base64 -i AppleRootCA-G3.cer | tr -d '\n'
// Store the result in APPLE_ROOT_CA_CERTS_BASE64 (comma-separated if you ever
// need more than one certificate, e.g. during a root rotation).
export function getAppleRootCertificates(): Buffer[] {
  const raw = process.env.APPLE_ROOT_CA_CERTS_BASE64;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Buffer.from(s, "base64"));
}

const encoder = new TextEncoder();

function bufferToBase64Url(buffer: ArrayBuffer) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64url");
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function deriveStaffCookieValue(secret: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return bufferToBase64Url(hash);
}

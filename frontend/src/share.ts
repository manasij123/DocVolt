import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import { API_BASE_URL } from "./api";
import { DocumentMeta } from "./api";

export async function shareDocument(doc: DocumentMeta) {
  try {
    if (Platform.OS === "web") {
      const url = `${API_BASE_URL}/documents/${doc.id}/file`;
      if (typeof window !== "undefined") {
        window.open(url, "_blank");
      }
      return;
    }

    const url = `${API_BASE_URL}/documents/${doc.id}/file`;
    const safeName = (doc.original_name || `${doc.display_name}.pdf`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const localPath = `${FileSystem.cacheDirectory}${safeName}`;

    const downloadRes = await FileSystem.downloadAsync(url, localPath);

    if (!downloadRes || !downloadRes.uri) {
      Alert.alert("Download failed", "Could not download the PDF.");
      return;
    }

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
      return;
    }

    await Sharing.shareAsync(downloadRes.uri, {
      mimeType: "application/pdf",
      dialogTitle: doc.display_name,
      UTI: "com.adobe.pdf",
    });
  } catch (err: any) {
    Alert.alert("Share failed", err?.message || "Could not share file");
  }
}

export function fileUrl(docId: string) {
  return `${API_BASE_URL}/documents/${docId}/file`;
}

/**
 * Bulk-share multiple documents as a single ZIP archive.
 *
 * Calls POST /api/documents/bulk-download (which streams a .zip), saves the
 * archive to the cache directory, then opens the native share sheet so the
 * user can send the bundle to WhatsApp / mail / Drive / etc.
 *
 * Web: just triggers a browser download via window.open since native share is
 * not available — the bulkDownloadDocs() helper in /app/website/src/api.ts
 * already covers the web flow.
 */
export async function shareDocumentsBulk(docIds: string[], token: string | null): Promise<void> {
  if (!docIds.length) return;
  if (Platform.OS === "web") {
    // Reuse browser download UX on web (no native share sheet there).
    Alert.alert("Multi-share", "Use the web app's bulk download for now — the native share sheet is mobile-only.");
    return;
  }

  // Download ZIP from backend into the cache dir.
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `docvault-bundle-${ts}.zip`;
  const localPath = `${FileSystem.cacheDirectory}${fileName}`;

  // FileSystem.uploadAsync doesn't fit (we POST JSON, get binary back) so use fetch + write.
  const url = `${API_BASE_URL}/documents/bulk-download`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ doc_ids: docIds }),
    });
  } catch (e: any) {
    Alert.alert("Share failed", e?.message || "Network error");
    return;
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j?.detail) msg = j.detail; } catch {}
    Alert.alert("Share failed", msg);
    return;
  }
  // Convert response body to base64 → write to cache dir.
  const buf = await res.arrayBuffer();
  // Convert ArrayBuffer to base64 in a way that handles large binaries.
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  }
  // btoa exists on RN (polyfilled) and on web.
  const b64 = (typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64"));
  await FileSystem.writeAsStringAsync(localPath, b64, { encoding: FileSystem.EncodingType.Base64 });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert("Sharing unavailable", "Sharing is not available on this device. The ZIP was saved to cache.");
    return;
  }
  await Sharing.shareAsync(localPath, {
    mimeType: "application/zip",
    dialogTitle: `Share ${docIds.length} document${docIds.length !== 1 ? "s" : ""}`,
    UTI: "public.zip-archive",
  });
}

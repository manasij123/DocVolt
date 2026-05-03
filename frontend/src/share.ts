import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import { API_BASE_URL } from "./api";
import { DocumentMeta } from "./api";

// react-native-share is a native-only module (no web bundle). We lazy-load
// it inside the mobile-only share code path so Metro's web bundle never
// has to resolve it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ShareLib: any = null;
function getShareLib() {
  if (_ShareLib) return _ShareLib;
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _ShareLib = require("react-native-share").default;
  } catch {
    _ShareLib = null;
  }
  return _ShareLib;
}

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
 * Bulk-share multiple documents as INDIVIDUAL PDF files (not a ZIP).
 *
 * Downloads each selected PDF to the device cache, then opens the native
 * share sheet with all files at once — exactly like selecting multiple
 * files from the phone's Files / Gallery app. Uses `react-native-share`
 * because the built-in `expo-sharing` only supports one file per call.
 *
 * On the web we still fall back to the old server-side ZIP (browsers
 * can't multi-share natively).
 *
 * @param docs  Metadata for the selected documents (must include id &
 *              original_name). Passing full DocumentMeta avoids an extra
 *              round-trip for filename lookup.
 * @param token Auth token for the backend.
 */
export async function shareDocumentsBulk(
  docs: DocumentMeta[] | string[],
  token: string | null,
): Promise<void> {
  if (!docs.length) return;

  // Normalise inputs — callers historically passed string[] (ids only), but
  // we now accept full DocumentMeta[] so we can derive pretty filenames.
  const items: { id: string; name: string }[] = (docs as any[]).map((d) => {
    if (typeof d === "string") return { id: d, name: `${d}.pdf` };
    return {
      id: d.id,
      name:
        (d.original_name && d.original_name.toLowerCase().endsWith(".pdf")
          ? d.original_name
          : `${d.display_name || d.original_name || d.id}.pdf`) || `${d.id}.pdf`,
    };
  });

  // Web fallback: no native multi-file share, so we give the user a message
  // directing them to the one-by-one share or the web bulk-download button.
  if (Platform.OS === "web") {
    Alert.alert(
      "Multi-share",
      "Native multi-file share is only available on mobile. Use the bulk download button on the web app.",
    );
    return;
  }

  // Download all selected PDFs to the cache dir in parallel. We give each
  // file a sanitised name so the share sheet / receiving app shows the
  // correct document title (WhatsApp, mail, etc. use the filename verbatim).
  const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, "_");
  let localUris: string[] = [];
  try {
    const results = await Promise.all(
      items.map(async ({ id, name }) => {
        const url = `${API_BASE_URL}/documents/${id}/file${token ? `?token=${encodeURIComponent(token)}` : ""}`;
        const localPath = `${FileSystem.cacheDirectory}${safeName(name)}`;
        const r = await FileSystem.downloadAsync(url, localPath, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!r || !r.uri) throw new Error(`Download failed: ${name}`);
        return r.uri;
      }),
    );
    localUris = results;
  } catch (err: any) {
    Alert.alert("Share failed", err?.message || "Could not download one or more files");
    return;
  }

  // Native multi-file share — opens the OS share sheet with N PDFs attached,
  // exactly how the Gallery / Files app behaves when you multi-select.
  const Share = getShareLib();
  if (!Share) {
    // Shouldn't reach here on web (handled above) or on plain mobile; but
    // guard anyway so a broken install doesn't crash the UI.
    Alert.alert("Share failed", "Native share is not available on this device.");
    return;
  }
  try {
    await Share.open({
      urls: localUris,                // ← array of file:// URIs
      type: "application/pdf",
      failOnCancel: false,             // user dismissing is not an error
      title: `Share ${items.length} document${items.length !== 1 ? "s" : ""}`,
      subject: `DocVault — ${items.length} document${items.length !== 1 ? "s" : ""}`,
    });
  } catch (err: any) {
    // react-native-share throws on dismiss too on some devices — swallow
    // the generic "User did not share" but surface real failures.
    const msg = String(err?.message || err || "");
    if (/cancel|dismiss|did not share/i.test(msg)) return;

    // Graceful fallback: if the native multi-share for some reason can't
    // handle N files on this device, share them one-by-one via expo-sharing.
    try {
      for (const uri of localUris) {
        const canShare = await Sharing.isAvailableAsync();
        if (!canShare) break;
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
      }
    } catch {
      Alert.alert("Share failed", msg || "Could not share the files");
    }
  }
}

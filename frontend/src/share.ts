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

// Email confirmation / password recovery deep link:  iqacademy://auth/callback#access_token=…   (or ?code=… with PKCE)
// M5 ships a working version so links never dead-end; M6 owns the final wording and design.
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { handleAuthUrl } from "@/core/authUrl";
import { useTheme } from "@/theme/ThemeProvider";
import { Button, Text } from "@/ui";

export default function AuthCallback() {
  const { p } = useTheme(); const router = useRouter(); const url = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    handleAuthUrl(url).then((r) => {
      if (!alive) return;
      if (r.kind === "session") router.replace(r.type === "recovery" ? "/reset-password" : "/");
      else if (r.kind === "error") setError(r.message);
      else router.replace("/");
    });
    return () => { alive = false; };
  }, [url, router]);
  return (
    <View style={{ flex: 1, backgroundColor: p.c.bg, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
      {error ? (<><Text weight="medium" align="center">{error}</Text><Button onPress={() => router.replace("/login")}>Back to sign in</Button></>) : <ActivityIndicator color={p.c.accent} />}
    </View>
  );
}

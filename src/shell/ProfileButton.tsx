// Port of web ProfileButton: your photo (or initials). Opens Profile, where theme, password and sign out live.
import { Pressable } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useAuth } from "@/core/auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Avatar } from "@/ui";

export function ProfileButton() {
  const { p } = useTheme(); const router = useRouter(); const here = usePathname() === "/profile"; const { name, avatar } = useAuth();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel="Profile" onPress={() => router.navigate("/profile")}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: here ? p.c.accent : "transparent", backgroundColor: pressed && !here ? p.c.sunken : "transparent" })}>
      <Avatar name={name || "?"} url={avatar} size={30} />
    </Pressable>
  );
}

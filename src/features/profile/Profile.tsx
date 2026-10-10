// src/features/profile/Profile.tsx
// Port of web src/pages/Profile.tsx @d14323f (sign-out and theme live here; Door PIN card for instructors/coordinators; registration number and check-in PIN for students only).
// Native-only additions (recorded in port/PARITY.md as diverged): Notifications (push on/off for this phone) and Delete my account (store rule); photo comes from the phone's library.
import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { primaryRole, roleLabel, useAuth } from "@/core/auth";
import { ok, rawMessage, touched } from "@/core/errors";
import { online, queueUpload, signOutAndWipe, useQuery, useRpc } from "@/data";
import { avatarJob } from "@/data/uploads";
import { updatePassword } from "@/core/authActions";
import { MatchHint, PasswordCreator, PasswordField } from "@/features/auth/PasswordFields";
import { ChangePinForm, PinSetup } from "@/features/student/Pin";
import { currentPushState, disablePush, enablePush } from "@/native/notify";
import type { PushState } from "@/native/pushArgs";
import { isStrong } from "@/shared/web/password";
import { useTheme, type ThemePref } from "@/theme/ThemeProvider";
import { Avatar, Button, Card, Err, Field, Icon, type IconName, PageHeader, Sheet, Text, useFeedback } from "@/ui";
import { DELETE_WARNING, deleteMyAccount } from "./deleteAccount";
import { needsDoorPin } from "./doorPin";
import SecurityCard from "@/features/security/SecurityCard";
import MyCentres from "./MyCentres";

function PinCard({ title, text, has, onPress }: { title: string; text: string; has: boolean; onPress: () => void }) {
  const { p } = useTheme();
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: p.a("accent", 0.1), alignItems: "center", justifyContent: "center" }}><Icon name="lock" size={22} color={p.c.accent} /></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" lh={20}>{title}</Text><Text size={14} tone="muted">{text}</Text></View>
      <Button variant="secondary" onPress={onPress} style={{ height: 36, paddingHorizontal: 16 }}>{has ? "Change" : "Set PIN"}</Button>
    </Card>
  );
}

export default function Profile() {
  const { p, pref, setPref } = useTheme(); const { session, name, avatar, roles, refresh } = useAuth(); const { run, confirm, toast } = useFeedback();
  const uid = session!.user.id;
  const isStudent = primaryRole(roles) === "student"; const doorStaff = needsDoorPin(roles);
  const [full, setFull] = useState(name); const [phone, setPhone] = useState(""); const [phoneSeen, setPhoneSeen] = useState<string | null>(null);
  const [err, setErr] = useState(""); const [pwOpen, setPwOpen] = useState(false); const [pinOpen, setPinOpen] = useState(false); const [doorOpen, setDoorOpen] = useState(false);
  const [push, setPush] = useState<PushState | null>(null);

  const phoneQ = useQuery<string>({ key: ["profile-phone", uid], tags: ["profile"], ttlMs: 5 * 60_000, fn: async (sb) => ((ok(await sb.from("profiles").select("phone").eq("id", uid).maybeSingle()) as { phone: string | null } | null)?.phone ?? "") });
  const regQ = useQuery<string>({ key: ["student-number", uid], enabled: isStudent, tags: ["enrolments"], ttlMs: 10 * 60_000, fn: async (sb) => ((ok(await sb.from("students").select("student_number").eq("id", uid).maybeSingle()) as { student_number: string | null } | null)?.student_number ?? "") });
  const regNo = isStudent ? regQ.data ?? "" : "";
  const hasPinQ = useRpc<boolean>("has_pin", {}, { enabled: isStudent && !!regNo, tags: ["pin"], ttlMs: 0 });
  const doorQ = useRpc<boolean>("has_staff_pin", {}, { enabled: doorStaff, tags: ["pin"], ttlMs: 0 });
  const hasPin = hasPinQ.data === undefined ? null : hasPinQ.data === true; const hasDoorPin = doorQ.data === undefined ? null : doorQ.data === true;

  // The form holds what was typed; it follows the server value (name from the profile, phone once loaded) until the person starts editing.
  const [nameSeen, setNameSeen] = useState(name);
  if (nameSeen !== name) { setNameSeen(name); setFull(name); }
  const phone0 = phoneQ.data ?? "";
  if (phoneQ.data !== undefined && phoneSeen !== phoneQ.data) { setPhoneSeen(phoneQ.data); setPhone(phoneQ.data); }
  useEffect(() => { currentPushState(uid).then(setPush).catch(() => setPush("unavailable")); }, [uid]);

  const upload = async () => {
    setErr("");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const r = await run("Uploading photo…", async () => {
      const job = avatarJob({ userId: uid, mime: a.mimeType ?? "image/jpeg", size: a.fileSize ?? 1, now: Date.now() });
      await queueUpload(job, a.uri, { tags: ["profile"] });
      refresh();
    }, { success: "Photo updated", quiet: true });
    if (!r.ok) setErr(r.message);
  };
  const save = async () => {
    setErr("");
    const r = await run("Saving profile…", async () => {
      const patch: Record<string, unknown> = { full_name: full.trim() };
      if (phone.trim() !== phone0) patch.phone = phone.trim() || null;
      await online(async (sb) => touched(await sb.from("profiles").update(patch).eq("id", uid).select("id")), { invalidates: ["profile"] });
      refresh(); phoneQ.refetch();
    }, { success: "Profile saved", quiet: true });
    if (!r.ok) setErr(r.message);
  };
  const togglePush = async () => {
    if (push === "on") { const r = await run("Turning off…", () => disablePush(uid), { success: "Notifications are off on this phone." }); if (r.ok) setPush(await currentPushState(uid)); return; }
    const r = await run("Turning on…", () => enablePush(uid));
    if (r.ok) { setPush(r.data); if (r.data !== "on") toast("Notifications weren't turned on. You can allow them in your phone's settings.", "bad"); }
  };
  const deleteAccount = async () => {
    if (!(await confirm({ title: "Delete your account?", message: DELETE_WARNING, confirmLabel: "Delete my account", danger: true }))) return;
    await run("Deleting your account…", deleteMyAccount);
  };

  const themes: [ThemePref, IconName, string][] = [["light", "sun", "Light"], ["dark", "moon", "Dark"], ["system", "monitor", "System"]];
  return (
    <View style={{ gap: 20 }}>
      <PageHeader title="Profile" />
      <Card style={{ alignItems: "center", gap: 12, padding: 24 }}>
        <Avatar name={name || "?"} url={avatar} size={96} />
        <Button variant="secondary" onPress={upload} style={{ height: 40 }}>Change photo</Button>
        <Text size={14} tone="muted" align="center">{roleLabel[primaryRole(roles)]} · {session!.user.email}</Text>
      </Card>

      {isStudent && !!regNo && (
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={14} tone="muted">Registration number</Text>
            <Text size={20} weight="semibold" tracking={0.025} num selectable>{regNo}</Text>
          </View>
          <Button variant="secondary" onPress={() => { Clipboard.setStringAsync(regNo).then(() => toast("Copied")).catch(() => {}); }} style={{ height: 36, paddingHorizontal: 16 }}>Copy</Button>
        </Card>
      )}
      {isStudent && !!regNo && hasPin !== null && <PinCard title="Check-in PIN" has={hasPin} text={hasPin ? "Set. Needed if someone has to check you in by hand." : "Not set yet. Set one so you can be checked in by hand."} onPress={() => setPinOpen(true)} />}
      <Sheet open={pinOpen} onClose={() => setPinOpen(false)} title={hasPin ? "Change your PIN" : "Set your PIN"}>
        {hasPin ? <ChangePinForm onDone={() => setPinOpen(false)} /> : <PinSetup onDone={() => { hasPinQ.refetch(); setPinOpen(false); }} />}
      </Sheet>
      {doorStaff && hasDoorPin !== null && <PinCard title="Door PIN" has={hasDoorPin} text={hasDoorPin ? "Set. Asked before the class code is shown or a student is checked in by hand." : "Not set yet. You'll be asked to choose one when you first open check-in."} onPress={() => setDoorOpen(true)} />}
      <Sheet open={doorOpen} onClose={() => setDoorOpen(false)} title={hasDoorPin ? "Change your door PIN" : "Set your door PIN"}>
        {hasDoorPin ? <ChangePinForm staff onDone={() => setDoorOpen(false)} /> : <PinSetup staff onDone={() => { doorQ.refetch(); setDoorOpen(false); }} />}
      </Sheet>

      <MyCentres />

      <Card style={{ gap: 16 }}>
        <Field label="Full name" value={full} onChangeText={setFull} autoComplete="name" textContentType="name" autoCapitalize="words" />
        <Field label="Phone" placeholder="Optional" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
        <Err>{err}</Err>
        <Button disabled={!full.trim()} onPress={save}>Save changes</Button>
      </Card>

      <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <View style={{ flex: 1 }}><Text size={16} weight="semibold">Password</Text><Text size={14} tone="muted">Keep your account secure.</Text></View>
        <Button variant="secondary" onPress={() => setPwOpen(true)}>Change password</Button>
      </Card>
      <ChangePasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />

      <Card style={{ gap: 12 }}>
        <Text size={16} weight="semibold">Appearance</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Theme" style={{ flexDirection: "row", gap: 4, borderRadius: 12, backgroundColor: p.c.sunken, padding: 4 }}>
          {themes.map(([v, ic, l]) => (
            <Pressable key={v} accessibilityRole="radio" accessibilityState={{ checked: pref === v }} onPress={() => setPref(v)}
              style={{ flex: 1, height: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, backgroundColor: pref === v ? p.c.surface : "transparent" }}>
              <Icon name={ic} size={18} color={pref === v ? p.c.ink : p.c.muted} /><Text size={14} weight="medium" tone={pref === v ? "ink" : "muted"}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <SecurityCard />

      <Card style={{ gap: 12 }}>
        <Text size={16} weight="semibold">Notifications</Text>
        <Text size={14} tone="muted">{push === "on" ? "This phone gets class and payment updates as notifications." : push === "blocked" ? "Notifications are blocked for this app in your phone's settings." : push === "unavailable" ? "Notifications aren't available on this phone." : "Turn on notifications to hear about classes and payments on this phone."}</Text>
        {push === "blocked" ? <Button variant="secondary" onPress={() => { Linking.openSettings().catch(() => {}); }}>Open phone settings</Button>
          : push && push !== "unavailable" ? <Button variant={push === "on" ? "secondary" : "primary"} onPress={togglePush}>{push === "on" ? "Turn off on this phone" : "Turn on notifications"}</Button> : null}
      </Card>

      <Button variant="ghost" onPress={() => run("Signing out…", () => signOutAndWipe(confirm))} style={{ backgroundColor: "transparent" }}>
        <Text size={15} weight="medium" tone="bad">Sign out</Text>
      </Button>
      <Button variant="ghost" onPress={deleteAccount}>Delete my account</Button>
    </View>
  );
}

function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Change password">
      {open && <ChangePasswordForm onClose={onClose} />}
    </Sheet>
  );
}

// Mounted only while the sheet is open, so every opening starts empty.
function ChangePasswordForm({ onClose }: { onClose: () => void }) {
  const { p } = useTheme(); const { run } = useFeedback();
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [err, setErr] = useState(""); const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const t = setTimeout(onClose, 1400); return () => clearTimeout(t); }, [done, onClose]);
  const submit = async () => {
    setErr("");
    if (!isStrong(pw)) return setErr("Your password needs to meet every item on the checklist.");
    if (pw !== pw2) return setErr("The two passwords don't match.");
    const r = await run("Updating password…", () => updatePassword(pw), { quiet: true });
    if (!r.ok) return setErr(rawMessage(r.error));
    setDone(true);
  };
  if (done) return (
    <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.a("ok", 0.15), alignItems: "center", justifyContent: "center" }}><Icon name="check" size={28} color={p.c.ok} /></View>
      <Text size={18} weight="medium">Password updated</Text>
    </View>
  );
  return (
    <View style={{ gap: 16 }}>
      <PasswordCreator label="New password" value={pw} onValue={setPw} onGenerate={setPw2} />
      <PasswordField label="Confirm password" value={pw2} onValue={setPw2} autoComplete="new-password" textContentType="newPassword" />
      <MatchHint a={pw} b={pw2} />
      <Err>{err}</Err>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button variant="secondary" onPress={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onPress={submit} disabled={!isStrong(pw) || pw !== pw2} style={{ flex: 1 }}>Update</Button>
      </View>
    </View>
  );
}

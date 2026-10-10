// Instructor: send chosen messages on to other classes' chats. They arrive as ordinary new messages from the instructor (stamped when sent, no "forwarded" mark).
// Files are copied into the target class's folder so its students can open them. Each chat gets the messages in their original order and stops at its first
// failure, so a chat never gets a gap in the middle. Pure: the network and file steps are injected, so the rules are tested without a phone.
import { chatMediaPath } from "@/data/uploads";
import type { ClassMessage } from "./format";

export type Media = { bytes: ArrayBuffer; mime: string; size: number };
export type SendDeps = {
  newId: () => string;
  /** The file behind a message. */
  fetchMedia: (m: ClassMessage) => Promise<Media>;
  /** Put a file at a path; "already exists" must count as success (an earlier try got through). */
  upload: (path: string, media: Media) => Promise<void>;
  send: (args: Record<string, unknown>) => Promise<void>;
};

/**
 * `ids` remembers the client id chosen for each (chat, message). Keep the same Map between a failed attempt and the retry: the server then ignores the messages
 * that already went through, and their files keep the same path, so nothing is posted twice.
 */
export async function sendToChats(msgs: ClassMessage[], targetIds: string[], d: SendDeps, ids: Map<string, string> = new Map()): Promise<{ ok: string[]; failed: string[] }> {
  const ordered = [...msgs].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const files = new Map<string, Media>();
  const ok: string[] = [], failed: string[] = [];
  for (const target of targetIds) {
    try {
      for (const m of ordered) {
        const key = `${target}:${m.id}`; let id = ids.get(key); if (!id) { id = d.newId(); ids.set(key, id); }
        let media: { path: string; name: string; mime: string; size: number } | null = null;
        if (m.media_path) {
          let f = files.get(m.id); if (!f) { f = await d.fetchMedia(m); files.set(m.id, f); }
          const name = m.media_name ?? "file", path = chatMediaPath(target, id, name);
          await d.upload(path, f);
          media = { path, name, mime: f.mime, size: f.size };
        }
        await d.send({ p_session_id: target, p_body: m.body, p_media_path: media?.path ?? null, p_media_name: media?.name ?? null, p_media_mime: media?.mime ?? null, p_media_size: media?.size ?? null, p_client_id: id });
      }
      ok.push(target);
    } catch { failed.push(target); }
  }
  return { ok, failed };
}

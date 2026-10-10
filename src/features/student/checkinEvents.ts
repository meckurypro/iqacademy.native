// src/features/student/checkinEvents.ts
// Replaces the web's `checkin:done` window event. The check-in call already invalidates the "attendance" tag, so every card that depends on it refreshes;
// this stays as the one place to hook anything else that must react the moment a check-in finishes on this phone.
type Listener = () => void;
const listeners = new Set<Listener>();
export const onCheckInDone = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const checkInDone = () => { listeners.forEach((l) => l()); };

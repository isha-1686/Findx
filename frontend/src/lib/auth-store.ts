import { useSyncExternalStore } from "react";
import { api, getStoredToken } from "./api";

export type SessionUser = { id: string; email?: string; display_name?: string } | null;

let user: SessionUser = null;
let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setLocalUser(nextUser: SessionUser) {
  user = nextUser;
  emit();
}

/**
 * Single app-wide auth subscription connecting to FastAPI backend.
 */
export function initAuthStore(opts: { onIdentityChange?: () => void } = {}) {
  if (initialized) return;
  initialized = true;

  const token = getStoredToken();
  if (!token) {
    user = null;
    emit();
    return;
  }

  api.auth
    .me()
    .then((userData) => {
      user = userData;
      emit();
    })
    .catch(() => {
      user = null;
      emit();
    });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useAuthUser(): SessionUser {
  return useSyncExternalStore(
    subscribe,
    () => user,
    () => null,
  );
}

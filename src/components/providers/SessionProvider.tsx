"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { Profile } from "@/types/database";
import { getSession } from "@/actions/auth-actions";

interface SessionContextValue {
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  profile: null,
  loading: true,
  refresh: async () => {},
});

// 模块级缓存：跨组件实例共享，避免每次路由切换都重新请求
let cachedProfile: Profile | null = null;
let cachedLoading = true;
let fetchPromise: Promise<void> | null = null;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(cachedProfile);
  const [loading, setLoading] = useState<boolean>(cachedLoading);

  const doFetch = useCallback(async () => {
    try {
      const result = await getSession();
      if (result.success && result.profile) {
        cachedProfile = result.profile;
        setProfile(result.profile);
      } else {
        cachedProfile = null;
        setProfile(null);
      }
    } catch {
      cachedProfile = null;
      setProfile(null);
    } finally {
      cachedLoading = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 如果已有缓存数据，直接使用，不再重复请求
    if (cachedProfile !== null || !cachedLoading) {
      setLoading(false);
      return;
    }
    // 避免并发重复请求
    if (!fetchPromise) {
      fetchPromise = doFetch().finally(() => {
        fetchPromise = null;
      });
    }
  }, [doFetch]);

  const refresh = useCallback(async () => {
    cachedLoading = true;
    setLoading(true);
    await doFetch();
  }, [doFetch]);

  return (
    <SessionContext.Provider value={{ profile, loading, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

import { createClient } from "@openauthjs/openauth/client";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { env } from "~/env";

export const client = createClient({
  clientID: "react",
  issuer: env.VITE_AUTH_URL,
});

/** Replace with a more precise type if you wish */
type User = { id: string } & Record<string, unknown>;

interface AuthContextType {
  getToken: () => Promise<string | undefined>;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  user: User | undefined;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | undefined>();
  const initializing = useRef(true);
  const accessToken = useRef<string | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    // Protect against double initialization (e.g. in React Strict Mode)
    if (!initializing.current) return;
    initializing.current = false;

    if (code && state) {
      handleCallback(code, state);
    } else {
      initAuth();
    }
  }, []);

  const initAuth = async () => {
    const newToken = await refreshTokens();
    if (newToken) {
      await fetchUser();
    }
    setIsLoading(true);
  };

  const refreshTokens = async (): Promise<string | undefined> => {
    const refresh = localStorage.getItem("refresh");
    if (!refresh) return undefined;
    const result = await client.refresh(refresh, {
      access: accessToken.current,
    });
    if (result.err) return undefined;
    if (result.tokens) {
      accessToken.current = result.tokens.access;
      localStorage.setItem("refresh", result.tokens.refresh);
      return result.tokens.access;
    }
    return accessToken.current;
  };

  const getToken = async () => {
    const newToken = await refreshTokens();
    if (!newToken) {
      await signIn();
      return;
    }
    return newToken;
  };

  const handleCallback = async (code: string, state: string) => {
    const storedChallenge = sessionStorage.getItem("challenge");
    if (!storedChallenge) {
      window.location.replace("/");
      return;
    }
    const challenge = JSON.parse(storedChallenge);
    if (state === challenge.state && challenge.verifier) {
      const exchanged = await client.exchange(
        code,
        window.location.origin,
        challenge.verifier,
      );
      if (!exchanged.err && exchanged.tokens) {
        accessToken.current = exchanged.tokens.access;
        localStorage.setItem("refresh", exchanged.tokens.refresh);
      }
    }
    window.location.replace("/");
  };

  const fetchUser = async () => {
    try {
      const res = await fetch(`${env.VITE_API_URL}/account`, {
        headers: { Authorization: `Bearer ${accessToken.current}` },
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("user", JSON.stringify(data));
        setUser(data);
      }
    } catch {
      // Handle errors if necessary
    }
  };

  const signIn = async () => {
    const { challenge, url } = await client.authorize(
      window.location.origin,
      "code",
      { pkce: true },
    );
    sessionStorage.setItem("challenge", JSON.stringify(challenge));
    window.location.href = url;
  };

  const signOut = () => {
    localStorage.removeItem("refresh");
    accessToken.current = undefined;
    window.location.replace("/");
  };

  return (
    <AuthContext.Provider
      value={{ getToken, isLoading, signIn, signOut, user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return auth;
}

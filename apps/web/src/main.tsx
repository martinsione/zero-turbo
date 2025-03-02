import { Zero } from "@repo/zero";
import { ZeroProvider } from "@repo/zero/react";
import { schema } from "@repo/zero/schema";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { AuthProvider, client } from "~/context/auth";
import { env } from "~/env";
import "~/styles/index.css";

import Auth from "./pages/auth";
import Home from "./pages/home";

const zero = new Zero({
  userID: JSON.parse(localStorage.getItem("user") ?? "{}")?.email ?? "anon",
  auth: async () => {
    const refresh = localStorage.getItem("refresh");
    if (!refresh) return undefined;
    const result = await client.refresh(refresh);
    if (result.err) return undefined;
    if (result.tokens) {
      localStorage.setItem("refresh", result.tokens.refresh);
      return result.tokens.access;
    }
    return undefined;
  },
  kvStore: env.PROD ? "idb" : "mem",
  schema,
  server: env.VITE_ZERO_URL,
});

// biome-ignore lint/style/noNonNullAssertion: <explanation>
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ZeroProvider zero={zero}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
          </Routes>
        </BrowserRouter>
      </ZeroProvider>
    </AuthProvider>
  </StrictMode>,
);

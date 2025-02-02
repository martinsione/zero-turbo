import { Zero } from "@repo/zero";
import { ZeroProvider } from "@repo/zero/react";
import { schema } from "@repo/zero/schema";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App.tsx";
import "./index.css";

const { PROD, VITE_ZERO_URL } = import.meta.env;

const zero = new Zero({
  userID: "anon",
  auth: () => {
    return undefined;
  },
  kvStore: PROD ? "idb" : "mem",
  schema,
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  server: VITE_ZERO_URL!,
});

// biome-ignore lint/style/noNonNullAssertion: <explanation>
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ZeroProvider zero={zero}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ZeroProvider>
  </StrictMode>,
);

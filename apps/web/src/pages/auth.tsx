import { useState } from "react";
import { useAuth } from "~/context/auth";

function App() {
  const auth = useAuth();
  const [status, setStatus] = useState("");

  async function callApi() {
    const res = await fetch("http://localhost:3001/", {
      headers: {
        Authorization: `Bearer ${await auth.getToken()}`,
      },
    });

    setStatus(res.ok ? "success" : "error");
  }

  return !auth.isLoading ? (
    <div>Loading...</div>
  ) : (
    <div>
      {auth.user?.id ? (
        <div>
          <p>
            <span>Logged in</span>
            {auth.user?.id && <span> as {JSON.stringify(auth.user)}</span>}
          </p>
          {status !== "" && <p>API call: {status}</p>}
          <button type="button" onClick={callApi}>
            Call API
          </button>
          <button type="button" onClick={auth.signOut}>
            Logout
          </button>
        </div>
      ) : (
        <button type="button" onClick={auth.signIn}>
          Login with OAuth
        </button>
      )}
    </div>
  );
}
export default App;

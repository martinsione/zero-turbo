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

  return !auth.loaded ? (
    <div>Loading...</div>
  ) : (
    <div>
      {auth.loggedIn ? (
        <div>
          <p>
            <span>Logged in</span>
            {auth.userId && <span> as {auth.userId}</span>}
          </p>
          {status !== "" && <p>API call: {status}</p>}
          <button type="button" onClick={callApi}>
            Call API
          </button>
          <button type="button" onClick={auth.logout}>
            Logout
          </button>
        </div>
      ) : (
        <button type="button" onClick={auth.login}>
          Login with OAuth
        </button>
      )}
    </div>
  );
}
export default App;

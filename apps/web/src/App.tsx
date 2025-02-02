import { useQuery, useZero } from "@repo/zero/react";
import { nanoid } from "nanoid";
import { useState } from "react";

function CreateUser() {
  const [value, setValue] = useState("");
  const z = useZero();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        z.mutate.user.insert({
          id: nanoid(),
          workspace_id: "default",
          time_created: Date.now(),
          email: value,
        });
        setValue("");
      }}
    >
      <label htmlFor="email">Email</label>
      <input
        className="border"
        id="email"
        name="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit">Submit</button>
    </form>
  );
}

function App() {
  const z = useZero();
  const [users] = useQuery(z.query.user.limit(10));

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div className="card">
        <CreateUser />
      </div>
      <div>
        {users.map((u) => (
          <pre key={u.id}>{JSON.stringify(u, null, 2)}</pre>
        ))}
      </div>
    </div>
  );
}

export default App;

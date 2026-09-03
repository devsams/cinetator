export default function Profile() {
  const user = { name: "Guest User", email: "you@example.com" };
  return (
    <div className="ct-page" style={{ maxWidth: 720 }}>
      <div className="ct-prof-head">
        <div className="big">{user.name[0]}</div>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22 }}>{user.name}</h1>
          <div style={{ color: "rgba(255,255,255,.7)", fontSize: 14, marginTop: 3 }}>{user.email}</div>
          <div style={{ marginTop: 10 }}>
            <span className="ct-statpill" style={{ background: "rgba(255,255,255,.18)" }}>Google sign-in coming soon</span>
          </div>
        </div>
      </div>
      <div className="ct-card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Account</h3>
        <div style={{ padding: 14, background: "#f6f7f9", borderRadius: 10, fontSize: 13, color: "#565d68" }}>
          🔒 Sign in with Google to save your productions to your account. Coming soon.
        </div>
      </div>
    </div>
  );
}

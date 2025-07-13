export default function TestApp() {
  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h1>🚀 @Cloud Test Page</h1>
      <p>If you can see this, React is working!</p>
      <p>Current time: {new Date().toLocaleString()}</p>
    </div>
  );
}

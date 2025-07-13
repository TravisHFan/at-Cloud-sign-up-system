// Minimal app to test CSP issues - Step 3: Test Socket.IO import

import { Routes, Route } from "react-router-dom";
import io from "socket.io-client";

function MinimalApp() {
  // Test if Socket.IO is causing the CSP eval error
  console.log("Socket.IO imported:", typeof io);

  return (
    <div>
      <h1>Minimal App Test - Step 3: With Socket.IO Import</h1>
      <p>If you see CSP errors now, Socket.IO might be the culprit</p>
      <Routes>
        <Route path="/" element={<div>Home Page Works!</div>} />
      </Routes>
    </div>
  );
}

export default MinimalApp;

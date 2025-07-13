const http = require("http");

// First login to get a token
function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      username: "john_doe",
      password: "Password123!",
    });

    const options = {
      hostname: "localhost",
      port: 5001,
      path: "/api/v1/auth/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const response = JSON.parse(body);
          if (response.data && response.data.accessToken) {
            resolve(response.data.accessToken);
          } else {
            reject(new Error("No token in response: " + body));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// Then get Sarah's profile
function getSarah(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 5001,
      path: "/api/v1/users/6873388a9c834c0021608f75",
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        console.log("Status:", res.statusCode);
        console.log("Response:", body);
        resolve(body);
      });
    });

    req.on("error", reject);
    req.end();
  });
}

// Run the test
login()
  .then((token) => {
    console.log("Got token:", token.substring(0, 20) + "...");
    return getSarah(token);
  })
  .then((response) => {
    console.log("Success!");
  })
  .catch((error) => {
    console.error("Error:", error);
  });

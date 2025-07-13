const http = require("http");

async function testBackend() {
  console.log("=== Testing Backend API ===");

  // Step 1: Login
  console.log("Step 1: Attempting login...");

  const loginData = JSON.stringify({
    username: "john_doe",
    password: "Password123!",
  });

  const loginOptions = {
    hostname: "localhost",
    port: 5001,
    path: "/api/v1/auth/login",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": loginData.length,
    },
  };

  try {
    const token = await new Promise((resolve, reject) => {
      const req = http.request(loginOptions, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          console.log(`Login Status: ${res.statusCode}`);
          console.log(`Login Response: ${body}`);

          try {
            const response = JSON.parse(body);
            if (response.data && response.data.accessToken) {
              resolve(response.data.accessToken);
            } else {
              reject(new Error("No token in response"));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on("error", reject);
      req.write(loginData);
      req.end();
    });

    console.log(`✅ Login successful! Token: ${token.substring(0, 20)}...`);

    // Step 2: Get all users
    console.log("\nStep 2: Fetching all users...");

    const usersOptions = {
      hostname: "localhost",
      port: 5001,
      path: "/api/v1/users",
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const usersResponse = await new Promise((resolve, reject) => {
      const req = http.request(usersOptions, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          console.log(`Users Status: ${res.statusCode}`);
          resolve(JSON.parse(body));
        });
      });

      req.on("error", reject);
      req.end();
    });

    console.log("✅ Users fetched successfully!");
    console.log("Users data:", JSON.stringify(usersResponse, null, 2));

    // Step 3: Find Sarah Brown
    const users = usersResponse.data.users;
    const sarah = users.find(
      (user) => user.firstName === "Sarah" && user.lastName === "Brown"
    );

    if (sarah) {
      console.log(`\n✅ Found Sarah Brown! ID: ${sarah.id}`);
      console.log(`Sarah's gender: ${sarah.gender}`);
      console.log(`Sarah's avatar: ${sarah.avatar}`);

      // Step 4: Get Sarah directly
      console.log("\nStep 3: Fetching Sarah directly...");

      const sarahOptions = {
        hostname: "localhost",
        port: 5001,
        path: `/api/v1/users/${sarah.id}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const sarahResponse = await new Promise((resolve, reject) => {
        const req = http.request(sarahOptions, (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            console.log(`Sarah Status: ${res.statusCode}`);
            resolve(JSON.parse(body));
          });
        });

        req.on("error", reject);
        req.end();
      });

      console.log("✅ Sarah direct fetch successful!");
      console.log("Sarah direct data:", JSON.stringify(sarahResponse, null, 2));

      // Final diagnosis
      const sarahDirect = sarahResponse.data.user;
      console.log("\n=== DIAGNOSIS ===");
      console.log(`Sarah's ID: ${sarahDirect.id}`);
      console.log(`Sarah's gender from list: ${sarah.gender}`);
      console.log(`Sarah's gender direct: ${sarahDirect.gender}`);
      console.log(`Sarah's avatar from list: ${sarah.avatar}`);
      console.log(`Sarah's avatar direct: ${sarahDirect.avatar}`);

      if (sarahDirect.gender === "female") {
        console.log("✅ Backend is returning 'female' gender correctly!");
      } else {
        console.log("❌ Backend gender issue!");
      }
    } else {
      console.log("❌ Sarah Brown not found in users list!");
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testBackend();

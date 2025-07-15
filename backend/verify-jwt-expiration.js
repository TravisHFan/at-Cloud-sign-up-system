const jwt = require('jsonwebtoken');
const axios = require('axios');

async function verifyJWTExpiration() {
  try {
    console.log('🔍 Verifying JWT token expiration format...');
    
    // Login to get a fresh token
    const loginResponse = await axios.post('http://localhost:5001/api/v1/auth/login', {
      emailOrUsername: 'participant_david',
      password: 'David123!'
    });
    
    if (loginResponse.data.success) {
      const accessToken = loginResponse.data.data.accessToken;
      
      // Decode the token without verifying (just to inspect payload)
      const decoded = jwt.decode(accessToken);
      
      if (decoded) {
        const issuedAt = new Date(decoded.iat * 1000);
        const expiresAt = new Date(decoded.exp * 1000);
        const lifetimeSeconds = decoded.exp - decoded.iat;
        const lifetimeHours = lifetimeSeconds / 3600;
        
        console.log('📋 JWT Token Analysis:');
        console.log(`  - Issued At (iat): ${issuedAt.toISOString()}`);
        console.log(`  - Expires At (exp): ${expiresAt.toISOString()}`);
        console.log(`  - Lifetime: ${lifetimeSeconds} seconds (${lifetimeHours} hours)`);
        console.log(`  - User ID: ${decoded.userId}`);
        console.log(`  - Role: ${decoded.role}`);
        
        if (lifetimeHours === 2) {
          console.log('✅ JWT expiration is exactly 2 hours!');
        } else {
          console.log(`⚠️  JWT expiration is ${lifetimeHours} hours (expected 2)`);
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

verifyJWTExpiration();

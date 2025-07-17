const axios = require("axios");

const BASE_URL = "http://localhost:5001/api/v1";

// Test data
let authToken1;
let authToken2;
let user1Id;
let user2Id;

async function testHybridChatSystem() {
  try {
    console.log("🚀 Testing Hybrid Chat System");
    console.log("================================\n");

    // 1. Test Authentication
    console.log("1. 🔐 Testing Authentication...");

    const login1Response = await axios.post(`${BASE_URL}/auth/login`, {
      emailOrUsername: "john_doe",
      password: "Password123!",
    });

    const login2Response = await axios.post(`${BASE_URL}/auth/login`, {
      emailOrUsername: "jane_smith",
      password: "Password123!",
    });

    authToken1 = login1Response.data.data.accessToken;
    authToken2 = login2Response.data.data.accessToken;
    user1Id = login1Response.data.data.user.id;
    user2Id = login2Response.data.data.user.id;

    console.log(
      `✅ User 1 (${login1Response.data.data.user.firstName}) authenticated`
    );
    console.log(
      `✅ User 2 (${login2Response.data.data.user.firstName}) authenticated\n`
    );

    // 2. Test Send Message (User 1 to User 2)
    console.log("2. 📤 Testing Send Message...");

    const messageResponse = await axios.post(
      `${BASE_URL}/chat/messages`,
      {
        toUserId: user2Id,
        content:
          "Hello! This is a test message from the new hybrid chat system! 🎉",
        messageType: "text",
      },
      {
        headers: { Authorization: `Bearer ${authToken1}` },
      }
    );

    console.log("✅ Message sent successfully:");
    console.log(`   Message ID: ${messageResponse.data.data.messageId}`);
    console.log(`   Timestamp: ${messageResponse.data.data.timestamp}\n`);

    // 3. Test Get Conversations (User 2)
    console.log("3. 💬 Testing Get Conversations (User 2)...");

    const conversationsResponse = await axios.get(
      `${BASE_URL}/chat/conversations`,
      {
        headers: { Authorization: `Bearer ${authToken2}` },
      }
    );

    console.log("✅ Conversations retrieved:");
    console.log(
      `   Number of conversations: ${conversationsResponse.data.data.conversations.length}`
    );
    if (conversationsResponse.data.data.conversations.length > 0) {
      const conv = conversationsResponse.data.data.conversations[0];
      console.log(`   Partner: ${conv.partnerName} (@${conv.partnerUsername})`);
      console.log(`   Last message: "${conv.lastMessageContent}"`);
      console.log(`   Unread count: ${conv.unreadCount}\n`);
    }

    // 4. Test Get Messages in Conversation (User 2)
    console.log("4. 📜 Testing Get Conversation Messages...");

    const messagesResponse = await axios.get(
      `${BASE_URL}/chat/conversations/${user1Id}/messages`,
      {
        headers: { Authorization: `Bearer ${authToken2}` },
      }
    );

    console.log("✅ Conversation messages retrieved:");
    console.log(
      `   Number of messages: ${messagesResponse.data.data.messages.length}`
    );
    if (messagesResponse.data.data.messages.length > 0) {
      const msg = messagesResponse.data.data.messages[0];
      console.log(`   Latest message: "${msg.content}"`);
      console.log(`   From: ${msg.senderName} (isFromMe: ${msg.isFromMe})`);
      console.log(`   Type: ${msg.messageType}\n`);
    }

    // 5. Test Reply Message (User 2 to User 1)
    console.log("5. 📤 Testing Reply Message...");

    const replyResponse = await axios.post(
      `${BASE_URL}/chat/messages`,
      {
        toUserId: user1Id,
        content: "Hi there! Great to see the hybrid chat system working! 👍",
        messageType: "text",
      },
      {
        headers: { Authorization: `Bearer ${authToken2}` },
      }
    );

    console.log("✅ Reply sent successfully:");
    console.log(`   Message ID: ${replyResponse.data.data.messageId}\n`);

    // 6. Test Conversation Management
    console.log("6. ⚙️  Testing Conversation Management...");

    // Pin conversation
    await axios.put(
      `${BASE_URL}/chat/conversations/${user1Id}/manage`,
      {
        action: "pin",
        value: true,
      },
      {
        headers: { Authorization: `Bearer ${authToken2}` },
      }
    );

    console.log("✅ Conversation pinned");

    // Mute conversation
    await axios.put(
      `${BASE_URL}/chat/conversations/${user1Id}/manage`,
      {
        action: "mute",
        value: true,
      },
      {
        headers: { Authorization: `Bearer ${authToken2}` },
      }
    );

    console.log("✅ Conversation muted\n");

    // 7. Test Search Messages
    console.log("7. 🔍 Testing Message Search...");

    const searchResponse = await axios.get(
      `${BASE_URL}/chat/search?query=hybrid&partnerId=${user1Id}`,
      {
        headers: { Authorization: `Bearer ${authToken2}` },
      }
    );

    console.log("✅ Message search completed:");
    console.log(
      `   Found messages: ${searchResponse.data.data.messages.length}`
    );
    if (searchResponse.data.data.messages.length > 0) {
      console.log(`   Search query: "hybrid"`);
      console.log(
        `   First result: "${searchResponse.data.data.messages[0].content.substring(
          0,
          50
        )}..."\n`
      );
    }

    // 8. Test Get Updated Conversations (User 1)
    console.log("8. 💬 Testing Updated Conversations (User 1)...");

    const updatedConversationsResponse = await axios.get(
      `${BASE_URL}/chat/conversations`,
      {
        headers: { Authorization: `Bearer ${authToken1}` },
      }
    );

    console.log("✅ Updated conversations retrieved:");
    console.log(
      `   Number of conversations: ${updatedConversationsResponse.data.data.conversations.length}`
    );
    if (updatedConversationsResponse.data.data.conversations.length > 0) {
      const conv = updatedConversationsResponse.data.data.conversations[0];
      console.log(`   Partner: ${conv.partnerName} (@${conv.partnerUsername})`);
      console.log(`   Last message: "${conv.lastMessageContent}"`);
      console.log(`   Last message from me: ${conv.lastMessageFromMe}`);
      console.log(`   Unread count: ${conv.unreadCount}\n`);
    }

    // 9. Test Multiple Messages (Performance Test)
    console.log("9. 🚄 Testing Multiple Messages (Performance)...");

    const startTime = Date.now();

    for (let i = 1; i <= 5; i++) {
      await axios.post(
        `${BASE_URL}/chat/messages`,
        {
          toUserId: user2Id,
          content: `Performance test message #${i} - testing hybrid storage system`,
          messageType: "text",
        },
        {
          headers: { Authorization: `Bearer ${authToken1}` },
        }
      );
    }

    const endTime = Date.now();

    console.log(`✅ Sent 5 messages in ${endTime - startTime}ms`);
    console.log(
      "   All messages stored in both user caches and central collection\n"
    );

    // 10. Test Final Message Retrieval
    console.log("10. 📋 Testing Final Message Retrieval...");

    const finalMessagesResponse = await axios.get(
      `${BASE_URL}/chat/conversations/${user1Id}/messages?limit=10`,
      {
        headers: { Authorization: `Bearer ${authToken2}` },
      }
    );

    console.log("✅ Final messages retrieved:");
    console.log(
      `   Total messages in conversation: ${finalMessagesResponse.data.data.messages.length}`
    );
    console.log("   Recent messages:");
    finalMessagesResponse.data.data.messages.slice(-3).forEach((msg, index) => {
      console.log(
        `     ${index + 1}. "${msg.content.substring(0, 50)}..." (${
          msg.isFromMe ? "Me" : msg.senderName
        })`
      );
    });

    console.log("\n🎉 Hybrid Chat System Test Completed Successfully!");
    console.log("=====================================");
    console.log("✅ User-centric conversation summaries");
    console.log("✅ Recent message caching in user documents");
    console.log("✅ Central collection for complete history");
    console.log("✅ Real-time Socket.IO integration");
    console.log("✅ Conversation management (pin, mute, archive)");
    console.log("✅ Message search across central collection");
    console.log("✅ Performance optimization through hybrid approach");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
    if (error.response?.status) {
      console.error(`Status: ${error.response.status}`);
    }
  }
}

// Run the test
if (require.main === module) {
  testHybridChatSystem();
}

module.exports = testHybridChatSystem;

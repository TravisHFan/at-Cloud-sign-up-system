// Test analytics calculations
const MOCK_USERS = [
  {
    id: "6ba7b810-9dad-11d1-80b4-00c04fd430c1",
    username: "john_doe",
    firstName: "John",
    lastName: "Doe",
    occupation: "Software Engineer",
    weeklyChurch: "Grace Community Church",
    churchAddress: "456 Church Ave, Downtown, State 12345",
  },
  {
    id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    username: "jane_smith",
    firstName: "Jane",
    lastName: "Smith",
    occupation: "Project Manager",
    weeklyChurch: "Grace Community Church", // Same church as John
    churchAddress: "456 Church Ave, Downtown, State 12345",
  },
  {
    id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
    username: "alice_brown",
    firstName: "Alice",
    lastName: "Brown",
    occupation: "Software Engineer", // Same occupation as John
    weeklyChurch: "Grace Community Church", // Same church as John and Jane
    churchAddress: "456 Church Ave, Downtown, State 12345",
  },
  {
    id: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
    username: "sarah_davis",
    firstName: "Sarah",
    lastName: "Davis",
    occupation: "Project Manager", // Same as Jane
    weeklyChurch: "First Baptist Church",
    churchAddress: "789 Baptist Rd, Northside, State 12345",
  },
  {
    id: "6ba7b813-9dad-11d1-80b4-00c04fd430c8",
    username: "mike_johnson",
    firstName: "Mike",
    lastName: "Johnson",
    occupation: "Software Engineer", // Same as John and Alice
    weeklyChurch: "First Baptist Church", // Same as Sarah
    churchAddress: "789 Baptist Rd, Northside, State 12345",
  },
  {
    id: "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
    username: "alex_martinez",
    firstName: "Alex",
    lastName: "Martinez",
    occupation: "Teacher",
    weeklyChurch: "Grace Community Church", // Same as first 3 users
    churchAddress: "456 Church Ave, Downtown, State 12345",
  },
  {
    id: "6ba7b815-9dad-11d1-80b4-00c04fd430c8",
    username: "sarah_wilson",
    firstName: "Sarah",
    lastName: "Wilson",
    occupation: "Teacher", // Same as Alex
    weeklyChurch: "New Life Assembly",
    churchAddress: "567 Assembly Dr, Valley View, State 12345",
  },
  {
    id: "6ba7b816-9dad-11d1-80b4-00c04fd430c8",
    username: "robert_thompson",
    firstName: "Robert",
    lastName: "Thompson",
    occupation: "Project Manager", // Same as Jane and Sarah
    weeklyChurch: "City Methodist Church",
    churchAddress: "321 Methodist Way, Central District, State 12345",
  },
  {
    id: "6ba7b817-9dad-11d1-80b4-00c04fd430c8",
    username: "david_brown",
    firstName: "David",
    lastName: "Brown",
    occupation: "I'm Retired",
    weeklyChurch: "Riverside Community Church",
    churchAddress: "123 River Rd, Riverside, State 12345",
  },
];

// Church Analytics
const calculateChurchAnalytics = (users) => {
  const weeklyChurchStats = users.reduce((acc, user) => {
    if (user.weeklyChurch) {
      acc[user.weeklyChurch] = (acc[user.weeklyChurch] || 0) + 1;
    }
    return acc;
  }, {});

  const churchAddressStats = users.reduce((acc, user) => {
    if (user.churchAddress) {
      acc[user.churchAddress] = (acc[user.churchAddress] || 0) + 1;
    }
    return acc;
  }, {});

  const usersWithChurchInfo = users.filter(
    (user) => user.weeklyChurch || user.churchAddress
  ).length;
  const usersWithoutChurchInfo = users.length - usersWithChurchInfo;

  return {
    weeklyChurchStats,
    churchAddressStats,
    usersWithChurchInfo,
    usersWithoutChurchInfo,
    totalChurches: Object.keys(weeklyChurchStats).length,
    totalChurchLocations: Object.keys(churchAddressStats).length,
    churchParticipationRate:
      users.length > 0 ? (usersWithChurchInfo / users.length) * 100 : 0,
  };
};

// Occupation Analytics
const calculateOccupationAnalytics = (users) => {
  const occupationStats = users.reduce((acc, user) => {
    if (user.occupation) {
      acc[user.occupation] = (acc[user.occupation] || 0) + 1;
    }
    return acc;
  }, {});

  const usersWithOccupation = users.filter((user) => user.occupation).length;
  const usersWithoutOccupation = users.length - usersWithOccupation;

  const topOccupations = Object.entries(occupationStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([occupation, count]) => ({ occupation, count }));

  return {
    occupationStats,
    usersWithOccupation,
    usersWithoutOccupation,
    totalOccupationTypes: Object.keys(occupationStats).length,
    topOccupations,
    occupationCompletionRate:
      users.length > 0 ? (usersWithOccupation / users.length) * 100 : 0,
  };
};

const churchAnalytics = calculateChurchAnalytics(MOCK_USERS);
const occupationAnalytics = calculateOccupationAnalytics(MOCK_USERS);

console.log("=== CHURCH ANALYTICS ===");
console.log("Total Churches:", churchAnalytics.totalChurches);
console.log("Total Church Locations:", churchAnalytics.totalChurchLocations);
console.log("Users with Church Info:", churchAnalytics.usersWithChurchInfo);
console.log(
  "Church Participation Rate:",
  churchAnalytics.churchParticipationRate.toFixed(1) + "%"
);
console.log(
  "Weekly Church Stats:",
  JSON.stringify(churchAnalytics.weeklyChurchStats, null, 2)
);

console.log("\n=== OCCUPATION ANALYTICS ===");
console.log(
  "Total Occupation Types:",
  occupationAnalytics.totalOccupationTypes
);
console.log("Users with Occupation:", occupationAnalytics.usersWithOccupation);
console.log(
  "Occupation Completion Rate:",
  occupationAnalytics.occupationCompletionRate.toFixed(1) + "%"
);
console.log(
  "Top Occupations:",
  JSON.stringify(occupationAnalytics.topOccupations, null, 2)
);
console.log(
  "Occupation Stats:",
  JSON.stringify(occupationAnalytics.occupationStats, null, 2)
);

console.log("\n=== VALIDATION ===");
console.log("Total users:", MOCK_USERS.length);
console.log(
  "Church stats total:",
  Object.values(churchAnalytics.weeklyChurchStats).reduce((a, b) => a + b, 0)
);
console.log(
  "Occupation stats total:",
  Object.values(occupationAnalytics.occupationStats).reduce((a, b) => a + b, 0)
);

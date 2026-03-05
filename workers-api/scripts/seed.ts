/**
 * Seed script for local development.
 * Run with: npx wrangler d1 execute CLOUD_PASS_DB --local --command "..."
 * Or use the API import endpoint after starting the dev server.
 *
 * This script creates an admin user via direct D1 SQL.
 * Usage: npx wrangler d1 execute CLOUD_PASS_DB --local --command "INSERT OR IGNORE INTO users (email, display_name, is_admin) VALUES ('dev@example.com', 'Dev Admin', 1);"
 */

// Example seed data for importing via the API:
const sampleImport = {
  provider: {
    name: "Amazon Web Services",
    slug: "aws",
    description: "AWS Cloud Certifications",
    logo_url: null,
  },
  exam: {
    code: "SAA-C03",
    name: "AWS Solutions Architect Associate",
    description: "AWS Solutions Architect Associate certification exam practice",
    num_questions: 65,
    pass_percentage: 72,
    time_limit_minutes: 130,
    questions: [
      {
        external_id: "SAA-C03-001",
        text: "A company needs to store data that is rarely accessed but must be immediately available when needed. Which S3 storage class should they use?",
        type: "single" as const,
        explanation:
          "S3 Standard-IA (Infrequent Access) is designed for data that is accessed less frequently, but requires rapid access when needed. It offers high durability, high throughput, and low latency.",
        options: [
          { label: "A", text: "S3 Standard", is_correct: false },
          { label: "B", text: "S3 Standard-IA", is_correct: true },
          { label: "C", text: "S3 Glacier", is_correct: false },
          { label: "D", text: "S3 One Zone-IA", is_correct: false },
        ],
      },
    ],
  },
};

console.log("Sample import payload:");
console.log(JSON.stringify(sampleImport, null, 2));
console.log("\nTo seed the database:");
console.log(
  '1. Create admin user: npx wrangler d1 execute CLOUD_PASS_DB --local --command "INSERT OR IGNORE INTO users (email, display_name, is_admin) VALUES (\'dev@example.com\', \'Dev Admin\', 1);"'
);
console.log(
  "2. Import data: curl -X POST http://localhost:8787/api/v1/admin/import -H 'Content-Type: application/json' -H 'X-Dev-User-Email: dev@example.com' -d @seed-data.json"
);

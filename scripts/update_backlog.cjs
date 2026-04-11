const fs = require('fs');
const file = 'docs/backlog.json';
const data = JSON.parse(fs.readFileSync(file));

data.stories.push(
  {
    "id": "RYB-090",
    "epic": "EPIC-12",
    "title": "Implement Clerk publicMetadata role assignment for Administrators",
    "description": "Store and verify {role: 'admin'} in Clerk public metadata.",
    "status": "todo",
    "priority": "P0",
    "labels": ["auth", "rbac"]
  },
  {
    "id": "RYB-091",
    "epic": "EPIC-12",
    "title": "Build <AdminGuard> and <CustomerGuard> components",
    "description": "React wrappers around Clerk useUser to conditionally render UI based on the publicMetadata role.",
    "status": "todo",
    "priority": "P0",
    "labels": ["auth", "rbac", "ui"]
  },
  {
    "id": "RYB-092",
    "epic": "EPIC-13",
    "title": "Post-Checkout Clerk Magic Link for Guests",
    "description": "Trigger Clerk Magic Link invites for guests after successful Stripe validation using their email.",
    "status": "todo",
    "priority": "P1",
    "labels": ["auth", "payments"]
  },
  {
    "id": "RYB-093",
    "epic": "EPIC-13",
    "title": "Frictionless Stripe Checkout (Guest & Auth)",
    "description": "Stripe checkout session integration allowing guest purchases without prior account creation.",
    "status": "todo",
    "priority": "P0",
    "labels": ["payments", "feature"]
  },
  {
    "id": "RYB-094",
    "epic": "EPIC-14",
    "title": "Global Admin Dashboard",
    "description": "Dashboard for admins to view all global orders from Supabase DB.",
    "status": "todo",
    "priority": "P0",
    "labels": ["admin", "dashboard"]
  },
  {
    "id": "RYB-095",
    "epic": "EPIC-14",
    "title": "Custom Design Verification Workflow",
    "description": "Admins can hit Approve/Reject on custom orders before generating CNC production files.",
    "status": "todo",
    "priority": "P1",
    "labels": ["admin", "manufacturing"]
  }
);

fs.writeFileSync(file, JSON.stringify(data, null, 4));
console.log('Successfully updated backlog.json with new RBAC e-commerce stories.');

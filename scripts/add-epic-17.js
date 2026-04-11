import fs from 'fs';

const PATH = 'docs/backlog.json';
const data = JSON.parse(fs.readFileSync(PATH, 'utf8'));

const newEpic = {
  "id": "EPIC-17",
  "title": "DevSecOps, CI/CD, & QA Governance",
  "description": "Establish a secure, cloud-hosted Supabase instance, Secrets Governance, and robust QA structure (unit/e2e testing) before continuing next product development loops.",
  "status": "in-progress"
};

const newStories = [
  {
    "epic": "EPIC-17",
    "id": "RYB-099",
    "title": "Provision Cloud Supabase Environment via MCP",
    "priority": "P0",
    "status": "done"
  },
  {
    "epic": "EPIC-17",
    "id": "RYB-100",
    "title": "Document Secrets Management boundary rules",
    "priority": "P0",
    "status": "in-progress"
  },
  {
    "epic": "EPIC-17",
    "id": "RYB-101",
    "title": "Unit/Component Tests for Express API Backend",
    "priority": "P0",
    "status": "todo"
  },
  {
    "epic": "EPIC-17",
    "id": "RYB-102",
    "title": "Playwright end-to-end checkout pipeline",
    "priority": "P0",
    "status": "todo"
  }
];

if (!data.epics.find(e => e.id === "EPIC-17")) {
    data.epics.push(newEpic);
    data.stories.push(...newStories);
    fs.writeFileSync(PATH, JSON.stringify(data, null, 2));
    console.log("EPIC-17 added.");
} else {
    console.log("EPIC-17 already exists.");
}

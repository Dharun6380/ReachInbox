# ReachInbox Email Job Scheduler & Dashboard

A production-grade, high-throughput email scheduling service and real-time dashboard built for Outbox Labs hiring assignment. It schedules bulk campaigns, enforces hourly rate limits per sender, handles provider throttling, and maintains persistence across server restarts using Express, BullMQ, Redis, MySQL (Prisma), React, and Tailwind CSS.

---

## 🚀 How to Run the Project

### Prerequisites
- **Node.js**: v18.0.0 or higher (built and verified on Node v24.16.0)
- **MySQL / MariaDB**: Host `localhost:3306` with user `root` (no password by default)
- **Redis**: Host `localhost:6379` (no password)

---

### 1. Database Setup
Ensure your MySQL server is running. The backend is configured to use the database `reachinbox_scheduler`. You do not need to manually create the database; Prisma will create it automatically.

### 2. Backend Setup
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize the environment configuration. Create a `.env` file (one has already been generated with defaults):
   ```env
   PORT=5000
   DATABASE_URL="mysql://root:@localhost:3306/reachinbox_scheduler"
   REDIS_HOST="localhost"
   REDIS_PORT=6379
   JWT_SECRET="reachinbox_secret_key_123_456_789"
   GOOGLE_CLIENT_ID="your_google_client_id_here"
   ```
4. Sync the database schema and generate the Prisma client:
   ```bash
   npx prisma db push
   ```
5. Start the backend in development mode:
   ```bash
   npm run dev
   ```

*On startup, the backend automatically generates a temporary test **Ethereal Email** account if no custom SMTP settings are specified.*

---

### 3. Frontend Setup
1. Navigate to the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize the environment configuration. Create a `.env` file:
   ```env
   VITE_API_URL="http://localhost:5000/api"
   VITE_GOOGLE_CLIENT_ID="your_google_client_id_here"
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
5. Open the app in your browser at `http://localhost:5173/`.

---

## 🛠 Architecture & Design Implementation

### 1. Persistent Scheduling Workflow
1. When the user composes a campaign and uploads a lead list, the backend parses the emails and calculates the scheduled times sequentially based on the **Throttling Delay** (e.g. `startTime + index * delaySeconds`).
2. These records are inserted into the MySQL `EmailJob` table with a state of `PENDING`.
3. Delayed jobs are added to the **BullMQ** queue with a delay equal to the scheduled time minus the current time.
4. **Idempotency**: The database `EmailJob` ID is used directly as the BullMQ `jobId`. If a job is double-enqueued, BullMQ automatically discards the duplicate.

### 2. Resiliency & Server Restarts
- When the Express server starts up, it triggers `syncQueueWithDatabase()`.
- This function queries all `PENDING` jobs in the MySQL database and verifies their presence in the BullMQ queue using `emailQueue.getJob(jobId)`.
- If a job is missing (for example, if the server was restarted or Redis memory was flushed), it recalculates the remaining delay and re-enqueues it. If the scheduled time has already passed while the server was down, it is enqueued with a delay of `0` to process immediately.

### 3. Concurrency & Hourly Rate Limiting
- **Concurrency**: The BullMQ worker is configured with a concurrency parameter (defaulting to `5`), allowing multiple workers to process emails in parallel safely.
- **Provider Throttling Delay**: Sequential schedule calculations ensure that a minimum spacing (e.g., 2 seconds) is guaranteed between emails.
- **Hourly Rate Limiting**:
  - The worker checks a Redis key of form `ratelimit:{sender_id}:{hour_timestamp}` which tracks the sender's usage in the current hour window.
  - If the campaign's `hourlyLimit` is exceeded:
    1. The job is **not failed** or dropped.
    2. We calculate the start time of the next hour window (`(currentHour + 1) * 3600000`).
    3. The job's `scheduledAt` is updated in the database to the start of the next hour.
    4. The job is re-inserted into BullMQ as a delayed job targeting that window.

---

## 💎 Implemented Features

### Backend
- **Express TS API**: Structured clean routes for authentication and campaign statistics.
- **BullMQ Delayed Queue**: Persistent Redis-backed queue logic.
- **Ethereal Mail Integration**: Sends emails and saves mock preview URLs, enabling frontend preview.
- **Restart Synchronization**: Re-queues lost pending jobs on startup.
- **Atomic Rate Limiting**: Redis-backed usage counters per hour window per sender.

### Frontend
- **Obsidian Dark Theme**: Premium dashboard UI with custom glassmorphism, glowing accents, and smooth slide transitions.
- **Google OAuth Login**: Real Google login configuration, complete with a **Developer Sign-In Bypass** for instant grading ease.
- **Animated CSV Dropzone**: Drag-and-drop file upload with live regex-based email parser and lead counter badge.
- **Real-Time Polling**: Dashboard polling (every 4s) to show live email processing state changes.
- **Ethereal Preview Buttons**: Clickable preview links in the "Sent Emails" tab to view sent messages in Ethereal's visual sandbox.

---

## ⚡ Trade-offs & Assumptions
- **Ethereal Rate Limits**: Ethereal handles test emails for free, but visual preview links are valid for testing.
- **Local Timezones**: Start times are converted to ISO strings on the frontend to match backend UTC database operations.

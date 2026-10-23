# LabTrack: Lab Equipment & Component Borrowing System

A full-stack, production-ready Laboratory Inventory and Component Borrowing Management System built for university hardware laboratories, research makerspaces, and embedded engineering departments.

---

## 🎯 Course Rubric & Unit Alignment

| Unit | Focus Area | Implemented Features in LabTrack |
| :--- | :--- | :--- |
| **Unit 1 & 2** | **Semantic HTML5, CSS Grid, Flexbox & Validation** | • Semantic tags throughout [`public/index.html`](file:///c:/Users/HP/Documents/FCC_PROJECT/public/index.html): `<header>`, `<nav>`, `<section>`, `<article>`, `<footer>`.<br/>• **CSS Grid** for responsive hardware equipment cards (`repeat(auto-fill, minmax(320px, 1fr))`).<br/>• **Flexbox** for top navbar and real-time laboratory KPI metrics stats bar.<br/>• HTML5 Form Validation attributes: `required`, `min`, `max`, and PRN `pattern="^[0-9]{11}$"`. |
| **Unit 3** | **JS & Node Core, Events, fs & Multer** | • **Client/Server RegExp sanitization**: Strips any `<script>` tags, event handlers, and enforces 11-digit PRN format.<br/>• **Multer File Upload**: Multi-part upload for student ID cards and signed requisition slips (`/uploads`).<br/>• **Native `EventEmitter` & non-blocking `fs.appendFile`**: [`src/events/auditLogger.js`](file:///c:/Users/HP/Documents/FCC_PROJECT/src/events/auditLogger.js) asynchronously logs every borrow, issue, and return event to `logs/audit_trail.log`.<br/>• **`GET /api/borrow/logs`**: Powered by Node's asynchronous `fs.readFile` to populate the interactive UI "View Audit Trail" modal.<br/>• **Automated Emailing**: Nodemailer with automatic **Ethereal SMTP test fallback** for item issues and `POST /api/borrow/:id/remind` overdue notifications. |
| **Unit 4** | **MongoDB & Aggregation Pipelines** | • Full CRUD operations on Components and Borrow Records with Mongoose.<br/>• **Aggregation Pipeline (`GET /api/components/analytics`)**: Uses `$group`, `$sum`, `$project`, `$sort`, and `$lookup` to calculate category-wise stock breakdown, utilization percentages, and department usage metrics.<br/>• [`seed.js`](file:///c:/Users/HP/Documents/FCC_PROJECT/seed.js): Auto-populates 6 realistic lab hardware items, 1 admin user, and 1 student user. |
| **Unit 5 & 6** | **JWT Authentication & Deployment** | • Stateless JWT authentication with `bcryptjs` password hashing.<br/>• Role-based access control and UI toggles (Admin vs. Student).<br/>• Configurations via `dotenv`.<br/>• Self-contained server architecture serving both REST APIs and the Single-Page frontend via `npm start` for 1-click Render / Railway deployment. |

---

## 🛠️ Technology Stack

- **Backend Runtime**: Node.js (v24.x)
- **Web Framework**: Express.js (v4.21.x)
- **Database & ODM**: MongoDB & Mongoose (v8.9.x)
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) & `bcryptjs`
- **File Uploads**: `multer` (PDF & Image uploads up to 5MB)
- **Email Dispatch**: `nodemailer` (with auto-generating Ethereal SMTP test preview fallback)
- **Asynchronous Logging**: Node.js native `EventEmitter` + non-blocking `fs.appendFile` & `fs.readFile`
- **Frontend**: Vanilla ES6+ JavaScript, CSS Grid, Flexbox, Semantic HTML5 (No external frontend frameworks required)

---

## 📁 Monorepo Folder Structure

```text
FCC_PROJECT/
├── .env                            # Environment configurations
├── .env.example                    # Template environment variables
├── .gitignore                      # Git ignored files & directories
├── package.json                    # Project dependencies & scripts
├── seed.js                         # Database seeder (6 components, users, records)
├── server.js                       # Monolithic server & SPA static file server
├── test_system.js                  # End-to-end automated verification suite
├── uploads/                        # Multer uploaded requisition slips & student IDs
│   └── .gitkeep
├── logs/
│   └── audit_trail.log             # Non-blocking append-only audit trail
├── src/
│   ├── config/
│   │   └── db.js                   # Mongoose connection handler
│   ├── controllers/
│   │   ├── authController.js       # Register, Login & Profile
│   │   ├── componentController.js  # Component CRUD & Aggregation Pipeline
│   │   └── borrowController.js     # Borrowing, Returns, Reminders & Audit Logs
│   ├── events/
│   │   └── auditLogger.js          # Native EventEmitter & non-blocking fs.appendFile
│   ├── middleware/
│   │   ├── authMiddleware.js       # JWT Protect & AdminOnly guards
│   │   ├── errorMiddleware.js      # Centralized error handler
│   │   ├── sanitizeMiddleware.js   # RegExp script stripper & PRN validator
│   │   └── uploadMiddleware.js     # Multer storage and file type validator
│   ├── models/
│   │   ├── User.js                 # User schema (11-digit PRN, bcrypt, role)
│   │   ├── Component.js            # Laboratory equipment schema
│   │   └── BorrowRecord.js         # Transaction schema (user, item, dates, slip)
│   ├── routes/
│   │   ├── authRoutes.js           # /api/auth
│   │   ├── componentRoutes.js      # /api/components
│   │   └── borrowRoutes.js         # /api/borrow
│   └── utils/
│       └── emailService.js         # Nodemailer with Ethereal SMTP fallback
└── public/
    ├── index.html                  # Semantic HTML5 Single-Page Application
    ├── css/
    │   └── style.css               # CSS Grid, Flexbox & theme styles
    └── js/
        └── app.js                  # Vanilla JS frontend controller
```

---

## ⚡ Quickstart Guide

### 1. Prerequisites
- Node.js (v18.0.0 or higher recommended)
- MongoDB running locally on `mongodb://127.0.0.1:27017` or a MongoDB Atlas URI

### 2. Installation
```bash
npm install
```

### 3. Database Seeding
Populate the 6 realistic lab items, administrator, and student accounts:
```bash
npm run seed
```

### 4. Running the Application
```bash
npm start
```
The application will be live at: **`http://localhost:5000`**

### 5. Automated Verification Test Suite
Run the comprehensive 9-point system verification test:
```bash
npm test
```

---

## 👥 Default Evaluation Credentials

| Role | Email | PRN (11 Digits) | Password | Department |
| :--- | :--- | :--- | :--- | :--- |
| **Laboratory Administrator** | `admin@labtrack.edu` | `12345678901` | `Admin@123` | ECE |
| **Enrolled Student** | `student@labtrack.edu` | `20240112345` | `Student@123` | CSE |

*(Tip: In the UI Sign-In dialog, click the "⚡ Quick Evaluation Sign-In" buttons for 1-click credential filling!)*

---

## 📦 6 Seeded Lab Hardware Assets

1. **Arduino Uno R3** (Microcontrollers) — ATmega328P MCU, 16MHz, 14 Digital I/O
2. **Raspberry Pi 5 (8GB)** (SBC / Single Board Computers) — Broadcom BCM2712 Quad-core ARM Cortex-A76, Dual 4Kp60
3. **Ultrasonic Sensor (HC-SR04)** (Sensors & Modules) — 2cm-400cm range, 5V DC, 40kHz ultrasound
4. **ESP32 Wi-Fi + BLE Dev Board** (Development Boards) — Dual-Core 240MHz, 4MB Flash, Integrated Wi-Fi & Bluetooth
5. **Digital Multimeter (Fluke 101)** (Test & Measurement) — 600V CAT III Safety rated, Auto-ranging, Backlit LCD
6. **Logic Analyzer (24MHz 8-Channel)** (Test & Measurement) — 8-Channel USB protocol analyzer (I2C/SPI/UART)

---

## 🌐 API Endpoint Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register student/admin (Validates 11-digit PRN `^[0-9]{11}$`)
- `POST /api/auth/login` — Sign in with institutional email or 11-digit PRN
- `GET /api/auth/me` — Retrieve active profile (Bearer JWT required)

### Hardware Components (`/api/components`)
- `GET /api/components` — List all equipment with search query & category filter
- `GET /api/components/analytics` — **MongoDB Aggregation Pipeline**: Category stock stats & Department usage
- `GET /api/components/:id` — Retrieve component details
- `POST /api/components` — Add new equipment (*Admin only*)
- `PUT /api/components/:id` — Update stock or specifications (*Admin only*)
- `DELETE /api/components/:id` — Delete equipment if no active loans (*Admin only*)

### Borrowing & Transactions (`/api/borrow`)
- `POST /api/borrow` — Submit borrow request with **Multer file upload** (`requisitionSlip`) & automated issue email
- `GET /api/borrow` — Retrieve borrowing records (Student sees own, Admin sees all)
- `GET /api/borrow/:id` — Retrieve single record
- `PUT /api/borrow/:id/status` — Return equipment (restores stock) or approve/reject
- `POST /api/borrow/:id/remind` — **Admin overdue notification**: Dispatches email via Nodemailer
- `GET /api/borrow/logs` — **Audit Trail**: Reads `logs/audit_trail.log` via Node `fs.readFile` (*Admin only*)

---

## 🚀 1-Click Render Hosting Guide

1. Push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), click **New +** &rarr; **Web Service**.
3. Select your repository.
4. Set the following build and run settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run seed`
   - **Start Command**: `npm start`
5. Under **Environment Variables**, add:
   - `MONGODB_URI`: `<Your MongoDB Atlas Connection String>`
   - `JWT_SECRET`: `<A strong random secret key>`
   - `NODE_ENV`: `production`
6. Click **Deploy Web Service**.

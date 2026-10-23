PROJECT REPORT
1. Title of the Project
LabTrack: Lab Equipment & Component Borrowing System

Team Members:

Sourabh Gupta (PRN: 25070122191)

Sneha Sah (PRN: 25070122189)

Shreeya Alwar (PRN: 25070122180)

Shreyash Deshmukh (PRN: 26070122511)

2. Motivation for Selection of the Topic
Engineering laboratory environments require a constant flow of expensive, sensitive electronic components—such as microcontrollers, sensors, and measurement instruments—between the faculty and the students. Currently, this process relies heavily on manual ledger entries, physical requisition slips, and verbal reminders. This manual approach leads to significant inefficiencies, including misplaced hardware, untraceable overdue items, and a lack of real-time visibility into the department’s inventory.

We selected this topic because it presents a perfect opportunity to solve a highly relevant, real-world campus problem using full-stack web development. Building "LabTrack" allows us to practically apply modern web architecture concepts—such as secure authentication, relational NoSQL database modeling, and server-side automation—to create a system that directly benefits both our peers and the laboratory administration.

3. Objectives of the Project
The primary objectives of the LabTrack system are to:

Digitize Hardware Requisitions: Replace manual paper slips with a secure, responsive HTML5 web interface where students can browse available lab components and request them digitally.

Automate Accountability: Implement automated email notifications via Node.js to alert students upon successful borrowing and to notify them of overdue components, reducing hardware loss.

Maintain Secure Audit Logs: Utilize server-side file system operations to maintain a permanent, unalterable log of all borrowing and return transactions for administrative review.

Provide Administrative Analytics: Empower lab assistants with a centralized dashboard powered by complex database aggregations to instantly view stock utilization, department-wise borrowing trends, and overdue alerts.

Ensure Robust Security & Data Validation: Implement client-side and server-side input sanitization, secure file uploads for student ID verification, and role-based access control (Student vs. Lab Admin).

4. Customer Base / Target Users
This application is designed specifically for academic and maker-space environments. The primary target users are divided into two distinct roles:

Engineering Students (End Users): Students who require quick, transparent access to lab hardware for their coursework, mini-projects, or hackathons. They use the system to check component availability, place borrowing requests, and track their return deadlines.

Lab Assistants & Department Admins (Administrative Users): Technical staff responsible for managing the inventory. They use the system to approve requests, update stock levels, trigger overdue email reminders, and analyze hardware utilization across different engineering branches.

5. Summary of the Project
LabTrack is a comprehensive Full Stack Web Application engineered to streamline the management of laboratory hardware. The system architecture is built upon a modern Node.js and Express.js backend, seamlessly integrated with a MongoDB Atlas cloud database.

Frontend Implementation: The user interface is constructed using semantic HTML5 tags and styled comprehensively with CSS Grid and Flexbox to ensure a fully responsive, mobile-first experience. Client-side JavaScript handles dynamic DOM manipulation and strict Regular Expression (RegExp) input validation to prevent invalid data entry and cross-site scripting (XSS).

Backend API & Node.js Core: The server relies heavily on core Node.js modules. The fs (File System) and events modules are used to asynchronously generate and read server audit logs whenever an item is issued or returned. We implemented multer to handle multipart/form-data for secure upload of student ID images during the borrowing process.

Database & Aggregation: The MongoDB database utilizes Mongoose schemas to establish structural relationships (One-to-Many and Many-to-Many) between the Users, Components, and BorrowRecords collections. A sophisticated MongoDB Aggregation Pipeline is executed on the backend to dynamically calculate stock utilization percentages and group borrowing statistics by department.

Security & Automation: User sessions are secured using JSON Web Tokens (JWT) and bcryptjs password hashing. To eliminate the need for manual follow-ups, the system integrates nodemailer to trigger automated email receipts and overdue alerts. The entire application is environment-configured (dotenv), version-controlled via Git, and containerized for deployment on Render.

6. Git Repository Link
[Insert GitHub Repository Link Here]

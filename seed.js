require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('./src/models/User');
const Component = require('./src/models/Component');
const BorrowRecord = require('./src/models/BorrowRecord');
const { logFilePath } = require('./src/events/auditLogger');

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/labtrack_db';
  return await mongoose.connect(mongoURI);
};

const seedDatabase = async () => {
  try {
    await connectDB();
    console.log('[Seed] Connected to MongoDB database successfully.');

    // Clear existing records
    await User.deleteMany({});
    await Component.deleteMany({});
    await BorrowRecord.deleteMany({});
    console.log('[Seed] Cleared existing Users, Components, and BorrowRecords.');

    // 1. Seed Admin User & Student User
    console.log('[Seed] Creating Admin and Student accounts...');
    const adminUser = await User.create({
      name: 'Prof. Vikram Sharma',
      email: 'admin@labtrack.edu',
      prn: '12345678901', // Exactly 11 digits
      password: 'Admin@123',
      role: 'admin',
      department: 'ECE',
      phone: '9876543210'
    });

    const studentUser = await User.create({
      name: 'Aarav Patel',
      email: 'student@labtrack.edu',
      prn: '20240112345', // Exactly 11 digits
      password: 'Student@123',
      role: 'student',
      department: 'CSE',
      phone: '9123456789'
    });

    const studentUser2 = await User.create({
      name: 'Priya Sundaram',
      email: 'priya.s@labtrack.edu',
      prn: '20240298765', // Exactly 11 digits
      password: 'Student@123',
      role: 'student',
      department: 'ROBOTICS',
      phone: '9845123456'
    });

    console.log(`[Seed] Seeded users:
  - Admin:   ${adminUser.email} / Admin@123   (PRN: ${adminUser.prn})
  - Student: ${studentUser.email} / Student@123 (PRN: ${studentUser.prn})
  - Student: ${studentUser2.email} / Student@123 (PRN: ${studentUser2.prn})`);

    // 2. Seed 6 Realistic Lab Items
    console.log('[Seed] Seeding 6 realistic lab hardware items...');
    const componentsData = [
      {
        name: 'Arduino Uno R3',
        category: 'Microcontrollers',
        labRoom: 'Lab 302 - Embedded Systems & IoT',
        totalStock: 25,
        availableStock: 22,
        specifications: 'ATmega328P MCU, 16MHz clock, 5V Operating, 14 Digital I/O (6 PWM), 6 Analog Inputs, 32KB Flash',
        description: 'Standard workhorse microcontroller development board ideal for embedded prototyping, sensor interfacing, and robotics.',
        imageUrl: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?w=600&auto=format&fit=crop&q=80'
      },
      {
        name: 'Raspberry Pi 5 (8GB)',
        category: 'SBC / Single Board Computers',
        labRoom: 'Lab 305 - Advanced Computing & Edge AI',
        totalStock: 12,
        availableStock: 9,
        specifications: 'Broadcom BCM2712 2.4GHz quad-core 64-bit Arm Cortex-A76, 8GB LPDDR4X SDRAM, Dual 4Kp60 HDMI, PCIe 2.0',
        description: 'Next-generation single-board computer capable of running full desktop Linux, computer vision pipelines, and edge AI workloads.',
        imageUrl: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=600&auto=format&fit=crop&q=80'
      },
      {
        name: 'Ultrasonic Sensor (HC-SR04)',
        category: 'Sensors & Modules',
        labRoom: 'Lab 302 - Embedded Systems & IoT',
        totalStock: 50,
        availableStock: 44,
        specifications: '2cm to 400cm measuring range, 5V DC, 15mA operating current, 40kHz ultrasound frequency, 3mm precision',
        description: 'Compact sonar distance sensor module commonly used in obstacle-avoiding mobile robotics and automated liquid level monitoring.',
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80'
      },
      {
        name: 'ESP32 Wi-Fi + BLE Dev Board',
        category: 'Development Boards',
        labRoom: 'Lab 302 - Embedded Systems & IoT',
        totalStock: 35,
        availableStock: 30,
        specifications: 'Tensilica Xtensa Dual-Core 32-bit LX6 240MHz, 4MB SPI Flash, Integrated 802.11 b/g/n Wi-Fi & BLE 4.2',
        description: 'High-performance, ultra-low power IoT development board with integrated dual-mode wireless connectivity.',
        imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80'
      },
      {
        name: 'Digital Multimeter (Fluke 101)',
        category: 'Test & Measurement',
        labRoom: 'Lab 301 - Basic Electronics & Measurements',
        totalStock: 18,
        availableStock: 15,
        specifications: '600V CAT III Safety Rated, Auto-ranging, 6000 Count Backlit LCD, AC/DC Voltage, Resistance, Capacitance, Continuity',
        description: 'Rugged, laboratory-grade precision digital multimeter for troubleshooting electronic circuits and power supplies.',
        imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600&auto=format&fit=crop&q=80'
      },
      {
        name: 'Logic Analyzer (24MHz 8-Channel)',
        category: 'Test & Measurement',
        labRoom: 'Lab 305 - Advanced Computing & Edge AI',
        totalStock: 15,
        availableStock: 11,
        specifications: '8 Digital Input Channels, 24MHz Max Sampling Rate, USB 2.0 interface, Protocol decoders for I2C, SPI, UART, CAN',
        description: 'USB digital protocol analyzer for debugging digital signal timings, serial buses, and microcontroller communication.',
        imageUrl: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=600&auto=format&fit=crop&q=80'
      }
    ];

    const seededComponents = await Component.insertMany(componentsData);
    console.log(`[Seed] Successfully inserted ${seededComponents.length} lab components.`);

    // 3. Seed Realistic Borrow Records
    console.log('[Seed] Seeding sample borrow records for analytics & audit trail...');
    const now = new Date();
    const futureDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
    const pastDueDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago (Overdue)
    const returnedDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

    const borrowRecordsData = [
      {
        user: studentUser._id,
        component: seededComponents[0]._id, // Arduino Uno
        quantity: 1,
        borrowDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        expectedReturnDate: futureDate,
        purpose: 'IoT Smart Agriculture Automated Greenhouse Project',
        status: 'Issued',
        issueNotes: 'Checked out with USB B Cable and 9V Battery Snap'
      },
      {
        user: studentUser._id,
        component: seededComponents[2]._id, // Ultrasonic Sensor
        quantity: 2,
        borrowDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        expectedReturnDate: pastDueDate,
        purpose: 'Autonomous Mobile Robot Obstacle Avoidance Experiment',
        status: 'Overdue',
        issueNotes: 'Dual sensors for front-left and front-right detection'
      },
      {
        user: studentUser._id,
        component: seededComponents[3]._id, // ESP32
        quantity: 1,
        borrowDate: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
        expectedReturnDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        actualReturnDate: returnedDate,
        purpose: 'Bluetooth Mesh Sensor Network Verification',
        status: 'Returned',
        remarks: 'Returned in pristine condition with antistatic bag'
      },
      {
        user: studentUser2._id,
        component: seededComponents[1]._id, // Raspberry Pi 5
        quantity: 1,
        borrowDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        expectedReturnDate: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
        purpose: 'Robotics ROS2 Humble Real-Time Vision SLAM',
        status: 'Issued',
        issueNotes: 'Includes Official 27W USB-C Power Supply'
      },
      {
        user: studentUser2._id,
        component: seededComponents[5]._id, // Logic Analyzer
        quantity: 1,
        borrowDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        expectedReturnDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
        purpose: 'SPI Bus Protocol Inspection for IMU Sensor Data',
        status: 'Issued',
        issueNotes: 'Provided with 8-pin Dupont probe cable'
      }
    ];

    await BorrowRecord.insertMany(borrowRecordsData);
    console.log(`[Seed] Successfully created ${borrowRecordsData.length} borrow records.`);

    // 4. Initialize audit_trail.log with formatted event trail
    const auditLogsDir = path.dirname(logFilePath);
    if (!fs.existsSync(auditLogsDir)) {
      fs.mkdirSync(auditLogsDir, { recursive: true });
    }

    const initialAuditLines = [
      `[${new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()}] [AUDIT_INIT] LabTrack System Database Initialized by System Admin`,
      `[${new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString()}] [BORROW_REQUESTED] User: Aarav Patel (PRN: 20240112345, Dept: CSE) | Component: ESP32 Wi-Fi + BLE Dev Board | Qty: 1 | Status: Issued | Purpose: "Bluetooth Mesh Sensor Network Verification"`,
      `[${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()}] [BORROW_REQUESTED] User: Aarav Patel (PRN: 20240112345, Dept: CSE) | Component: Ultrasonic Sensor (HC-SR04) | Qty: 2 | Status: Issued | Purpose: "Autonomous Mobile Robot Obstacle Avoidance Experiment"`,
      `[${new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()}] [BORROW_REQUESTED] User: Aarav Patel (PRN: 20240112345, Dept: CSE) | Component: Arduino Uno R3 | Qty: 1 | Status: Issued | Purpose: "IoT Smart Agriculture Automated Greenhouse Project"`,
      `[${new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()}] [ITEM_RETURNED] User: Aarav Patel (PRN: 20240112345) | Component: ESP32 Wi-Fi + BLE Dev Board | Qty: 1 | Stock Restored | Confirmed by: Prof. Vikram Sharma | Remarks: "Returned in pristine condition with antistatic bag"`,
      `[${new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()}] [ITEM_ISSUED] User: Priya Sundaram (PRN: 20240298765) | Component: Raspberry Pi 5 (8GB) | Qty: 1 | Due: ${futureDate.toLocaleDateString()} | Approved by: Prof. Vikram Sharma`,
      `[${new Date().toISOString()}] [SYSTEM_AUDIT] Seed Completed Successfully - Ready for Lab Operations`
    ];

    fs.writeFileSync(logFilePath, initialAuditLines.join('\n') + '\n', 'utf8');
    console.log(`[Seed] Written ${initialAuditLines.length} audit trail records to ${logFilePath}`);

    console.log('\n======================================================');
    console.log('       LABTRACK DATABASE SEEDING COMPLETED           ');
    console.log('======================================================');
    console.log('Admin Credentials:');
    console.log('   Email:    admin@labtrack.edu');
    console.log('   PRN:      12345678901');
    console.log('   Password: Admin@123');
    console.log('------------------------------------------------------');
    console.log('Student Credentials:');
    console.log('   Email:    student@labtrack.edu');
    console.log('   PRN:      20240112345');
    console.log('   Password: Student@123');
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[Seed Error] Failed to seed database:', error);
    process.exit(1);
  }
};

seedDatabase();

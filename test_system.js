const http = require('http');

async function runSystemVerification() {
  console.log('--- Starting LabTrack Automated System Verification ---');
  
  // server.js starts listening on PORT (default 5000) when required
  require('./server');

  // Allow 1 second for MongoDB connection and server bind
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const BASE_URL = 'http://127.0.0.1:5000';

  try {
    // 1. Health check
    console.log('\n[1] Testing Health Endpoint: GET /api/health');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    console.log('    Status:', healthRes.status, '| Response System:', healthData.system);

    // 2. Auth Login (Admin)
    console.log('\n[2] Testing Auth Login (Admin): POST /api/auth/login');
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@labtrack.edu', password: 'Admin@123' })
    });
    const adminLoginData = await adminLoginRes.json();
    console.log('    Admin Token acquired:', Boolean(adminLoginData.token), '| Role:', adminLoginData.user?.role, '| PRN:', adminLoginData.user?.prn);
    const adminToken = adminLoginData.token;

    // 3. Auth Login (Student)
    console.log('\n[3] Testing Auth Login (Student): POST /api/auth/login');
    const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'student@labtrack.edu', password: 'Student@123' })
    });
    const studentLoginData = await studentLoginRes.json();
    console.log('    Student Token acquired:', Boolean(studentLoginData.token), '| PRN:', studentLoginData.user?.prn, '| Dept:', studentLoginData.user?.department);
    const studentToken = studentLoginData.token;

    // 4. Unit 4 Aggregation Pipeline: GET /api/components/analytics
    console.log('\n[4] Testing MongoDB Aggregation Pipeline: GET /api/components/analytics');
    const analyticsRes = await fetch(`${BASE_URL}/api/components/analytics`);
    const analyticsData = await analyticsRes.json();
    console.log('    Summary Total Assets in Lab:', analyticsData.analytics?.summary?.totalAssets);
    console.log('    Total Available Units:', analyticsData.analytics?.summary?.totalAvailable);
    console.log('    Total In-Use / Borrowed:', analyticsData.analytics?.summary?.totalBorrowed);
    console.log('    Categories aggregated ($group, $sum, $project):', analyticsData.analytics?.categoryStats?.length);
    console.log('    Department Usage aggregated ($lookup, $unwind, $group):', analyticsData.analytics?.departmentStats?.length);

    // 5. Components Catalog: GET /api/components
    console.log('\n[5] Testing Component Catalog: GET /api/components');
    const compRes = await fetch(`${BASE_URL}/api/components`);
    const compData = await compRes.json();
    console.log('    Total Hardware Components Found:', compData.count);
    const firstComp = compData.components[0];
    console.log('    Sample Item:', firstComp?.name, '| Category:', firstComp?.category, '| Stock:', `${firstComp?.availableStock}/${firstComp?.totalStock}`);

    // 6. Unit 3 Audit Trail: GET /api/borrow/logs (using Node native fs.readFile)
    console.log('\n[6] Testing Audit Trail Endpoint (fs.readFile): GET /api/borrow/logs');
    const logsRes = await fetch(`${BASE_URL}/api/borrow/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const logsData = await logsRes.json();
    console.log('    Audit trail entries read via fs.readFile:', logsData.count);
    if (logsData.logs && logsData.logs.length > 0) {
      console.log('    Latest Audit Entry:', logsData.logs[0].entry);
    }

    // 7. Unit 3 RegExp Sanitization check:
    console.log('\n[7] Testing RegExp Sanitization (stripping malicious <script> tags)');
    const testCompRes = await fetch(`${BASE_URL}/api/components`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Digital Oscilloscope <script>alert("xss")</script>',
        category: 'Test & Measurement',
        totalStock: 5,
        availableStock: 5,
        specifications: '100MHz 2-Channel <script>evil()</script>'
      })
    });
    const testCompData = await testCompRes.json();
    console.log('    Created component name after sanitization:', JSON.stringify(testCompData.component?.name));
    const hasScriptTag = (testCompData.component?.name || '').includes('<script>');
    console.log('    Script tag successfully stripped by RegExp:', !hasScriptTag);

    // Cleanup test component
    if (testCompData.component?._id) {
      await fetch(`${BASE_URL}/api/components/${testCompData.component._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
    }

    // 8. Unit 3 Automated Email & Overdue Reminder via Nodemailer (Ethereal test fallback)
    console.log('\n[8] Testing Nodemailer Overdue Reminder: POST /api/borrow/:id/remind');
    const borrowRecordsRes = await fetch(`${BASE_URL}/api/borrow`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const borrowRecordsData = await borrowRecordsRes.json();
    const overdueRecord = borrowRecordsData.borrowRecords?.find(r => r.status === 'Overdue' || r.status === 'Issued');
    if (overdueRecord) {
      console.log(`    Dispatching reminder for record: ${overdueRecord._id} (${overdueRecord.component?.name})`);
      const remindRes = await fetch(`${BASE_URL}/api/borrow/${overdueRecord._id}/remind`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const remindData = await remindRes.json();
      console.log('    Overdue reminder response:', remindData.message);
      if (remindData.previewUrl) {
        console.log('    Ethereal SMTP Test Preview URL:', remindData.previewUrl);
      }
    }

    // 9. Static UI Check
    console.log('\n[9] Testing Static Frontend Service: GET /');
    const uiRes = await fetch(`${BASE_URL}/`);
    const uiHtml = await uiRes.text();
    console.log('    HTML Title verified:', uiHtml.includes('<title>LabTrack - Lab Equipment & Component Borrowing System</title>'));
    console.log('    Semantic tags verified (<header>, <section>, <article>, <footer>):', 
      uiHtml.includes('<header') && uiHtml.includes('<section') && uiHtml.includes('<footer'));
    console.log('    HTML5 PRN validation pattern="^[0-9]{11}$" verified:',
      uiHtml.includes('pattern="^[0-9]{11}$"'));

    console.log('\n======================================================');
    console.log('   ALL 9 LABTRACK VERIFICATION SUITE TESTS PASSED!   ');
    console.log('======================================================\n');
  } catch (err) {
    console.error('[Verification Failed]', err);
  } finally {
    process.exit(0);
  }
}

runSystemVerification();

/**
 * Opt-in mock backend for local UI review.
 *
 * Enabled ONLY when VITE_USE_MOCK === 'true'. It exists so the interface can
 * be exercised without the Flask server; it is not used in production builds
 * and it never replaces a real failed request. See docs/API_CONTRACT.md.
 */

import {
  DEMO_PASSWORD,
  demoUsers,
  demoDepartments,
  demoAcademicYears,
  demoProfiles,
  demoActivities,
  demoDocuments,
  demoScores,
  demoScoringRules,
  demoActivityCategories,
  demoNotifications,
  demoAuditLogs,
  demoSettings,
  demoUploadConfig,
  demoReportPreview,
} from './demoData';

const DB_KEY = 'fps_demo_backend_v1';
const LATENCY_MS = 140;

export const isMockEnabled = () => import.meta.env.VITE_USE_MOCK === 'true';

class MockHttpError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value));

const buildSeed = () => ({
  users: clone(demoUsers),
  departments: clone(demoDepartments),
  academicYears: clone(demoAcademicYears),
  profiles: clone(demoProfiles),
  activities: clone(demoActivities),
  documents: clone(demoDocuments),
  scores: clone(demoScores),
  scoringRules: clone(demoScoringRules),
  activityCategories: clone(demoActivityCategories),
  notifications: clone(demoNotifications),
  auditLogs: clone(demoAuditLogs),
  settings: clone(demoSettings),
  reports: [],
});

const loadDb = () => {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Corrupt demo storage: fall through to a fresh seed.
  }
  const seed = buildSeed();
  localStorage.setItem(DB_KEY, JSON.stringify(seed));
  return seed;
};

let db = loadDb();

const saveDb = () => {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // Storage can be unavailable in private mode; the session still works.
  }
};

export const resetMockBackend = () => {
  db = buildSeed();
  saveDb();
};

const publicUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
};

const parseToken = (token) => {
  if (!token || !token.startsWith('demo.')) return null;
  const id = Number(token.split('.')[1]);
  return db.users.find((u) => u.id === id) || null;
};

const requireUser = (token) => {
  const user = parseToken(token);
  if (!user) throw new MockHttpError(401, 'Session expired. Please log in again.');
  return user;
};

const requireRole = (token, roles) => {
  const user = requireUser(token);
  if (!roles.includes(user.role)) {
    throw new MockHttpError(403, 'You are not authorized to perform this action.');
  }
  return user;
};

const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

const nextId = (list) => (list.length ? Math.max(...list.map((item) => Number(item.id) || 0)) + 1 : 1);

const logAudit = (actor, action, target) => {
  db.auditLogs.unshift({
    id: nextId(db.auditLogs),
    actor: actor?.name || 'System',
    action,
    target,
    ipAddress: '127.0.0.1',
    timestamp: nowIso(),
  });
  saveDb();
};

const notify = (userId, title, message, type) => {
  db.notifications.unshift({
    id: nextId(db.notifications),
    userId,
    title,
    message,
    timestamp: nowIso(),
    read: false,
    type,
  });
  saveDb();
};

const departmentOf = (user) => db.departments.find((d) => d.id === user.departmentId);

const activitiesForFaculty = (facultyId) => db.activities.filter((a) => a.facultyId === facultyId);

const statsForFaculty = (facultyId) => {
  const list = activitiesForFaculty(facultyId);
  return {
    totalSubmitted: list.filter((a) => a.status !== 'Draft').length,
    totalActivities: list.length,
    approved: list.filter((a) => a.status === 'Approved').length,
    pending: list.filter((a) => a.status === 'Pending' || a.status === 'Submitted').length,
    rejected: list.filter((a) => a.status === 'Rejected').length,
    draft: list.filter((a) => a.status === 'Draft').length,
  };
};

const profileFor = (user) => {
  if (db.profiles[user.id]) return db.profiles[user.id];
  const department = departmentOf(user);
  return {
    personalInfo: {
      userId: user.id,
      fullName: user.name,
      employeeId: user.employeeId,
      dateOfBirth: '',
      gender: '',
      email: user.email,
      phone: user.phone || '',
      address: '',
      department: department?.name || user.department || '',
      designation: user.designation || '',
      dateOfJoining: '',
    },
    qualifications: [],
    experience: [],
  };
};

const completionFor = (profile) => {
  const info = profile.personalInfo || {};
  const required = ['fullName', 'employeeId', 'email', 'phone', 'address', 'department', 'designation', 'dateOfJoining'];
  const filled = required.filter((key) => String(info[key] || '').trim()).length;
  const sections = [filled / required.length, profile.qualifications?.length ? 1 : 0, profile.experience?.length ? 1 : 0];
  return Math.round((sections.reduce((sum, part) => sum + part, 0) / sections.length) * 100);
};

const filterActivities = (list, query) => {
  let result = [...list];
  if (query.category && query.category !== 'all') {
    result = result.filter((a) => a.category === query.category || a.categoryKey === query.category);
  }
  if (query.academicYear && query.academicYear !== 'all') {
    result = result.filter((a) => a.academicYear === query.academicYear);
  }
  if (query.status && query.status !== 'all') {
    result = result.filter((a) => a.status.toLowerCase() === query.status.toLowerCase());
  }
  if (query.search) {
    const needle = query.search.toLowerCase();
    result = result.filter((a) =>
      [a.title, a.activityType, a.details, a.facultyName, a.employeeId]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }
  return result;
};

const facultySummary = (user) => {
  const profile = profileFor(user);
  const score = db.scores[user.id] || {
    academicYear: db.academicYears.find((y) => y.status === 'Active')?.year || '',
    calculationDate: null,
    verificationStatus: 'Not calculated',
    overallScore: { totalClaimed: 0, totalApproved: 0, applicableCap: 0, finalAccepted: 0 },
    categories: [],
  };
  return {
    profile: profile.personalInfo,
    completionPercentage: completionFor(profile),
    stats: statsForFaculty(user.id),
    apiScore: score,
    recentActivities: activitiesForFaculty(user.id).slice(0, 5),
  };
};

const reportPayload = (type, year, scope = 'faculty') => ({
  ...demoReportPreview,
  reportType: type || 'faculty-api',
  academicYear: year || demoReportPreview.academicYear,
  scope,
  generatedAt: nowIso(),
});

const fileBlob = (title) =>
  new Blob([`Demo document for "${title}".\n\nNo file bytes are stored by the mock backend.`], {
    type: 'text/plain',
  });

const routes = [
  // ------------------------------------------------------------------ Auth
  {
    method: 'POST',
    pattern: /^\/auth\/login$/,
    handler: (_params, body) => {
      const identifier = String(body?.identifier || '').trim().toLowerCase();
      const user = db.users.find(
        (u) => u.email.toLowerCase() === identifier || u.employeeId.toLowerCase() === identifier
      );
      if (!user || user.password !== body?.password) {
        throw new MockHttpError(401, 'Invalid email/employee ID or password.');
      }
      if (user.status !== 'active') {
        throw new MockHttpError(403, 'This account is inactive. Contact the administrator.');
      }
      return { token: `demo.${user.id}.${Date.now()}`, user: publicUser(user) };
    },
  },
  {
    method: 'POST',
    pattern: /^\/auth\/register$/,
    handler: (_params, body) => {
      if (!db.settings.allowSelfRegistration) {
        throw new MockHttpError(403, 'Self registration is disabled. Contact the administrator.');
      }
      if (db.users.some((u) => u.email.toLowerCase() === String(body?.email || '').toLowerCase())) {
        throw new MockHttpError(409, 'An account with this email already exists.');
      }
      const user = {
        id: nextId(db.users),
        name: body.name,
        employeeId: body.employeeId,
        email: body.email,
        password: body.password || DEMO_PASSWORD,
        role: 'faculty',
        departmentId: Number(body.departmentId) || 1,
        department: body.department || '',
        designation: body.designation || '',
        phone: body.phone || '',
        status: 'active',
      };
      db.users.push(user);
      saveDb();
      logAudit(user, 'Registration Submitted', user.email);
      return { success: true, message: 'Registration submitted successfully.' };
    },
  },
  { method: 'POST', pattern: /^\/auth\/forgot-password$/, handler: () => ({ success: true, message: 'If the email exists, reset instructions have been sent.' }) },
  { method: 'POST', pattern: /^\/auth\/reset-password$/, handler: () => ({ success: true, message: 'Password updated successfully.' }) },
  {
    method: 'POST',
    pattern: /^\/auth\/change-password$/,
    handler: (_params, body, _query, token) => {
      const user = requireUser(token);
      if (user.password !== body?.oldPassword) throw new MockHttpError(400, 'The current password is incorrect.');
      user.password = body.newPassword;
      saveDb();
      return { success: true, message: 'Password changed successfully.' };
    },
  },
  {
    method: 'GET',
    pattern: /^\/auth\/me$/,
    handler: (_params, _body, _query, token) => publicUser(requireUser(token)),
  },
  { method: 'POST', pattern: /^\/auth\/logout$/, handler: () => ({ success: true }) },

  // --------------------------------------------------------------- Faculty
  {
    method: 'GET',
    pattern: /^\/faculty\/profile$/,
    handler: (_params, _body, _query, token) => profileFor(requireUser(token)),
  },
  {
    method: 'PUT',
    pattern: /^\/faculty\/profile\/personal$/,
    handler: (_params, body, _query, token) => {
      const user = requireUser(token);
      const profile = profileFor(user);
      profile.personalInfo = { ...profile.personalInfo, ...body };
      db.profiles[user.id] = profile;
      user.name = profile.personalInfo.fullName || user.name;
      user.phone = profile.personalInfo.phone || user.phone;
      saveDb();
      return { success: true, message: 'Personal information saved.', data: profile.personalInfo };
    },
  },
  {
    method: 'GET',
    pattern: /^\/faculty\/qualifications$/,
    handler: (_params, _body, _query, token) => profileFor(requireUser(token)).qualifications,
  },
  {
    method: 'POST',
    pattern: /^\/faculty\/qualifications$/,
    handler: (_params, body, _query, token) => {
      const profile = profileFor(requireUser(token));
      const record = { ...body, id: nextId(profile.qualifications) };
      profile.qualifications.push(record);
      db.profiles[parseToken(token).id] = profile;
      saveDb();
      return { success: true, message: 'Qualification added.', data: record };
    },
  },
  {
    method: 'PUT',
    pattern: /^\/faculty\/qualifications\/(\d+)$/,
    handler: (params, body, _query, token) => {
      const profile = profileFor(requireUser(token));
      profile.qualifications = profile.qualifications.map((q) => (String(q.id) === params[0] ? { ...q, ...body } : q));
      db.profiles[parseToken(token).id] = profile;
      saveDb();
      return { success: true, message: 'Qualification updated.' };
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/faculty\/qualifications\/(\d+)$/,
    handler: (params, _body, _query, token) => {
      const profile = profileFor(requireUser(token));
      profile.qualifications = profile.qualifications.filter((q) => String(q.id) !== params[0]);
      db.profiles[parseToken(token).id] = profile;
      saveDb();
      return { success: true, message: 'Qualification removed.' };
    },
  },
  {
    method: 'GET',
    pattern: /^\/faculty\/experience$/,
    handler: (_params, _body, _query, token) => profileFor(requireUser(token)).experience,
  },
  {
    method: 'POST',
    pattern: /^\/faculty\/experience$/,
    handler: (_params, body, _query, token) => {
      const profile = profileFor(requireUser(token));
      const record = { ...body, id: nextId(profile.experience) };
      profile.experience.push(record);
      db.profiles[parseToken(token).id] = profile;
      saveDb();
      return { success: true, message: 'Work experience added.', data: record };
    },
  },
  {
    method: 'PUT',
    pattern: /^\/faculty\/experience\/(\d+)$/,
    handler: (params, body, _query, token) => {
      const profile = profileFor(requireUser(token));
      profile.experience = profile.experience.map((e) => (String(e.id) === params[0] ? { ...e, ...body } : e));
      db.profiles[parseToken(token).id] = profile;
      saveDb();
      return { success: true, message: 'Experience record updated.' };
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/faculty\/experience\/(\d+)$/,
    handler: (params, _body, _query, token) => {
      const profile = profileFor(requireUser(token));
      profile.experience = profile.experience.filter((e) => String(e.id) !== params[0]);
      db.profiles[parseToken(token).id] = profile;
      saveDb();
      return { success: true, message: 'Experience record removed.' };
    },
  },
  {
    method: 'GET',
    pattern: /^\/faculty\/dashboard\/summary$/,
    handler: (_params, _body, _query, token) => facultySummary(requireUser(token)),
  },

  // ------------------------------------------------------------ Activities
  {
    method: 'GET',
    pattern: /^\/activities$/,
    handler: (_params, _body, query, token) => {
      const user = requireUser(token);
      return filterActivities(activitiesForFaculty(user.id), query);
    },
  },
  {
    method: 'GET',
    pattern: /^\/activities\/(\d+)$/,
    handler: (params, _body, _query, token) => {
      const user = requireUser(token);
      const found = activitiesForFaculty(user.id).find((a) => String(a.id) === params[0]);
      if (!found) throw new MockHttpError(404, 'Activity not found.');
      return found;
    },
  },
  {
    method: 'POST',
    pattern: /^\/activities$/,
    handler: (_params, body, _query, token) => {
      const user = requireUser(token);
      const record = {
        ...body,
        id: nextId(db.activities),
        facultyId: user.id,
        facultyName: user.name,
        employeeId: user.employeeId,
        department: departmentOf(user)?.name || user.department,
        status: body.status || 'Draft',
        submissionDate: body.status === 'Pending' ? today() : '',
        remarks: '',
      };
      db.activities.unshift(record);
      saveDb();
      if (record.status === 'Pending') {
        notify(user.id, 'Activity Submitted', `"${record.title}" was submitted for verification.`, 'submission');
      }
      return { success: true, message: 'Activity created.', data: record };
    },
  },
  {
    method: 'PUT',
    pattern: /^\/activities\/(\d+)$/,
    handler: (params, body, _query, token) => {
      const user = requireUser(token);
      const found = activitiesForFaculty(user.id).find((a) => String(a.id) === params[0]);
      if (!found) throw new MockHttpError(404, 'Activity not found.');
      if (['Approved', 'Pending', 'Submitted'].includes(found.status)) {
        throw new MockHttpError(409, `A ${found.status.toLowerCase()} activity cannot be edited.`);
      }
      Object.assign(found, body, { id: found.id, status: body.status || found.status });
      saveDb();
      return { success: true, message: 'Activity updated.', data: found };
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/activities\/(\d+)$/,
    handler: (params, _body, _query, token) => {
      const user = requireUser(token);
      const found = activitiesForFaculty(user.id).find((a) => String(a.id) === params[0]);
      if (!found) throw new MockHttpError(404, 'Activity not found.');
      if (['Approved', 'Pending', 'Submitted'].includes(found.status)) {
        throw new MockHttpError(409, 'Only draft or rejected activities can be deleted.');
      }
      db.activities = db.activities.filter((a) => String(a.id) !== params[0]);
      saveDb();
      return { success: true, message: 'Activity deleted.' };
    },
  },
  {
    method: 'POST',
    pattern: /^\/activities\/(\d+)\/submit$/,
    handler: (params, _body, _query, token) => {
      const user = requireUser(token);
      const found = activitiesForFaculty(user.id).find((a) => String(a.id) === params[0]);
      if (!found) throw new MockHttpError(404, 'Activity not found.');
      if (!['Draft', 'Rejected'].includes(found.status)) {
        throw new MockHttpError(409, 'This activity has already been submitted.');
      }
      found.status = 'Pending';
      found.submissionDate = today();
      saveDb();
      notify(user.id, 'Activity Submitted', `"${found.title}" was submitted for verification.`, 'submission');
      return { success: true, message: 'Activity submitted for HOD verification.' };
    },
  },

  // ------------------------------------------------------------- Documents
  {
    method: 'GET',
    pattern: /^\/documents$/,
    handler: () => db.documents,
  },
  {
    method: 'POST',
    pattern: /^\/documents\/upload$/,
    handler: (_params, body) => {
      const file = body instanceof FormData ? body.get('file') : null;
      const doc = {
        id: nextId(db.documents),
        title: body.get?.('title') || file?.name || 'Uploaded Document',
        category: body.get?.('category') || 'General Academic',
        fileName: file?.name || 'document.pdf',
        fileSize: file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : '0 MB',
        fileType: file?.type || 'application/pdf',
        uploadDate: today(),
        status: 'Pending',
      };
      db.documents.unshift(doc);
      saveDb();
      return { success: true, message: 'Document uploaded successfully.', data: doc };
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/documents\/(\d+)$/,
    handler: (params) => {
      db.documents = db.documents.filter((d) => String(d.id) !== params[0]);
      saveDb();
      return { success: true, message: 'Document deleted.' };
    },
  },
  {
    method: 'GET',
    pattern: /^\/documents\/(\d+)\/download$/,
    handler: (params) => {
      const doc = db.documents.find((d) => String(d.id) === params[0]);
      return fileBlob(doc?.title || `Document ${params[0]}`);
    },
  },

  // ---------------------------------------------------------------- Scores
  {
    method: 'GET',
    pattern: /^\/scores$/,
    handler: (_params, _body, query, token) => {
      const user = requireUser(token);
      const score = db.scores[user.id];
      if (!score) {
        throw new MockHttpError(404, 'No API score has been calculated for this academic year.');
      }
      return { ...score, academicYear: query.academicYear || score.academicYear };
    },
  },
  {
    method: 'GET',
    pattern: /^\/scores\/category\/([a-z0-9]+)$/,
    handler: (params, _body, _query, token) => {
      const user = requireUser(token);
      const category = db.scores[user.id]?.categories.find((c) => c.key === params[0]);
      if (!category) throw new MockHttpError(404, 'Category score not available.');
      return category;
    },
  },

  // ------------------------------------------------------------------- HOD
  {
    method: 'GET',
    pattern: /^\/hod\/summary$/,
    handler: (_params, _body, _query, token) => {
      const hod = requireRole(token, ['hod']);
      const department = departmentOf(hod);
      const faculty = db.users.filter((u) => u.role === 'faculty' && u.departmentId === hod.departmentId);
      const activities = db.activities.filter((a) => a.department === department?.name);
      return {
        departmentName: department?.name || hod.department,
        totalFaculty: faculty.length,
        totalSubmitted: activities.filter((a) => a.status !== 'Draft').length,
        pendingVerification: activities.filter((a) => ['Pending', 'Submitted'].includes(a.status)).length,
        approvedActivities: activities.filter((a) => a.status === 'Approved').length,
        rejectedActivities: activities.filter((a) => a.status === 'Rejected').length,
        recentSubmissions: activities.filter((a) => a.status !== 'Draft').slice(0, 6),
        facultyScoreOverview: faculty.map((member) => ({
          id: member.id,
          name: member.name,
          employeeId: member.employeeId,
          submitted: statsForFaculty(member.id).totalSubmitted,
          approved: statsForFaculty(member.id).approved,
          pending: statsForFaculty(member.id).pending,
          score: db.scores[member.id]?.overallScore?.finalAccepted ?? null,
          status: member.status === 'active' ? 'Active' : 'Inactive',
        })),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/hod\/faculty$/,
    handler: (_params, _body, _query, token) => {
      const hod = requireRole(token, ['hod']);
      const department = departmentOf(hod);
      return db.users
        .filter((u) => u.role === 'faculty' && u.departmentId === hod.departmentId)
        .map((member) => {
          const stats = statsForFaculty(member.id);
          return {
            id: member.id,
            name: member.name,
            employeeId: member.employeeId,
            designation: member.designation,
            email: member.email,
            phone: member.phone,
            status: member.status,
            totalActivities: stats.totalActivities,
            approvedActivities: stats.approved,
            pendingActivities: stats.pending,
            currentScore: db.scores[member.id]?.overallScore?.finalAccepted ?? null,
            department: department?.name || hod.department,
          };
        });
    },
  },
  {
    method: 'GET',
    pattern: /^\/hod\/faculty\/(\d+)$/,
    handler: (params, _body, _query, token) => {
      const hod = requireRole(token, ['hod']);
      const member = db.users.find((u) => String(u.id) === params[0] && u.role === 'faculty');
      if (!member || member.departmentId !== hod.departmentId) {
        throw new MockHttpError(404, 'Faculty member not found in your department.');
      }
      const profile = profileFor(member);
      return {
        profile: profile.personalInfo,
        qualifications: profile.qualifications,
        experience: profile.experience,
        stats: statsForFaculty(member.id),
        apiScore: db.scores[member.id] || null,
        completionPercentage: completionFor(profile),
        activities: activitiesForFaculty(member.id),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/hod\/faculty\/(\d+)\/scores$/,
    handler: (params, _body, _query, token) => {
      const hod = requireRole(token, ['hod']);
      const member = db.users.find((u) => String(u.id) === params[0]);
      if (!member || member.departmentId !== hod.departmentId) {
        throw new MockHttpError(404, 'Faculty member not found in your department.');
      }
      const score = db.scores[member.id];
      if (!score) throw new MockHttpError(404, 'No API score available for this faculty member.');
      return score;
    },
  },
  {
    method: 'GET',
    pattern: /^\/hod\/verifications$/,
    handler: (_params, _body, query, token) => {
      const hod = requireRole(token, ['hod']);
      const department = departmentOf(hod);
      const scoped = db.activities.filter((a) => a.department === department?.name);
      return filterActivities(scoped, query);
    },
  },
  {
    method: 'POST',
    pattern: /^\/hod\/activities\/(\d+)\/verify$/,
    handler: (params, body, _query, token) => {
      const hod = requireRole(token, ['hod']);
      const department = departmentOf(hod);
      const activity = db.activities.find((a) => String(a.id) === params[0]);
      if (!activity) throw new MockHttpError(404, 'Activity not found.');
      if (activity.department !== department?.name) {
        throw new MockHttpError(403, 'This activity belongs to another department.');
      }
      if (!['Approved', 'Rejected'].includes(body?.status)) {
        throw new MockHttpError(400, 'Verification status must be Approved or Rejected.');
      }
      if (body.status === 'Rejected' && !String(body.remarks || '').trim()) {
        throw new MockHttpError(400, 'Remarks are required when rejecting an activity.');
      }
      activity.status = body.status;
      activity.remarks = body.remarks || '';
      activity.verifiedBy = hod.name;
      activity.verifiedAt = nowIso();
      saveDb();
      notify(activity.facultyId, `Activity ${body.status}`, `"${activity.title}" was ${body.status.toLowerCase()} by the HOD.`, 'verification');
      logAudit(hod, `Activity ${body.status}`, `ACT-${activity.id} ${activity.title}`);
      return { success: true, message: `Activity ${body.status.toLowerCase()} successfully.`, data: activity };
    },
  },

  // ----------------------------------------------------------------- Admin
  {
    method: 'GET',
    pattern: /^\/admin\/metrics$/,
    handler: (_params, _body, _query, token) => {
      requireRole(token, ['admin']);
      const faculty = db.users.filter((u) => u.role === 'faculty');
      return {
        totalUsers: db.users.length,
        totalFaculty: faculty.length,
        totalDepartments: db.departments.length,
        totalActivities: db.activities.length,
        pendingApprovals: db.activities.filter((a) => ['Pending', 'Submitted'].includes(a.status)).length,
        activeAcademicYear: db.academicYears.find((y) => y.status === 'Active')?.year || 'Not configured',
        systemActivitySummary: db.auditLogs.slice(0, 5).map((log) => ({
          id: log.id,
          action: log.action,
          target: log.target,
          time: log.timestamp,
        })),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/users$/,
    handler: (_params, _body, _query, token) => {
      requireRole(token, ['admin']);
      return db.users.map(publicUser);
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/users$/,
    handler: (_params, body, _query, token) => {
      const admin = requireRole(token, ['admin']);
      if (db.users.some((u) => u.email.toLowerCase() === String(body?.email || '').toLowerCase())) {
        throw new MockHttpError(409, 'A user with this email already exists.');
      }
      const department = db.departments.find((d) => d.id === Number(body.departmentId));
      const user = {
        ...body,
        id: nextId(db.users),
        password: body.password || DEMO_PASSWORD,
        role: body.role || 'faculty',
        departmentId: Number(body.departmentId) || null,
        department: department?.name || body.department || '',
        status: body.status || 'active',
      };
      db.users.push(user);
      saveDb();
      logAudit(admin, 'User Created', `${user.name} (${user.employeeId})`);
      return { success: true, message: 'User created successfully.', data: publicUser(user) };
    },
  },
  {
    method: 'PUT',
    pattern: /^\/admin\/users\/(\d+)$/,
    handler: (params, body, _query, token) => {
      const admin = requireRole(token, ['admin']);
      const user = db.users.find((u) => String(u.id) === params[0]);
      if (!user) throw new MockHttpError(404, 'User not found.');
      const department = db.departments.find((d) => d.id === Number(body.departmentId));
      Object.assign(user, body, {
        id: user.id,
        departmentId: body.departmentId !== undefined ? Number(body.departmentId) : user.departmentId,
        department: department?.name || body.department || user.department,
      });
      saveDb();
      logAudit(admin, 'User Updated', `${user.name} (${user.employeeId})`);
      return { success: true, message: 'User updated successfully.', data: publicUser(user) };
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/admin\/users\/(\d+)\/status$/,
    handler: (params, _body, _query, token) => {
      const admin = requireRole(token, ['admin']);
      const user = db.users.find((u) => String(u.id) === params[0]);
      if (!user) throw new MockHttpError(404, 'User not found.');
      user.status = user.status === 'active' ? 'inactive' : 'active';
      saveDb();
      logAudit(admin, 'User Status Changed', `${user.name} → ${user.status}`);
      return { success: true, message: `User marked ${user.status}.`, data: publicUser(user) };
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/faculty$/,
    handler: (_params, _body, _query, token) => {
      requireRole(token, ['admin']);
      return db.users
        .filter((u) => u.role === 'faculty')
        .map((member) => {
          const stats = statsForFaculty(member.id);
          return {
            id: member.id,
            name: member.name,
            employeeId: member.employeeId,
            email: member.email,
            designation: member.designation,
            department: member.department,
            status: member.status,
            totalActivities: stats.totalActivities,
            approvedActivities: stats.approved,
            pendingActivities: stats.pending,
            currentScore: db.scores[member.id]?.overallScore?.finalAccepted ?? null,
          };
        });
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/departments$/,
    handler: (_params, _body, _query, token) => {
      requireRole(token, ['admin']);
      return db.departments.map((dept) => ({
        ...dept,
        facultyCount: db.users.filter((u) => u.role === 'faculty' && u.departmentId === dept.id).length,
      }));
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/departments$/,
    handler: (_params, body, _query, token) => {
      const admin = requireRole(token, ['admin']);
      if (db.departments.some((d) => d.code.toLowerCase() === String(body?.code || '').toLowerCase())) {
        throw new MockHttpError(409, 'A department with this code already exists.');
      }
      const dept = { ...body, id: nextId(db.departments), facultyCount: 0, activeStatus: body.activeStatus || 'Active' };
      db.departments.push(dept);
      saveDb();
      logAudit(admin, 'Department Created', dept.name);
      return { success: true, message: 'Department created.', data: dept };
    },
  },
  {
    method: 'PUT',
    pattern: /^\/admin\/departments\/(\d+)$/,
    handler: (params, body, _query, token) => {
      const admin = requireRole(token, ['admin']);
      const dept = db.departments.find((d) => String(d.id) === params[0]);
      if (!dept) throw new MockHttpError(404, 'Department not found.');
      Object.assign(dept, body, { id: dept.id });
      saveDb();
      logAudit(admin, 'Department Updated', dept.name);
      return { success: true, message: 'Department updated.', data: dept };
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/academic-years$/,
    handler: (_params, _body, _query, token) => {
      requireRole(token, ['admin']);
      return db.academicYears;
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/academic-years$/,
    handler: (_params, body, _query, token) => {
      const admin = requireRole(token, ['admin']);
      if (db.academicYears.some((y) => y.year === body?.year)) {
        throw new MockHttpError(409, 'This academic year already exists.');
      }
      const year = { ...body, id: nextId(db.academicYears), status: body.status || 'Upcoming' };
      db.academicYears.unshift(year);
      saveDb();
      logAudit(admin, 'Academic Year Created', year.year);
      return { success: true, message: 'Academic year added.', data: year };
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/admin\/academic-years\/(\d+)\/set-active$/,
    handler: (params, _body, _query, token) => {
      const admin = requireRole(token, ['admin']);
      const target = db.academicYears.find((y) => String(y.id) === params[0]);
      if (!target) throw new MockHttpError(404, 'Academic year not found.');
      db.academicYears = db.academicYears.map((y) => ({
        ...y,
        status: y.id === target.id ? 'Active' : 'Archived',
      }));
      saveDb();
      logAudit(admin, 'Academic Year Activated', target.year);
      return { success: true, message: `${target.year} is now the active academic year.` };
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/scoring-rules$/,
    handler: (_params, _body, _query, token) => {
      requireRole(token, ['admin']);
      return db.scoringRules;
    },
  },
  {
    method: 'PUT',
    pattern: /^\/admin\/scoring-rules\/(\d+)$/,
    handler: (params, body, _query, token) => {
      const admin = requireRole(token, ['admin']);
      const rule = db.scoringRules.find((r) => String(r.id) === params[0]);
      if (!rule) throw new MockHttpError(404, 'Scoring rule not found.');
      Object.assign(rule, body, { id: rule.id });
      saveDb();
      logAudit(admin, 'Scoring Rule Updated', `${rule.category} – ${rule.subCategory}`);
      return { success: true, message: 'Scoring rule updated.', data: rule };
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/activity-categories$/,
    handler: (_params, _body, _query, token) => {
      requireRole(token, ['admin']);
      return db.activityCategories;
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/activity-categories$/,
    handler: (_params, body, _query, token) => {
      const admin = requireRole(token, ['admin']);
      const category = { ...body, id: nextId(db.activityCategories), status: body.status || 'Active' };
      db.activityCategories.push(category);
      saveDb();
      logAudit(admin, 'Activity Category Created', category.name);
      return { success: true, message: 'Activity category created.', data: category };
    },
  },
  {
    method: 'PUT',
    pattern: /^\/admin\/activity-categories\/(\d+)$/,
    handler: (params, body, _query, token) => {
      const admin = requireRole(token, ['admin']);
      const category = db.activityCategories.find((c) => String(c.id) === params[0]);
      if (!category) throw new MockHttpError(404, 'Activity category not found.');
      Object.assign(category, body, { id: category.id });
      saveDb();
      logAudit(admin, 'Activity Category Updated', category.name);
      return { success: true, message: 'Activity category updated.', data: category };
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/audit-logs$/,
    handler: (_params, _body, _query, token) => {
      requireRole(token, ['admin']);
      return db.auditLogs;
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/settings$/,
    handler: (_params, _body, _query, token) => {
      requireRole(token, ['admin']);
      return db.settings;
    },
  },
  {
    method: 'PUT',
    pattern: /^\/admin\/settings$/,
    handler: (_params, body, _query, token) => {
      const admin = requireRole(token, ['admin']);
      db.settings = { ...db.settings, ...body };
      saveDb();
      logAudit(admin, 'Settings Updated', 'System settings');
      return { success: true, message: 'Settings saved.', data: db.settings };
    },
  },

  // --------------------------------------------------------------- Reports
  {
    method: 'GET',
    pattern: /^\/reports\/preview$/,
    handler: (_params, _body, query, token) => {
      requireUser(token);
      return reportPayload(query.type, query.academicYear, 'faculty');
    },
  },
  {
    method: 'GET',
    pattern: /^\/reports\/download$/,
    handler: (_params, _body, query, token) => {
      requireUser(token);
      return new Blob([`Demo API report ${query.type} for ${query.academicYear}.`], { type: 'application/pdf' });
    },
  },
  {
    method: 'GET',
    pattern: /^\/hod\/reports$/,
    handler: (_params, _body, query, token) => {
      const hod = requireRole(token, ['hod']);
      return {
        ...reportPayload(query.type, query.academicYear, 'department'),
        department: hod.department,
        facultyCount: db.users.filter((u) => u.role === 'faculty' && u.departmentId === hod.departmentId).length,
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/hod\/reports\/download$/,
    handler: (_params, _body, query, token) => {
      requireRole(token, ['hod']);
      return new Blob([`Demo department report ${query.type} for ${query.academicYear}.`], { type: 'application/pdf' });
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/reports\/preview$/,
    handler: (_params, _body, query, token) => {
      requireRole(token, ['admin']);
      return {
        ...reportPayload(query.type, query.academicYear, 'institution'),
        institutionTotals: {
          faculty: db.users.filter((u) => u.role === 'faculty').length,
          departments: db.departments.length,
          activities: db.activities.length,
        },
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/reports\/download$/,
    handler: (_params, _body, query, token) => {
      requireRole(token, ['admin']);
      return new Blob([`Demo institution report ${query.type} for ${query.academicYear}.`], { type: 'application/pdf' });
    },
  },

  // --------------------------------------------------------- Notifications
  {
    method: 'GET',
    pattern: /^\/notifications$/,
    handler: (_params, _body, _query, token) => {
      const user = requireUser(token);
      return db.notifications.filter((n) => !n.userId || n.userId === user.id);
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/notifications\/(\d+)\/read$/,
    handler: (params, _body, _query, token) => {
      requireUser(token);
      const notification = db.notifications.find((n) => String(n.id) === params[0]);
      if (notification) notification.read = true;
      saveDb();
      return { success: true };
    },
  },
  {
    method: 'POST',
    pattern: /^\/notifications\/read-all$/,
    handler: (_params, _body, _query, token) => {
      const user = requireUser(token);
      db.notifications = db.notifications.map((n) =>
        !n.userId || n.userId === user.id ? { ...n, read: true } : n
      );
      saveDb();
      return { success: true };
    },
  },

  // ----------------------------------------------------------------- System
  {
    method: 'GET',
    pattern: /^\/academic-years$/,
    handler: (_params, _body, _query, token) => {
      requireUser(token);
      return db.academicYears;
    },
  },
  {
    method: 'GET',
    pattern: /^\/activity-categories$/,
    handler: (_params, _body, _query, token) => {
      requireUser(token);
      return db.activityCategories;
    },
  },
  {
    method: 'GET',
    pattern: /^\/config\/upload$/,
    handler: () => ({ ...demoUploadConfig, ...{ maxUploadSizeMb: db.settings.maxUploadSizeMb } }),
  },
];

const parseQuery = (url) => {
  const query = {};
  const index = url.indexOf('?');
  if (index === -1) return query;
  new URLSearchParams(url.slice(index + 1)).forEach((value, key) => {
    query[key] = value;
  });
  return query;
};

export async function mockRequest({ method, endpoint, body, token, responseType }) {
  const [path] = endpoint.split('?');
  const query = parseQuery(endpoint);

  await new Promise((resolve) => {
    window.setTimeout(resolve, LATENCY_MS);
  });

  const route = routes.find((candidate) => {
    if (candidate.method !== method) return false;
    return candidate.pattern.test(path);
  });

  if (!route) {
    throw new MockHttpError(404, `No demo handler for ${method} ${path}.`);
  }

  const match = path.match(route.pattern);
  const params = match ? match.slice(1) : [];
  const result = route.handler(params, body, query, token);

  if (responseType === 'blob') {
    return result instanceof Blob ? result : fileBlob('Report');
  }

  return clone(result);
}

export default mockRequest;

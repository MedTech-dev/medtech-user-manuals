// MedTech System Admin portal screenshots — desktop size, mock data, English and Arabic.
//   MEDTECH_FRONTEND=<checkout> node tools/capture/admin.mjs [en|ar|all]
// Needs the admin portal running in mock mode on http://localhost:5380.
//
// Two directories of the portal (Users and Doctors) have no demo data in mock mode. For those two,
// this script answers the portal's requests itself with a small demonstration set (fictional people,
// in the same shapes the portal reads) so the real screens can be shown. Nothing leaves the machine.
import { run } from './lib.mjs';

// ---------------------------------------------------------------- demo data for Users and Doctors
function demoData(lang) {
  const ar = lang === 'ar';
  const n = (en, arText) => (ar ? arText : en);
  const users = [
    { id: 'u-admin-1', displayName: 'Admin One', phoneNumber: '01000000000', email: 'admin@medtech.example', userType: 'admin', roles: ['Admin'], isActive: true, createdDate: '2026-08-01T09:00:00Z' },
    { id: 'u-pt-salma', displayName: n('Salma Tarek Mansour', 'سلمى طارق منصور'), phoneNumber: '01098765432', email: null, userType: 'patient', roles: ['Patient'], isActive: true, createdDate: '2026-10-02T11:20:00Z' },
    { id: 'u-pt-youssef', displayName: n('Youssef Adel Naguib', 'يوسف عادل نجيب'), phoneNumber: '01155554444', email: null, userType: 'patient', roles: ['Patient'], isActive: false, createdDate: '2026-09-21T08:05:00Z' },
    { id: 'u-doctor-1', displayName: n('Dr. Nour Hassan', 'د. نور حسن'), phoneNumber: '01000000002', email: 'nour.hassan@clinic.example', userType: 'doctor', roles: ['Doctor'], isActive: true, createdDate: '2026-08-03T10:00:00Z' },
    { id: 'u-assistant-1', displayName: n('Mona Fahmy', 'منى فهمي'), phoneNumber: '01000000006', email: null, userType: 'assistant', roles: ['Assistant'], isActive: true, createdDate: '2026-08-05T10:00:00Z' },
    { id: 'u-pharm-1', displayName: n('El Ezaby Pharmacy — Nasr City', 'صيدلية العزبي - مدينة نصر'), phoneNumber: '01012345001', email: null, userType: 'pharmacy', roles: ['Pharmacy'], isActive: true, createdDate: '2026-09-10T10:00:00Z' },
    { id: 'u-siof-1', displayName: n('Hala Mansour', 'هالة منصور'), phoneNumber: '01001234567', email: 'ops@sofico.example', userType: 'scientificOffice', roles: ['ScientificOffice', 'SiofAdmin'], isActive: true, createdDate: '2026-08-02T10:00:00Z' },
  ];
  const userDetail = {
    'u-pt-salma': {
      patient: {
        profileId: 'p-salma', fullName: n('Salma Tarek Fouad Mansour', 'سلمى طارق فؤاد منصور'), nationalId: '29103151204567',
        dateOfBirth: '1991-03-15', gender: 'Female', address: n('12 El Tahrir St., Dokki, Giza', '١٢ شارع التحرير، الدقي، الجيزة'),
        phoneNumber: '01098765432', isPspProfileComplete: true,
      },
    },
  };
  const docs = (approved, pending) => {
    const types = ['nationalId', 'syndicateCard', 'practiceLicense', 'degreeCertificate'];
    return types.map((t, i) => ({
      id: 4100 + i, documentType: t, document: `https://files.medtech.example/demo/${t}.pdf`,
      reviewStatus: i < approved ? 'approved' : i < approved + pending ? 'pending' : 'reuploadRequested',
      reviewedAt: i < approved ? '2026-11-03T10:00:00Z' : null, uploadedAt: '2026-11-01T09:30:00Z',
      reviewNote: null,
    }));
  };
  const doctors = [
    { id: '47609b32-c4f9-4fe2-8b62-ce96d011129c', code: 'DOC-EG-47609B', first: ['Ahmed', 'أحمد'], last: ['Hassan', 'حسن'], phoneNumber: '01142676306', state: 'pendingReview', licenseNumber: 'EMS-2017-55120', city: [1, 'Nasr City', 'مدينة نصر'], spec: [1, 'Cardiology', 'قلب وأوعية دموية'], docs: [4, 0], created: '2026-11-01T09:00:00Z' },
    { id: '019feb6e-faa5-71c0-9868-5128dbe0ae15', code: 'DOC-EG-019FEB', first: ['Nour', 'نور'], last: ['Hassan', 'حسن'], phoneNumber: '01000000002', state: 'active', licenseNumber: 'LIC-2019-4471', city: [3, 'Maadi', 'المعادي'], spec: [1, 'Cardiology', 'قلب وأوعية دموية'], docs: [4, 0], created: '2026-08-03T10:00:00Z' },
    { id: 'doc-3', code: 'DOC-EG-3D0C03', first: ['Omar', 'عمر'], last: ['Selim', 'سليم'], phoneNumber: '01223344556', state: 'pendingReview', licenseNumber: 'EMS-2021-10077', city: [2, 'Heliopolis', 'مصر الجديدة'], spec: [2, 'Dermatology', 'جلدية'], docs: [2, 2], created: '2026-11-06T12:00:00Z' },
    { id: 'd-sara', code: 'DOC-EG-2F492A', first: ['Sara', 'سارة'], last: ['Mostafa', 'مصطفى'], phoneNumber: '01011223344', state: 'suspended', licenseNumber: 'EMS-2015-30981', city: [1, 'Nasr City', 'مدينة نصر'], spec: [2, 'Dermatology', 'جلدية'], docs: [4, 0], created: '2026-08-20T10:00:00Z' },
    { id: 'd-mona', code: 'DOC-EG-6E21B4', first: ['Mona', 'منى'], last: ['Saleh', 'صالح'], phoneNumber: '01099887711', state: 'rejected', licenseNumber: 'EMS-2020-44102', city: [4, 'Dokki', 'الدقي'], spec: [5, 'Internal Medicine', 'باطنة'], docs: [3, 0], created: '2026-09-02T10:00:00Z' },
  ];
  const row = (d) => ({
    id: d.id, code: d.code, fullNameEnglish: `${d.first[0]} ${d.last[0]}`, fullNameArabic: `${d.first[1]} ${d.last[1]}`,
    phoneNumber: d.phoneNumber, state: d.state, licenseNumber: d.licenseNumber, cityId: d.city[0], cityNameEn: d.city[1],
    cityNameAr: d.city[2], specialities: [ar ? d.spec[2] : d.spec[1]], documentsTotal: 4, documentsApproved: d.docs[0],
    documentsPending: d.docs[1], createdDate: d.created, stateChangedAt: d.created,
  });
  const detail = (d) => ({
    id: d.id, code: d.code, firstNameEnglish: d.first[0], lastNameEnglish: d.last[0], firstNameArabic: d.first[1], lastNameArabic: d.last[1],
    phoneNumber: d.phoneNumber, email: `${d.first[0].toLowerCase()}.${d.last[0].toLowerCase()}@clinic.example`, state: d.state,
    rejectionReason: null, stateChangedAt: '2026-11-04T08:00:00Z', licenseNumber: d.licenseNumber, cityId: d.city[0], cityNameEn: d.city[1],
    cityNameAr: d.city[2], educationLevel: 'consultantDoctor',
    aboutMeEnglish: 'Consultant with fifteen years of practice.',
    aboutMeArabic: 'استشاري، خبرة خمسة عشر عامًا.',
    profileImage: null, feesMin: 400, feesMax: 650, ratingCount: 0, starRating: 0, specialityIds: [d.spec[0]],
    specialities: [ar ? d.spec[2] : d.spec[1]], documents: docs(d.docs[0], d.docs[1]),
    stateHistory: [
      { fromState: 'draft', toState: 'pendingReview', reason: null, changedByUserId: null, changedAt: '2026-11-04T08:00:00Z' },
    ],
    activationBlockers: d.state === 'pendingReview' && d.docs[0] < 4
      ? [
          { code: 'document_unapproved', message: 'Practice license is awaiting approval.', field: 'practiceLicense' },
          { code: 'document_unapproved', message: 'Degree certificate is awaiting approval.', field: 'degreeCertificate' },
        ]
      : [],
    createdDate: d.created,
  });
  return { users, userDetail, doctors, row, detail };
}

const ok = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: null, data }) });
const pageOf = (items) => ({ data: items, currentPage: 1, totalPages: 1, totalCount: items.length, pageSize: 20, hasPreviousPage: false, hasNextPage: false });

async function serveDemoDirectories(context, lang) {
  const d = demoData(lang);
  await context.route(/\/api\/admin\/users(\/[^?]*)?(\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/')[4];
    if (route.request().method() !== 'GET') return route.fulfill(ok(true));
    if (!id) {
      const q = (url.searchParams.get('search') ?? '').toLowerCase();
      const type = url.searchParams.get('userType');
      const items = d.users.filter((u) => (!q || `${u.displayName} ${u.phoneNumber} ${u.email ?? ''}`.toLowerCase().includes(q)) && (!type || u.userType === type));
      return route.fulfill(ok(pageOf(items)));
    }
    const u = d.users.find((x) => x.id === id);
    return route.fulfill(ok({ ...u, patient: null, doctor: null, pharmacy: null, assistant: null, scientificOffice: null, ...(d.userDetail[id] ?? {}) }));
  });
  await context.route(/\/api\/admin\/doctors(\/[^?]*)?(\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/')[4];
    if (route.request().method() !== 'GET') return route.fulfill(ok(null));
    if (!id) return route.fulfill(ok(pageOf(d.doctors.map(d.row))));
    const doc = d.doctors.find((x) => x.id === id);
    if (url.pathname.endsWith('/activation-blockers')) return route.fulfill(ok(d.detail(doc).activationBlockers));
    return route.fulfill(ok(d.detail(doc)));
  });
}

await run('admin', { port: 5380, device: 'desktop', source: 'medtech-frontend main (mock data)' }, async ({ context, page, L, shot, focus, base, lang }) => {
  const key = (k) => L.key(`admin.${k}`);
  const ck = (k) => L.key(`common.${k}`);
  const btn = (name, o = {}) => page.getByRole('button', { name, ...o });
  const link = (name, o = {}) => page.getByRole('link', { name, ...o });
  const text = (s, o = {}) => page.getByText(s, o).first();
  const heading = (name, o = {}) => page.getByRole('heading', { name, ...o });
  const dialog = page.getByRole('dialog');
  const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** A form label by its leading text — markers on labels stay clear of the neighbouring column. */
  const lbl = (s, scope = page) => scope.locator('label').filter({ hasText: new RegExp('^\\s*' + escRe(s)) }).first();
  const ar = lang === 'ar';
  /** Toward the outer edge of the page in this language: some elements need the marker on their inner side in Arabic. */
  const inward = (en) => (ar ? (en === 'start' ? 'end' : 'start') : en);
  const navBadge = (k) => [link(key(k)).locator('span').last(), inward('start')];
  const go = async (path, ready) => {
    await page.goto(`${base}${path}`);
    await ready.waitFor();
    await page.waitForTimeout(500);
  };

  // The "Notification composer" entry is an unfinished screen that only appears in demo builds.
  await context.addInitScript(() => {
    const css = 'a[href="/notifications/composer"]{display:none!important}';
    const add = () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  });
  await serveDemoDirectories(context, lang);

  // ---------------------------------------------------------------- sign in
  await page.goto(`${base}/login`);
  await page.getByLabel(L('Phone number')).waitFor();
  // The mock-mode sign-in hint is a developer aid, not part of the real screen.
  await text(ck('auth.devHint.admin')).evaluate((el) => { el.style.display = 'none'; });
  await page.getByLabel(L('Phone number')).fill('01000000000');
  await page.getByLabel(L('Password'), { exact: true }).fill('demo-pass');
  await shot('sign-in', {
    1: page.getByLabel(L('Phone number')),
    2: [lbl(L('Password')), ar ? 'end' : 'start'],
    3: [btn(L('Show password')), ar ? 'start' : 'end'],
    4: btn(L('Sign in')),
    5: [btn(/^(العربية|English)$/), 'start'],
  });
  await btn(L('Sign in')).click();
  await link(key('nav.clinicApprovals')).waitFor();

  // ---------------------------------------------------------------- home
  const main = page.locator('main');
  await go('/', text(key('dashboard.card.registeredPatients')));
  await shot('home', {
    1: text(ck('nav.menu'), { exact: true }),
    2: navBadge('nav.pspMisuse'),
    3: main.getByText(/^[2٢]$/),
    4: main.getByText(/^[4٤]$/),
    5: link(key('dashboard.next.action')),
    6: btn(ck('settings.title')),
  });

  // ---------------------------------------------------------------- scientific offices
  await go('/tenants', link('Sofico Scientific Office').first());
  await shot('tenants', {
    1: link(key('tenants.add')).first(),
    2: link('Sofico Scientific Office').first(),
    3: text('SIOF-EG-000001'),
    4: main.getByText(L.key('common.status.org.onboarding'), { exact: true }).first(),
    5: page.getByRole('row').nth(1).getByRole('cell').nth(3),
  });

  await link(key('tenants.add')).first().click();
  const orgName = page.getByLabel(key('field.orgName'));
  await orgName.waitFor();
  await orgName.fill('Cairo Care Scientific Office');
  await page.getByLabel(L.key('admin.field.email'), { exact: true }).fill('office@cairocare.example');
  await page.getByLabel(L.key('common.field.phone'), { exact: true }).fill('0223456789');
  const delegate = page.getByLabel(key('tenants.form.pharmacyEnrolmentDelegable'));
  await page.getByLabel(key('field.ownerName')).fill(lang === 'ar' ? 'رانيا فوزي' : 'Rania Fawzy');
  await page.getByLabel(key('field.ownerPhone')).fill('01012340099');
  await page.getByLabel(key('field.ownerPassword')).fill('Welcome2026x');
  await shot('tenant-new', {
    1: lbl(key('field.orgName')),
    2: lbl(key('tenants.col.status')),
    3: lbl(key('tenants.form.pharmacyEnrolmentDelegable')),
    4: text(key('tenants.new.ownerSection'), { exact: true }),
    5: page.getByLabel(key('field.ownerPassword')),
    6: btn(key('tenants.new.submit')),
  }, { full: true });
  await btn(key('tenants.new.submit')).click();
  await heading('Cairo Care Scientific Office').waitFor();

  await go('/tenants', link('Sofico Scientific Office').first());
  await link('Sofico Scientific Office').first().click();
  await btn(key('tenants.detail.edit')).waitFor();
  await page.waitForTimeout(500);
  await shot('tenant-detail', {
    1: heading('Sofico Scientific Office'),
    2: [main.getByText(L.key('common.status.org.onboarding'), { exact: true }).first(), 'start'],
    3: btn(key('tenants.detail.activate')),
    4: text(key('tenants.detail.pharmacyEnrolment'), { exact: true }),
    5: text(key('tenants.detail.ownerCard'), { exact: true }),
    6: text(key('tenants.detail.programsCard'), { exact: true }),
  });

  await go('/tenants', link('Nile Medical Office').first());
  await link('Nile Medical Office').first().click();
  await btn(key('tenants.detail.edit')).click();
  const delegateEdit = dialog.getByLabel(key('tenants.form.pharmacyEnrolmentDelegable'));
  await delegateEdit.check();
  await shot('tenant-edit', {
    1: dialog.getByRole('heading', { name: key('tenants.edit.title') }),
    2: lbl(key('field.orgName'), dialog),
    3: lbl(key('tenants.form.pharmacyEnrolmentDelegable'), dialog),
    4: dialog.getByRole('button', { name: ck('common.save'), exact: true }),
  }, { clip: dialog });
  await dialog.getByRole('button', { name: ck('common.save'), exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });

  // ---------------------------------------------------------------- users
  const salma = lang === 'ar' ? 'سلمى طارق منصور' : 'Salma Tarek Mansour';
  await go('/users', text(salma).first());
  const salmaRow = page.getByRole('row', { name: new RegExp(salma) });
  await shot('users', {
    1: [page.getByRole('searchbox'), 'top'],
    2: [page.getByRole('combobox', { name: key('users.col.type') }), 'top'],
    3: [page.getByRole('combobox', { name: key('users.col.status') }), 'top'],
    4: [salmaRow.getByRole('button', { name: L.reKey('admin.users.detail.open') }).last(), 'start'],
    5: btn(L.key('common.users.deactivate')).last(),
    6: salmaRow.getByRole('button', { name: L.reKey('admin.users.deletePatient.for') }),
    7: text(L.key('common.users.self'), { exact: true }),
  });

  await page.getByRole('row', { name: new RegExp(salma) }).getByRole('button').first().click();
  const nid = dialog.getByText(/•|\*{3}|x{3}/).first();
  await dialog.getByText(key('users.detail.patient'), { exact: true }).waitFor();
  await page.waitForTimeout(400);
  await shot('user-detail', {
    1: dialog.getByRole('heading').first(),
    2: dialog.getByText(L.key('admin.userType.patient'), { exact: false }).first(),
    3: dialog.getByText(key('users.detail.patient'), { exact: true }),
    4: dialog.getByRole('button', { name: L.key('common.common.reveal') }),
    5: dialog.getByText(key('users.detail.pspProfile'), { exact: true }),
  }, { clip: dialog });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });

  await btn(L.reKey('admin.users.deletePatient.for')).first().click();
  await dialog.getByText(key('users.deletePatient.mode.soft'), { exact: true }).waitFor();
  await page.waitForTimeout(300);
  await shot('delete-soft', {
    1: dialog.getByText(key('users.deletePatient.mode.soft'), { exact: true }),
    2: dialog.getByText(key('users.deletePatient.effect.phone')),
    3: dialog.getByText(key('users.deletePatient.softWarning').slice(0, 40)),
    4: dialog.getByText(key('users.deletePatient.mode.permanent'), { exact: true }),
    5: dialog.getByRole('button', { name: key('users.deletePatient.confirm') }),
  }, { clip: dialog });
  await dialog.getByText(key('users.deletePatient.mode.permanent'), { exact: true }).click();
  const arm = dialog.getByLabel(key('users.deletePatient.armLabel'));
  await arm.fill('01098765432');
  await shot('delete-permanent', {
    1: dialog.getByText(key('users.deletePatient.mode.permanent'), { exact: true }),
    2: dialog.getByText(key('users.deletePatient.permanent.everything').slice(0, 40)),
    3: dialog.getByText(key('users.deletePatient.permanent.stock').slice(0, 40)),
    4: arm,
    5: dialog.getByRole('button', { name: key('users.deletePatient.permanentConfirm') }),
  }, { clip: dialog });
  await page.keyboard.press('Escape');

  // ---------------------------------------------------------------- doctors
  const ahmed = lang === 'ar' ? 'أحمد حسن' : 'Ahmed Hassan';
  await go('/doctors', link(ahmed).first());
  await shot('doctors', {
    1: link(key('doctors.list.add')).first(),
    2: [page.getByPlaceholder(key('doctors.list.searchPlaceholder')), 'top'],
    3: [page.getByRole('combobox', { name: key('doctors.list.col.state') }), 'top'],
    4: link(ahmed).first(),
    5: text('DOC-EG-019FEB'),
    6: main.getByText(L.key('common.status.doctor.pendingReview'), { exact: true }).first(),
    7: text(L.reKey('admin.doctors.list.documentsProgress')).first(),
  });

  await link(key('doctors.list.add')).first().click();
  const firstEn = page.getByLabel(key('field.firstNameEnglish'), { exact: true });
  await firstEn.waitFor();
  await firstEn.fill('Hany');
  await page.getByLabel(key('field.lastNameEnglish'), { exact: true }).fill('Ragab');
  await page.getByLabel(key('field.firstNameArabic'), { exact: true }).fill('هاني');
  await page.getByLabel(key('field.lastNameArabic'), { exact: true }).fill('رجب');
  await page.getByLabel(L.key('common.field.phone'), { exact: true }).fill('01234567890');
  await page.getByLabel(key('field.doctorPassword')).fill('Welcome2026x');
  await page.getByLabel(L.key('common.field.licenseNumber')).fill('EMS-2022-18820');
  await page.waitForTimeout(400);
  await shot('doctor-new', {
    1: lbl(key('field.firstNameEnglish')),
    2: lbl(key('field.firstNameArabic')),
    3: lbl(L.key('common.field.phone')),
    4: lbl(key('field.doctorPassword')),
    5: lbl(L.key('common.field.licenseNumber')),
    6: text(L.key('common.field.specialty'), { exact: true }).last(),
    7: btn(key('doctors.new.submit')),
  }, { full: true });

  await go('/doctors', link(ahmed).first());
  await link(ahmed).first().click();
  await text(key('doctors.activation.title'), { exact: true }).waitFor();
  await page.waitForTimeout(600);
  await shot('doctor-detail', {
    1: text('DOC-EG-47609B'),
    2: text(key('doctors.detail.profileCard'), { exact: true }),
    3: text(key('doctors.activation.title'), { exact: true }),
    4: [btn(key('doctors.activation.action')), 'start'],
    5: btn(key('doctors.state.action.rejected'), { exact: true }),
    6: btn(key('doctors.state.action.deactivated'), { exact: true }),
  });

  const omar = lang === 'ar' ? 'عمر سليم' : 'Omar Selim';
  await go('/doctors', link(omar).first());
  await link(omar).first().click();
  const docsTitle = text(key('doctors.detail.documentsCard'), { exact: true });
  await docsTitle.waitFor();
  await page.waitForTimeout(600);
  const docsCard = docsTitle.locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
  const pendingDoc = page.getByRole('row').filter({ hasText: L.key('common.docType.practiceLicense') });
  await shot('doctor-documents', {
    1: docsTitle,
    2: link(key('doctors.detail.documents.open')).first(),
    3: page.getByRole('row').nth(1).getByRole('cell').nth(3),
    4: [pendingDoc.getByRole('button', { name: key('common.approve'), exact: true }), 'start'],
    5: pendingDoc.getByRole('button', { name: key('common.reject'), exact: true }),
  }, { clip: docsCard });

  // ---------------------------------------------------------------- pharmacies
  await go('/pharmacies', text('PHA-EG-3F8A2C'));
  await shot('pharmacies', {
    1: btn(key('pharmacies.list.add')).first(),
    2: page.getByPlaceholder(key('pharmacies.list.searchPlaceholder')),
    3: text('PHA-EG-3F8A2C'),
    4: main.getByText(L.key('admin.providers.status.pending'), { exact: true }).first(),
    5: btn(key('pharmacies.list.resetPassword')).first(),
  });

  await btn(key('pharmacies.list.add')).first().click();
  await dialog.getByLabel(key('pharmacies.field.licenceNumber')).fill('EDA-PH-14550');
  await dialog.getByLabel(L.key('common.field.phone'), { exact: true }).fill('01012345001');
  await dialog.getByLabel(key('pharmacies.field.nameAr')).fill('صيدلية النور - مدينة نصر');
  await dialog.getByLabel(key('pharmacies.field.nameEn')).fill('Al Nour Pharmacy — Nasr City');
  await page.waitForTimeout(300);
  await shot('pharmacy-new', {
    1: lbl(key('pharmacies.field.licenceNumber'), dialog),
    2: lbl(L.key('common.field.phone'), dialog),
    3: lbl(key('pharmacies.field.nameAr'), dialog),
    4: dialog.getByLabel(key('pharmacies.field.temporaryPassword')),
    5: dialog.getByRole('button', { name: key('pharmacies.create.submit') }),
  }, { clip: dialog });
  await dialog.getByRole('button', { name: key('pharmacies.create.submit') }).click();
  await dialog.getByText(key('pharmacies.created.title'), { exact: true }).waitFor();
  await page.waitForTimeout(400);
  await shot('pharmacy-created', {
    1: dialog.getByText(key('pharmacies.created.codeLabel'), { exact: true }),
    2: dialog.getByRole('button', { name: key('pharmacies.created.copy'), exact: true }),
    3: dialog.getByText(key('pharmacies.created.passwordLabel'), { exact: true }),
    4: dialog.getByText(key('pharmacies.created.passwordOnce')),
    5: dialog.getByText(L.reKey('admin.pharmacies.created.warnings.title_one')),
    6: dialog.getByRole('button', { name: key('pharmacies.created.done') }),
  }, { clip: dialog });
  await dialog.getByRole('button', { name: key('pharmacies.created.done') }).click();
  await dialog.waitFor({ state: 'hidden' });

  await page.getByRole('row', { name: /PHA-EG-7B41D9/ }).getByRole('button', { name: key('pharmacies.list.resetPassword') }).click();
  await dialog.getByRole('button', { name: key('pharmacies.reset.confirm.submit') }).click();
  await dialog.getByText(key('pharmacies.reset.done.title'), { exact: true }).waitFor();
  await page.waitForTimeout(400);
  await shot('pharmacy-reset', {
    1: dialog.getByText(key('pharmacies.reset.done.title'), { exact: true }),
    2: dialog.getByRole('button', { name: key('pharmacies.created.copyPassword') }),
  }, { clip: dialog });
  await page.keyboard.press('Escape');

  await go('/pharmacies', text('PHA-EG-3F8A2C'));
  await page.getByRole('row', { name: /PHA-EG-3F8A2C/ }).getByRole('link').first().click();
  await text(key('pharmacies.detail.identity'), { exact: true }).waitFor();
  await page.waitForTimeout(500);
  await shot('pharmacy-detail', {
    1: heading(/./).first(),
    2: text(key('pharmacies.detail.identity'), { exact: true }),
    3: text(key('pharmacies.detail.location'), { exact: true }),
    4: text(key('pharmacies.detail.linkedSiofs'), { exact: true }),
    5: text(key('pharmacies.detail.linkedProgrammes'), { exact: true }),
    6: [btn(key('pharmacies.list.resetPassword')), 'bottom'],
  });

  // ---------------------------------------------------------------- provider dedup
  await go('/providers', btn(key('providers.action.merge')).first());
  await shot('providers', {
    1: text(key('providers.filter.entity'), { exact: true }),
    2: text(key('providers.filter.status'), { exact: true }),
    3: [text(L.reKey('admin.providers.compare.score')), 'start'],
    4: text(key('providers.compare.differs'), { exact: true }),
    5: [btn(key('providers.action.merge')).first(), 'start'],
    6: btn(key('providers.action.notAMatch'), { exact: true }).first(),
  });
  await btn(key('providers.action.merge')).first().click();
  await dialog.getByText(key('providers.merge.chooseSurvivor')).waitFor();
  await dialog.getByRole('radio').first().check();
  await page.waitForTimeout(300);
  await shot('provider-merge', {
    1: dialog.getByText(key('providers.merge.chooseSurvivor')),
    2: [dialog.getByRole('radio').first(), 'start'],
    3: dialog.getByText(L.reKey('admin.providers.merge.summary')),
    4: dialog.getByText(key('providers.merge.irreversible').slice(0, 30)),
    5: dialog.getByRole('button', { name: key('providers.merge.confirm') }),
  }, { clip: dialog });
  await page.keyboard.press('Escape');

  // ---------------------------------------------------------------- clinics
  await go('/clinic-approvals', page.locator('tbody tr').first());
  const firstRow = page.locator('tbody tr').first();
  await shot('clinics', {
    1: [btn(key('clinicApprovals.view.queue')), 'start'],
    2: btn(key('clinicApprovals.view.registry')),
    3: firstRow.getByText(L.key('common.clinicApprovals.viewLicense')),
    4: [firstRow.getByRole('button', { name: key('common.approve'), exact: true }), 'start'],
    5: firstRow.getByRole('button', { name: key('common.reject'), exact: true }),
  });

  await page.goto(`${base}/clinic-approvals/01a05712-7c6b-713d-9aea-92afcca4d652`);
  await btn(key('common.approve'), { exact: true }).waitFor();
  await page.waitForTimeout(600);
  await text(key('clinicDetail.owner'), { exact: true }).evaluate((el) => { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -110); });
  await page.waitForTimeout(300);
  await shot('clinic-detail', {
    1: text(key('clinicDetail.owner'), { exact: true }),
    2: text(key('clinicDetail.hours'), { exact: true }),
    3: text(key('clinicDetail.fees'), { exact: true }),
  });

  // A clinic with no opening hours cannot be approved yet.
  await page.goto(`${base}/clinic-approvals/019fd299-ca8f-701f-8674-303e9be4d466`);
  await btn(key('common.reject'), { exact: true }).waitFor();
  await page.waitForTimeout(600);
  await shot('clinic-no-hours', {
    1: main.getByText(L.key('common.status.clinic.pendingReview'), { exact: true }).first(),
    2: text(key('clinicDetail.cannotApproveNoHours')),
    3: [btn(key('common.approve'), { exact: true }), 'start'],
    4: btn(key('common.reject'), { exact: true }),
  });

  // ---------------------------------------------------------------- legal changes
  await go('/legal-changes', btn(key('legalChanges.approve'), { exact: true }).first());
  const firstReq = page.locator('li:visible').filter({ has: btn(key('legalChanges.approve'), { exact: true }) }).first();
  await shot('legal-changes', {
    1: page.getByRole('tablist').or(page.getByRole('group')).first(),
    2: firstReq.getByText(L.key('common.legalRequest.pending'), { exact: true }),
    3: firstReq.locator('dd').nth(0),
    4: firstReq.locator('dd').nth(2),
    5: btn(key('legalChanges.reject'), { exact: true }).first(),
  });

  // ---------------------------------------------------------------- PSP settings
  await go('/psp/settings', page.getByLabel(key('adminPsp.limit.maxCoupons')));
  const limitCard = page.locator('section, div.rounded-xl, [class*="card"]').filter({ has: text(key('adminPsp.limit.title'), { exact: true }) }).last();
  // Save once so the card shows who saved it last.
  await btn(key('adminPsp.limit.save')).click();
  await text(key('adminPsp.limit.saved')).waitFor();
  await text(key('adminPsp.limit.saved')).waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
  await shot('psp-limit', {
    1: lbl(key('adminPsp.limit.maxCoupons')),
    2: lbl(key('adminPsp.limit.periodDays')),
    3: btn(key('adminPsp.limit.save')),
    4: text(L.reKey('admin.adminPsp.limit.updated')),
    5: text(key('adminPsp.limit.reachedNote')),
  }, { clip: limitCard });

  const fieldsTitle = text(key('adminPsp.fields.title'), { exact: true });
  await fieldsTitle.evaluate((el) => { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90); });
  await page.waitForTimeout(300);
  const nidRow = page.locator('li', { has: page.getByText(L.key('common.field.nationalId'), { exact: true }) }).first();
  await shot('registration-fields', {
    1: [btn(key('adminPsp.fields.add')).first(), 'start'],
    2: text(key('adminPsp.fields.defaultsTitle'), { exact: true }),
    3: page.locator('h4').filter({ hasText: new RegExp('^' + key('adminPsp.fields.visibleTitle')) }),
    4: [nidRow.getByText(key('adminPsp.fields.required'), { exact: true }), 'start'],
    5: nidRow.getByRole('button', { name: key('adminPsp.fields.hideAction') }),
  });

  // ---------------------------------------------------------------- health conditions
  await go('/psp/conditions', page.getByRole('row', { name: /Hemophilia|هيموفيليا/ }));
  const hem = page.getByRole('row', { name: /Hemophilia|هيموفيليا/ });
  await shot('conditions', {
    1: [btn(key('adminPsp.conditions.add')).first(), 'start'],
    2: hem.getByRole('cell').nth(2),
    3: hem.getByRole('button', { name: key('adminPsp.conditions.deactivate') }),
    4: [text(L.reKey('admin.adminPsp.conditions.deactivateWarning')), 'bottom'],
    5: page.getByRole('row', { name: /Hepatitis C|التهاب الكبد/ }).getByRole('button', { name: key('adminPsp.conditions.activate') }),
  });

  // ---------------------------------------------------------------- abuse flags
  await go('/psp/misuse', text('ANON-77874BC1').first());
  const flagRow = page.getByRole('row').filter({ hasText: 'ANON-77874BC1' }).last();
  await shot('misuse', {
    1: navBadge('nav.pspMisuse'),
    2: [text(key('adminPsp.misuse.anonymousHint')), 'bottom'],
    3: text(key('adminPsp.misuse.filter.status'), { exact: true }),
    4: text(key('adminPsp.misuse.filter.target'), { exact: true }),
    5: flagRow.getByText('ANON-77874BC1'),
    6: [flagRow.getByRole('button', { name: key('adminPsp.misuse.warn'), exact: true }), 'start'],
    7: [link(key('adminPsp.misuse.viewSignals')).or(btn(key('adminPsp.misuse.viewSignals'))), 'start'],
  });
  await flagRow.getByRole('button', { name: key('adminPsp.misuse.warn'), exact: true }).click();
  await dialog.getByLabel(/./).first().waitFor();
  await dialog.getByRole('textbox').fill(lang === 'ar' ? 'أول مرة يصل فيها للحد؛ طلبنا من المشغّل مراجعة العلاج الثاني.' : 'First limit hit; operator asked to verify the second treatment.');
  await shot('misuse-warn', {
    1: dialog.getByRole('heading').first(),
    2: dialog.getByText(key('adminPsp.misuse.confirm.warnBody')),
    3: dialog.getByRole('textbox'),
    4: dialog.getByRole('button', { name: key('adminPsp.misuse.warn'), exact: true }),
  }, { clip: dialog });
  await page.keyboard.press('Escape');

  // ---------------------------------------------------------------- PSP dashboards
  await go('/psp/dashboards', text(L.key('common.metrics.vsPrevious')).first());
  await page.waitForTimeout(1200);
  await shot('dashboards', {
    1: page.getByRole('tab', { name: L.key('common.metrics.tab.abuse') }),
    2: btn(L.key('common.metrics.filter.range365')),
    3: text(L.key('common.metrics.vsPrevious')),
    4: [btn(L.key('common.metrics.export')).first(), ar ? 'end' : 'start'],
    5: [btn(L.key('common.metrics.display.bar')).first(), 'start'],
  });
  await page.getByRole('tab', { name: L.key('common.metrics.tab.abuse') }).click();
  await text(L.key('common.metrics.abuse.rule')).waitFor();
  await text(/^ANON-\d+$/).first().waitFor();
  await page.waitForTimeout(1000);
  await shot('dashboards-abuse', {
    1: text(L.key('common.metrics.abuse.rule')),
    2: text(/^ANON-\d+$/),
    3: page.getByRole('combobox').first(),
  });

  // ---------------------------------------------------------------- analytics
  await go('/analytics', text(key('analytics.drugDemand.title'), { exact: true }));
  await shot('analytics', {
    1: text(key('analytics.filter.drug'), { exact: true }),
    2: text(key('analytics.filter.from'), { exact: true }),
    3: text(key('analytics.discount.basic'), { exact: true }),
    4: text(key('analytics.drugDemand.title'), { exact: true }),
    5: text(key('analytics.topSiofs.title'), { exact: true }),
  });

  // ---------------------------------------------------------------- box corrections
  await go('/psp/corrections', page.getByLabel(L.key('admin.billing.corrections.reference.label')));
  await page.getByLabel(key('billing.corrections.reference.label')).fill('DLV-26-000101');
  await btn(key('billing.corrections.resolve.cta')).click();
  await text('ZXA-5001').first().waitFor();
  await page.getByLabel(key('billing.corrections.newSerial.label')).fill('ZXB-7010');
  await page.getByLabel(key('billing.corrections.reason.label')).fill(lang === 'ar' ? 'الصيدلي كتب رقم العلبة المجاورة' : 'Pharmacist typed the neighbouring box');
  await shot('corrections', {
    1: lbl(key('billing.corrections.reference.label')),
    2: [text('ZXA-5001'), ar ? 'start' : 'end'],
    3: text(key('billing.corrections.moneyFrozen')),
    4: lbl(key('billing.corrections.newSerial.label')),
    5: lbl(key('billing.corrections.reason.label')),
    6: [btn(key('billing.corrections.correct.cta'), { exact: true }), ar ? 'top' : 'end'],
  });
  await btn(key('billing.corrections.correct.cta'), { exact: true }).click();
  await text('ZXA-5001 → ZXB-7010').waitFor();
  await focus(text(key('billing.corrections.history.title'), { exact: true }));
  await shot('corrections-history', {
    1: [text('ZXB-7010', { exact: true }), ar ? 'start' : 'end'],
    2: text(key('billing.corrections.history.title'), { exact: true }),
    3: text('ZXA-5001 → ZXB-7010'),
  });

  // ---------------------------------------------------------------- notifications
  await go('/notifications', btn(L('Mark all as read')));
  await shot('notifications', {
    1: [btn(L('Mark all as read')), 'start'],
    2: btn(L.key('common.notifications.filter.unread'), { exact: true }),
    3: text(/ANON-77874BC1/),
    4: link(L.key('common.nav.notifications')).locator('span').last(),
  });
});

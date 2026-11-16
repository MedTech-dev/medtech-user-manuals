// Doctor portal screenshots — desktop size, mock data, English and Arabic.
//   MEDTECH_FRONTEND=<checkout> node tools/capture/doctor.mjs [en|ar|all]
// Needs the doctor portal running in mock mode on http://localhost:5382.
// ONLY=<section,section> runs just those sections (sign-in always runs) — handy while iterating.
import { run, session } from './lib.mjs';

const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
const SOURCE = 'medtech-frontend main (mock data)';

/** Shared helpers for one capture session. */
function helpers({ page, L, base }) {
  const key = (k) => L.key(`doctor.${k}`);
  const ckey = (k) => L.key(`common.${k}`);
  /** A menu label: the doctor catalogue first, then the shared one. */
  const navKey = (k) => { try { return L.key(`doctor.nav.${k}`); } catch { return L.key(`common.nav.${k}`); } };
  const btn = (name, o = {}) => page.getByRole('button', { name, ...o });
  const link = (name, o = {}) => page.getByRole('link', { name, ...o });
  const text = (s, o = {}) => page.getByText(s, o);
  const main = page.getByRole('main');
  const nav = page.getByRole('navigation', { name: ckey('nav.primary') });
  const settle = (ms = 500) => page.waitForTimeout(ms);
  /** A full page load: fresh demo data, no lingering toasts. */
  const open = async (path, ready) => {
    await page.goto(`${base}${path}`);
    if (ready) await ready.first().waitFor();
    await settle();
  };
  /** Radix selects open on pointerdown and can close again on a slow pointerup — retry until it stays open. */
  const openSelect = async (trigger) => {
    for (let i = 0; i < 5; i++) {
      await trigger.click();
      await settle(250);
      if ((await trigger.getAttribute('aria-expanded')) === 'true') return;
    }
    throw new Error('select did not open');
  };
  const pick = async (trigger, option) => {
    await openSelect(trigger);
    await page.getByRole('option', { name: option }).first().click();
    await settle(250);
  };
  async function signIn(phone) {
    await page.goto(`${base}/login`);
    await page.getByLabel(L('Phone number')).waitFor();
    // The mock-mode sign-in hint is a developer aid, not part of the real screen.
    await text(ckey('auth.devHint.doctor')).evaluate((el) => { el.style.display = 'none'; });
    await page.getByLabel(L('Phone number')).fill(phone);
    await page.getByLabel(L('Password'), { exact: true }).fill('demo-pass');
  }
  async function submitSignIn() {
    await btn(L('Sign in')).click();
    await nav.waitFor();
    await settle(800);
  }
  /** Any plural form of a counted string (Arabic has six), as one RegExp. */
  const plural = (k) => new RegExp(['zero', 'one', 'two', 'few', 'many', 'other']
    .map((f) => { try { return L.reKey(`${k}_${f}`).source; } catch { return null; } })
    .filter(Boolean).join('|'));
  return { key, ckey, navKey, btn, link, text, main, nav, settle, open, openSelect, pick, plural, signIn, submitSignIn };
}

await run('doctor', { port: 5382, device: 'desktop', source: SOURCE }, async (s) => {
  const { page, L, shot, focus, lang } = s;
  const { key, ckey, navKey, btn, link, text, main, nav, settle, open, openSelect, pick, plural, signIn, submitSignIn } = helpers(s);
  /** The first programme that can still be chosen, in an open programme list. */
  const openProgramme = page.locator('[role="option"]:not([aria-disabled="true"])').first();
  const ar = lang === 'ar';

  // ---------------------------------------------------------------- sign in
  await signIn('01000000002');
  await shot('sign-in', {
    1: [page.getByLabel(L('Phone number')), 'top'],
    2: [page.getByLabel(L('Password'), { exact: true }), 'top'],
    3: [btn(L('Show password')), 'top'],
    4: btn(L('Sign in')),
    5: [btn(/^(العربية|English)$/), 'start'],
    6: link(ckey('auth.userGuide')),
  });
  await submitSignIn();

  // ---------------------------------------------------------------- finding your way
  if (want('home')) {
    await open('/', page.getByRole('heading', { name: key('psp.balance.title') }));
    await shot('home', {
      1: nav.getByRole('link', { name: navKey('balance') }),
      2: nav.getByRole('link', { name: navKey('bookings') }),
      3: nav.getByRole('link', { name: navKey('giveCoupon') }),
      4: nav.getByRole('link', { name: navKey('notifications') }),
      5: [page.locator('header p[title]').last().locator('xpath=../..'), 'start'],
      6: [btn(new RegExp(`${ckey('theme.switchToDark')}|${ckey('theme.switchToLight')}`)), 'bottom'],
      7: [btn(ckey('settings.title'), { exact: true }), 'bottom'],
    });

  }

  // ---------------------------------------------------------------- appointments
  if (want('appointments')) {
    const cardLink = link(L.reKey('doctor.bookings.card.open'));
    await open('/bookings', cardLink);
    const pending = ckey('status.booking.pendingApproval');
    const pendingRow = cardLink.filter({ hasText: pending }).first();
    await shot('appointments-list', {
      1: btn(key('bookings.view.calendar')),
      2: [btn(key('bookings.filter.all'), { exact: true }), 'start'],
      3: btn(key('bookings.filter.more')),
      4: [main.getByRole('link', { name: new RegExp(key('clinicSessions.title') + ' · ') }).first(), 'center'],
      5: pendingRow.getByText(pending, { exact: true }),
      6: main.getByText(L.reKey('doctor.bookings.psp.badge')).first(),
    });

    await btn(key('bookings.view.calendar')).click();
    await btn(key('calendar.today'), { exact: true }).first().waitFor();
    await settle(800);
    const walkInBlock = main.getByLabel(new RegExp(key('clinicSessions.title'))).last();
    await shot('appointments-calendar', {
      1: [btn(key('calendar.previous')), 'start'],
      2: btn(key('calendar.scale.week'), { exact: true }),
      3: [text(key('calendar.legend.appointment')).first(), 'start'],
      4: walkInBlock.getByText(key('clinicSessions.title'), { exact: true }),
      5: [page.getByRole('separator', { name: key('calendar.now') }), 'center'],
    });

    // A request waiting for your decision.
    await open('/bookings/1001', btn(key('bookings.action.approve')));
    await shot('appointment-request', {
      1: [main.getByText(pending, { exact: true }).first(), 'start'],
      2: link(key('bookings.detail.viewPatient')),
      3: link(key('bookings.detail.call')),
      4: btn(key('bookings.action.approve')),
      5: [btn(key('bookings.action.reject')), 'start'],
      6: text(key('bookings.intake.title'), { exact: true }),
    });

    await btn(key('bookings.action.reject')).click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor();
    await dialog.getByLabel(key('bookings.action.reasonLabel')).fill(ar
      ? 'لن أكون في العيادة يوم الاثنين. يرجى الحجز في يوم آخر.'
      : 'I am away from the clinic on Monday. Please book another day.');
    await settle(300);
    await shot('appointment-reject', {
      1: dialog.getByRole('heading').first(),
      2: dialog.getByLabel(key('bookings.action.reasonLabel')),
      3: dialog.getByRole('button', { name: key('bookings.action.dismiss') }),
      4: dialog.getByRole('button', { name: key('bookings.action.reject') }),
    }, { clip: dialog });
    await page.keyboard.press('Escape');

    // The patient is in the room.
    await open('/bookings/1006', btn(key('bookings.action.complete')));
    await shot('appointment-consultation', {
      1: [main.getByText(L.reKey('doctor.bookings.psp.badge')).first(), 'start'],
      2: text(L.reKey('doctor.bookings.consultation.left')).first(),
      3: link(L.reKey('doctor.rx.cta.edit')),
      4: btn(key('bookings.action.complete')),
      5: link(key('bookings.enroll.cta')),
    });
  }

  // ---------------------------------------------------------------- walk-in clinic
  if (want('walkin')) {
    await open('/clinic-sessions', btn(key('clinicSessions.register')));
    await page.getByLabel(key('clinicSessions.phone')).fill('01098765432');
    await page.getByLabel(key('clinicSessions.fullName')).fill(ar ? 'سامي فؤاد' : 'Sami Fouad');
    await shot('walkin-session', {
      1: main.getByText(key('clinicSessionStatus.active'), { exact: true }).first(),
      2: [page.getByLabel(key('clinicSessions.phone')), 'top'],
      3: [page.getByLabel(key('clinicSessions.fullName')), 'top'],
      4: btn(key('clinicSessions.register')),
      5: btn(key('clinicSessions.startConsultation'), { exact: true }),
      6: btn(key('clinicSessions.completeVisit'), { exact: true }),
      7: btn(key('clinicSessions.closeSession')),
    });
  }

  // ---------------------------------------------------------------- patients
  if (want('patients')) {
    await open('/patients', page.getByRole('row').nth(1));
    await shot('patients-list', {
      1: page.getByLabel(key('patients.search.label')),
      2: page.getByRole('row').nth(1).getByRole('cell').first(),
      3: text(key('patients.access.granted')).first(),
      4: text(key('patients.access.notGranted')).first(),
    });
    await page.getByRole('row').nth(1).click();
    await text(key('patients.section.records'), { exact: true }).waitFor();
    await settle(600);
    await shot('patient-record', {
      1: main.getByRole('heading').first(),
      2: [text(key('patients.detail.allergies'), { exact: true }).first(), 'start'],
      3: link(key('patients.detail.call')).or(btn(key('patients.detail.call'))).first(),
      4: text(key('patients.section.records'), { exact: true }),
      5: main.getByText(key('patients.section.prescriptions')).first(),
    });
  }

  // ---------------------------------------------------------------- prescriptions
  if (want('rx')) {
    await open('/bookings/1004/prescription', btn(key('rx.save'), { exact: true }));
    const preview = page.locator('iframe').first();
    await shot('rx-page', {
      1: page.getByRole('heading', { level: 1 }),
      2: [main.getByText(key('patients.detail.allergies'), { exact: false }).first().locator('xpath=..'), 'center'],
      3: page.getByLabel(key('rx.field.diagnosis')),
      4: btn(key('rx.add.drug')),
      5: [btn(key('rx.templates.openWhole')), 'start'],
      6: [preview, 'top'],
    });

    await btn(key('rx.add.drug')).click();
    const search = page.getByRole('combobox', { name: key('rx.field.name.drug') });
    await search.fill('Aug');
    await page.getByRole('option', { name: /Augmentin 1 gm 14/ }).click();
    const freq = page.getByRole('radiogroup', { name: key('rx.field.frequency') });
    const dur = page.getByRole('radiogroup', { name: key('rx.field.duration') });
    await freq.getByRole('radio').nth(2).click();
    await dur.getByRole('radio').nth(3).click();
    await btn(key('rx.notesHint.afterMeals')).first().click();
    await settle(500);
    await focus(freq);
    await shot('rx-medication', {
      1: search,
      2: [main.getByText(key('rx.field.frequency'), { exact: true }).first(), 'start'],
      3: [main.getByText(key('rx.field.duration'), { exact: true }).first(), 'start'],
      4: btn(key('rx.notesHint.afterMeals')).first(),
      5: [preview, 'top'],
    });

    await btn(key('rx.save'), { exact: true }).click();
    await btn(key('rx.pdf.download')).waitFor({ timeout: 20_000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(600);
    await shot('rx-saved', {
      1: [page.getByRole('heading', { level: 1 }), 'start'],
      2: btn(key('rx.pdf.download')),
      3: link(key('rx.page.back')),
    });
  }

  // ---------------------------------------------------------------- clinics
  if (want('clinics')) {
    await open('/clinics', link(key('myClinics.manage')).first());
    await shot('clinics-list', {
      1: [link(key('myClinics.add')).or(btn(key('myClinics.add'))).first(), 'start'],
      2: main.getByRole('heading').nth(1),
      3: main.getByText(ckey('status.clinic.approved'), { exact: true }).first(),
      4: main.getByText(ckey('status.clinic.pendingReview'), { exact: true }).first(),
      5: link(key('myClinics.manage')).first(),
    });

    await link(key('myClinics.manage')).first().click();
    await btn(key('schedule.add')).waitFor();
    await settle(600);
    await shot('clinic-manage', {
      1: [btn(ckey('common.edit'), { exact: true }).first(), 'start'],
      2: [btn(key('schedule.add')), 'start'],
      3: [btn(L.reKey('doctor.schedule.editShift')).first(), 'start'],
      4: [text(key('schedule.closed'), { exact: true }).first(), 'end'],
    });

    await btn(key('schedule.add')).click();
    const opens = page.getByLabel(key('schedule.start'), { exact: true });
    await opens.waitFor();
    for (const d of ['wednesday', 'saturday']) await btn(ckey(`day.${d}`), { exact: true }).click();
    await opens.fill('17:00');
    await page.getByLabel(key('schedule.end'), { exact: true }).fill('21:00');
    await focus(opens);
    await page.evaluate(() => document.activeElement?.blur());
    await shot('clinic-hours', {
      1: main.getByText(key('schedule.days'), { exact: true }),
      2: btn(key('schedule.selectAll')),
      3: [opens, 'top'],
      4: [page.getByLabel(key('schedule.end'), { exact: true }), 'top'],
      5: btn(key('schedule.add')).last(),
    });
    await btn(key('schedule.add')).last().click();
    await settle(600);

    const closures = text(key('closures.title'), { exact: true });
    await focus(closures);
    await shot('clinic-closures', {
      1: [closures, 'end'],
      2: [btn(key('closures.add')), 'start'],
      3: [text(key('fees.title'), { exact: true }), 'end'],
      4: [btn(key('fees.add')), 'start'],
    });

    await open('/clinics/new', page.getByLabel(key('field.clinicName')));
    await shot('clinic-new', {
      1: [page.getByLabel(key('field.clinicName')), 'top'],
      2: [page.getByLabel(ckey('field.governorate'), { exact: true }), 'top'],
      3: [main.getByText(ckey('field.clinicLicense'), { exact: true }).first(), 'end'],
      4: [btn(key('schedule.add')), 'start'],
      5: [main.getByText(key('location.label')).first(), 'end'],
      6: btn(key('clinicNew.submit')),
    }, { full: true });
  }

  // ---------------------------------------------------------------- intake questions
  if (want('questionnaire')) {
    await open('/questionnaire', btn(key('questionnaire.add')));
    const questions = main.getByText(key('questionnaire.questionsCard'), { exact: true });
    await page.setViewportSize({ width: 1366, height: 1200 });
    await questions.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -90));
    await settle(300);
    await shot('questionnaire', {
      1: [questions, 'end'],
      2: main.getByText(key('questionnaire.systemBadge'), { exact: true }).first(),
      3: [btn(key('questionnaire.moveUp')).nth(3), 'start'],
      4: btn(key('questionnaire.addOption')).first(),
    });
    await page.setViewportSize({ width: 1366, height: 860 });

    const add = btn(key('questionnaire.add'));
    await add.click();
    const qText = page.getByLabel(key('questionnaire.text'), { exact: true });
    await qText.waitFor();
    await qText.fill('How long have you had these symptoms?');
    await page.getByLabel(key('questionnaire.textAr')).fill('منذ متى تعاني من هذه الأعراض؟');
    await page.getByText(key('questionnaire.mandatory'), { exact: true }).click();
    await focus(qText);
    await shot('question-add', {
      1: page.getByLabel(key('questionnaire.type')),
      2: qText,
      3: page.getByLabel(key('questionnaire.textAr')),
      4: page.getByText(key('questionnaire.mandatory'), { exact: true }),
      5: btn(ckey('common.save'), { exact: true }).last(),
    });
  }

  // ---------------------------------------------------------------- settings
  if (want('settings')) {
    await open('/settings', btn(key('settings.tab.booking')));
    await shot('settings-booking', {
      1: [btn(key('settings.tab.booking')), 'start'],
      2: page.getByRole('switch').first(),
      3: [page.getByLabel(key('settings.cancellation.window')), 'start'],
      4: [page.getByLabel(key('settings.slot.duration')), 'start'],
      5: [main.getByText(key('settings.timeZone'), { exact: true }), 'start'],
      6: btn(ckey('common.save'), { exact: true }).last(),
    });

    await btn(key('settings.tab.letterhead')).click();
    await btn(key('letterhead.save')).waitFor();
    const accent = page.getByRole('radio', { name: L.reKey('doctor.letterhead.field.accentOption') });
    await accent.nth(2).click();
    await settle(700);
    await shot('settings-letterhead', {
      1: main.getByText(key('letterhead.fromProfile.title'), { exact: true }),
      2: [link(key('letterhead.fromProfile.editProfile')), 'start'],
      3: main.getByText(key('letterhead.field.accent'), { exact: true }),
      4: main.getByText(key('letterhead.show.title'), { exact: true }),
      5: [page.locator('iframe').first(), 'top'],
    });
  }

  // ---------------------------------------------------------------- profile
  if (want('profile')) {
    await open('/profile', btn(key('profile.save')));
    await shot('profile-public', {
      1: [main.getByRole('heading', { level: 1 }), 'start'],
      2: main.getByText(key('profile.photo'), { exact: true }),
      3: [main.getByRole('textbox').nth(1), 'top'],
      4: [page.getByLabel(key('profile.feesMin')), 'top'],
      5: btn(key('profile.save')),
    });

    const request = btn(key('legal.request'));
    await focus(request);
    await shot('profile-legal', {
      1: main.getByText(key('profile.legalCard'), { exact: true }),
      2: main.getByText(key('profile.lock.request'), { exact: true }).first(),
      3: main.getByText(key('profile.lock.medtech'), { exact: true }).first(),
      4: main.getByText(key('legal.requestsTitle'), { exact: true }),
      5: request,
    });
  }

  // ---------------------------------------------------------------- notifications
  if (want('inbox')) {
    await open('/notifications', btn(ckey('notifications.markAllRead')));
    await shot('notifications', {
      1: [btn(ckey('notifications.filter.all'), { exact: true }), 'start'],
      2: btn(ckey('notifications.filter.unread'), { exact: true }),
      3: [btn(ckey('notifications.markAllRead')), 'start'],
    });
  }

  // ================================================================ Patient Support Programme
  if (want('balance')) {
    await open('/', page.getByRole('heading', { name: key('psp.balance.title') }));
    await btn(key('psp.balance.how.title')).click();
    await settle(500);
    const card = main.getByRole('heading', { level: 2 }).first();
    await shot('balance', {
      1: card,
      2: main.getByRole('definition').nth(0),
      3: main.getByRole('definition').nth(1),
      4: main.getByRole('definition').nth(2),
      5: btn(key('psp.balance.request.cta')).first(),
      6: [main.getByText(key('psp.balance.how.enrol.event'), { exact: true }), 'start'],
      7: [link(key('psp.balance.enrollCta')), 'start'],
    });

    await btn(key('psp.balance.request.cta')).first().click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor();
    await dialog.getByLabel(key('psp.balance.request.count')).fill('5');
    await dialog.getByLabel(key('psp.balance.request.note')).fill(ar
      ? 'خمسة مرضى في انتظار التسجيل هذا الأسبوع.'
      : 'Five patients are waiting to be enrolled this week.');
    await settle(300);
    await shot('request-places', {
      1: dialog.getByRole('heading').first(),
      2: dialog.getByLabel(key('psp.balance.request.count')),
      3: dialog.getByLabel(key('psp.balance.request.note')),
      4: dialog.getByRole('button', { name: key('psp.balance.request.submit') }),
    }, { clip: dialog });
    await page.keyboard.press('Escape');
  }

  // The enrolment form's answers, in the portal's language (programme data, typed bilingually).
  const CHIPS = [['Stage II', 'المرحلة الثانية'], ['None', 'لا يوجد'], ['0-1', '٠-١'], ['50mg', '٥٠ مجم'], ['University hospital', 'مستشفى جامعي']];
  const TESTS = [['CT scan', 'أشعة مقطعية'], ['Full blood count', 'صورة دم كاملة']];
  const say = ([en, arabic]) => (ar ? arabic : en);
  const programmeTrigger = page.getByLabel(key('psp.enroll.program'), { exact: true });
  async function fillFacts() {
    await pick(page.locator('#enroll-diagnosis'), ar ? /سرطان الرئة/ : /Non-small-cell/);
    await pick(page.locator('#enroll-strength'), /50mg|٥٠/);
    for (const c of CHIPS) await btn(say(c), { exact: true }).click();
  }

  if (want('enrol')) {
    await open('/give-coupon', programmeTrigger);
    await page.getByRole('button', { name: key('psp.enroll.route.directDoctor') }).waitFor();
    await openSelect(programmeTrigger);
    const options = page.getByRole('option');
    await options.first().waitFor();
    await settle(400);
    await shot('enrol-start', {
      1: page.getByText(key('psp.enroll.route.directDoctor'), { exact: true }),
      2: page.getByText(key('psp.enroll.route.patientApp'), { exact: true }),
      3: [openProgramme, 'end'],
      4: [options.filter({ has: page.locator('[aria-disabled="true"]') }).or(page.locator('[role="option"][aria-disabled="true"]')).first(), 'end'],
    });
    await openProgramme.click();
    await settle(500);

    // A walk-in patient with no MedTech account yet.
    const phone = page.getByLabel(key('psp.enroll.patientPhone'));
    await phone.fill('01099887766');
    await btn(key('psp.enroll.sendOtp')).click();
    const otp = page.getByLabel(key('psp.enroll.otp'));
    await otp.waitFor();
    await otp.fill('100000');
    await page.getByLabel(key('psp.enroll.quick.name')).fill(ar ? 'كريم مصطفى علي' : 'Karim Mostafa Ali');
    await page.getByLabel(key('psp.enroll.quick.nationalId')).fill('29001011234567');
    await page.locator('[data-sonner-toast], [role="status"]').first().waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
    await focus(phone);
    await page.evaluate(() => document.activeElement?.blur());
    await shot('enrol-identity', {
      1: [page.getByLabel(key('psp.enroll.walkIn.label')), 'top'],
      2: [phone, 'start'],
      3: btn(L.reKey('doctor.psp.enroll.resendIn')).or(btn(key('psp.enroll.resendOtp'))).first(),
      4: otp,
      5: page.getByLabel(key('psp.enroll.quick.name')),
      6: page.getByLabel(key('psp.enroll.quick.nationalId')),
    });

    await fillFacts();
    const tests = main.getByText(key('psp.enroll.tests.title'), { exact: true });
    // Tall enough for the whole form, scrolled to the end of the page so the submit button shows.
    await page.setViewportSize({ width: 1366, height: 1150 });
    await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
    await settle(300);
    await shot('enrol-form', {
      1: page.locator('label[for="enroll-diagnosis"]'),
      2: page.locator('label[for="enroll-strength"]'),
      3: btn(say(CHIPS[4]), { exact: true }),
      4: tests,
      5: main.getByText(plural('doctor.psp.enroll.missingCount')),
      6: btn(key('psp.enroll.submit')),
    });
    await page.setViewportSize({ width: 1366, height: 860 });
    for (const t of TESTS) await page.getByLabel(say(t), { exact: true }).check();
    await btn(key('psp.enroll.submit')).click();
    const heading = main.getByRole('heading', { name: ar ? 'كريم مصطفى علي' : 'Karim Mostafa Ali' });
    await heading.waitFor();
    await settle(800);
    await shot('enrol-done', {
      1: heading,
      2: main.getByText(/NEW-2026-/).first(),
      3: main.getByText(L('Awaiting documents'), { exact: true }).first(),
      4: main.getByText(L.reKey('doctor.psp.caseDetail.awaitingDocs')).first(),
      5: [page.getByText(key('psp.enroll.done')).first(), 'start'],
    });

    // A patient who already uses the patient app.
    await open('/give-coupon', programmeTrigger);
    await btn(key('psp.enroll.route.patientApp')).click();
    await openSelect(programmeTrigger);
    await openProgramme.click();
    await settle(300);
    const eligible = page.getByLabel(key('psp.enroll.eligible.label'), { exact: true });
    await pick(eligible, /Fatma Sayed Kamal Rashad/);
    await settle(400);
    await shot('enrol-app', {
      1: btn(key('psp.enroll.route.patientApp')),
      2: page.locator('label[for="enroll-program"]'),
      3: page.locator('label[for="enroll-eligible"]'),
      4: main.getByText(key('psp.enroll.matchHint'), { exact: false }).first(),
    });

    // From a walk-in appointment that is in progress.
    await open('/bookings/1006', link(key('bookings.enroll.cta')));
    await link(key('bookings.enroll.cta')).click();
    const nid = page.getByLabel(key('psp.enroll.quick.nationalId'));
    await nid.waitFor();
    await settle(800);
    await focus(page.getByLabel(key('psp.enroll.walkIn.label')));
    await shot('enrol-from-appointment', {
      1: [programmeTrigger, 'top'],
      2: [page.getByLabel(key('psp.enroll.walkIn.label')), 'top'],
      3: [page.getByLabel(key('psp.enroll.patientPhone')), 'top'],
      4: btn(key('psp.enroll.sendOtp')),
      5: page.getByLabel(key('psp.enroll.quick.name')),
      6: nid,
    });
  }

  if (want('cases')) {
    await open('/cases', page.getByRole('row').nth(1));
    const strip = page.getByRole('region', { name: key('followUps.doctor.strip.title') });
    await shot('cases-list', {
      1: strip.getByText(key('followUps.doctor.strip.title'), { exact: true }).or(main.getByText(key('followUps.doctor.strip.title'), { exact: true })).first(),
      2: strip.getByText(key('followUps.doctor.state.due'), { exact: true }),
      3: [page.getByLabel(key('psp.cases.search.label'), { exact: true }), 'top'],
      4: [page.getByLabel(key('psp.cases.filter.status'), { exact: true }), 'top'],
      5: page.getByRole('row').nth(1).getByRole('cell').last(),
    });

    await page.getByRole('row').filter({ hasText: 'ONC-2026-000106' }).click();
    await main.getByText(key('psp.caseDetail.doses.title'), { exact: true }).waitFor();
    await settle(600);
    await shot('case-detail', {
      1: main.getByRole('heading', { level: 1 }),
      2: main.getByText(key('psp.caseDetail.facts.title'), { exact: true }),
      3: main.getByText(L.reKey('doctor.psp.caseDetail.coupon.expires')),
      4: main.getByText(ckey('psp.doseStatus.readyForCollection'), { exact: true }).first(),
      5: main.getByText(L.reKey('doctor.followUps.doctor.card.title')).last(),
    });

    await open('/cases', strip);
    await strip.getByRole('link').filter({ hasText: key('followUps.doctor.state.due') }).click();
    await btn(key('followUps.doctor.card.submitCta')).click();
    for (const c of CHIPS) await btn(say(c), { exact: true }).first().click();
    for (const t of TESTS) await page.getByLabel(say(t), { exact: true }).first().check();
    const submit = btn(key('followUps.doctor.form.submit'), { exact: true });
    await page.setViewportSize({ width: 1366, height: 1280 });
    await submit.evaluate((el) => el.scrollIntoView({ block: 'end' }));
    await page.mouse.wheel(0, 120);
    await settle(400);
    await shot('follow-up', {
      1: main.getByText(L.reKey('doctor.followUps.doctor.card.title')).first(),
      2: btn(say(CHIPS[0]), { exact: true }).first(),
      3: [page.getByLabel(key('followUps.doctor.form.proposeStrength')).first(), 'top'],
      4: submit,
    });
    await page.setViewportSize({ width: 1366, height: 860 });
  }

  // ================================================================ assistants
  if (want('assistants')) {
    await open('/assistants', btn(key('assistants.add')));
    await btn(key('assistants.add')).click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor();
    await dialog.getByLabel(key('assistants.field.name')).fill(ar ? 'سارة يوسف' : 'Sara Youssef');
    await dialog.getByLabel(key('assistants.field.phone')).fill('01011112222');
    await dialog.getByLabel(key('assistants.field.password'), { exact: true }).fill('clinic2026a');
    await pick(dialog.getByLabel(key('assistants.field.clinic')), /Clinic A|العيادة/);
    await settle(300);
    await shot('assistant-add', {
      1: dialog.getByLabel(key('assistants.field.name')),
      2: dialog.getByLabel(key('assistants.field.phone')),
      3: dialog.getByLabel(key('assistants.field.password'), { exact: true }),
      4: [dialog.getByLabel(key('assistants.field.clinic')), 'top'],
      5: dialog.getByText(key('assistants.permissions.title'), { exact: true }),
    }, { clip: dialog });
    await dialog.getByRole('button', { name: key('assistants.create.confirm') }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.locator('[data-sonner-toast]').first().waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});

    // The new assistant's row, with its permission switches open and enrolment being granted.
    const name = ar ? 'سارة يوسف' : 'Sara Youssef';
    const permissionsToggle = btn(new RegExp(key('assistants.permissions.title')));
    const row = main.locator('div, li, article, section')
      .filter({ hasText: name })
      .filter({ has: permissionsToggle })
      .last();
    await row.waitFor();
    await row.getByRole('button', { name: new RegExp(key('assistants.permissions.title')) }).click();
    const enrolSwitch = row.getByRole('switch', { name: key('assistants.permission.canEnrollToPSP') });
    await enrolSwitch.click();
    await page.setViewportSize({ width: 1366, height: 1800 });
    await settle(500);
    await shot('assistant-permissions', {
      1: row.getByText(name, { exact: true }),
      2: row.getByText(L.reKey('doctor.assistants.atClinic')),
      3: row.getByRole('button', { name: new RegExp(key('assistants.permissions.title')) }),
      4: row.getByText(key('assistants.group.frontDesk'), { exact: true }),
      5: [enrolSwitch, 'start'],
      6: row.getByRole('button', { name: ckey('common.save'), exact: true }),
      7: [row.getByRole('button', { name: key('assistants.remove.title') }), 'bottom'],
    }, { clip: row });
    await page.setViewportSize({ width: 1366, height: 860 });
  }
});

// ---------------------------------------------------------------- what an assistant sees (a second sign-in)
if (want('assistant-view')) {
  for (const lang of (process.argv[2] ?? 'all') === 'all' ? ['en', 'ar'] : [process.argv[2]]) {
    console.log(`doctor · ${lang} · assistant`);
    const s = await session({ manual: 'doctor', port: 5382, lang, device: 'desktop', source: SOURCE });
    try {
      const { page, L, shot } = s;
      const { key, ckey, btn, main, open, signIn, submitSignIn } = helpers(s);
      await signIn('01000000006');
      await submitSignIn();
      await open('/bookings/1002', btn(key('bookings.action.checkIn')));
      await shot('assistant-booking', {
        1: [page.locator('header p[title]').last().locator('xpath=../..'), 'start'],
        2: btn(key('bookings.action.checkIn')),
        3: main.getByText(key('bookings.intake.restricted.title'), { exact: true }),
      });
      await open('/', main.getByRole('definition').first());
      await shot('assistant-balance', {
        1: main.getByRole('heading', { level: 2 }).first(),
        2: main.getByRole('definition').nth(0),
        3: helpers(s).nav.getByRole('link', { name: helpers(s).navKey('giveCoupon') }),
      });
      void L; void ckey;
    } finally {
      await s.browser.close();
    }
  }
}

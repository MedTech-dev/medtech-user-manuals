// Pharmacy portal screenshots — phone size, mock data, English and Arabic.
//   MEDTECH_FRONTEND=<checkout> node tools/capture/pharmacy.mjs [en|ar|all]
// Needs the pharmacy portal running in mock mode on http://localhost:5383.
import { run } from './lib.mjs';

await run('pharmacy', { port: 5383, device: 'phone', source: 'medtech-frontend main (mock data)' }, async ({ page, L, shot, focus, base }) => {
  const key = (k) => L.key(`pharmacy.${k}`);
  const btn = (name, o = {}) => page.getByRole('button', { name, ...o });
  const text = (s, o = {}) => page.getByText(s, o);

  // ---------------------------------------------------------------- sign in
  await page.goto(`${base}/login`);
  await page.getByLabel(L('Phone number')).waitFor();
  // The mock-mode sign-in hint is a developer aid, not part of the real screen.
  await text(L.key('common.auth.devHint.pharmacy')).evaluate((el) => { el.style.display = 'none'; });
  await page.getByLabel(L('Phone number')).fill('01000000003');
  await page.getByLabel(L('Password'), { exact: true }).fill('demo-pass');
  await shot('sign-in', {
    1: [page.getByLabel(L('Phone number')), 'top'],
    2: [page.getByLabel(L('Password'), { exact: true }), 'top'],
    3: [btn(L('Show password')), 'top'],
    4: btn(L('Sign in')),
    5: [btn(/^(العربية|English)$/), 'start'],
  });
  await btn(L('Sign in')).click();
  await page.getByRole('heading', { name: key('counter.title') }).waitFor();

  // ---------------------------------------------------------------- the counter
  await page.waitForTimeout(600);
  await shot('counter-home', {
    1: btn(key('counter.scan.cta')),
    2: page.getByLabel(key('counter.codeLabel')),
    3: btn(key('counter.openCta'), { exact: true }),
    4: page.getByRole('heading', { name: key('counter.worklist.title') }),
    5: page.getByLabel(key('counter.worklist.searchLabel')),
    6: text(/Youssef/).first(),
    7: [btn(L('Open menu')), 'bottom'],
  });

  await btn(L.key('common.settings.title')).click();
  const settings = page.getByRole('menu');
  await settings.waitFor();
  await page.waitForTimeout(300);
  await shot('settings', {
    1: settings.getByText(L.key('common.settings.language'), { exact: true }),
    2: settings.getByText(L.key('common.settings.theme'), { exact: true }),
    3: settings.getByRole('menuitem', { name: L.key('common.auth.signOut') }),
  });
  await page.keyboard.press('Escape');
  await settings.waitFor({ state: 'hidden' });

  await btn(L('Open menu')).click();
  const nav = page.getByRole('dialog');
  await nav.waitFor();
  await page.waitForTimeout(400);
  await shot('menu', {
    1: nav.getByRole('link', { name: key('nav.redeem') }),
    2: nav.getByRole('link', { name: key('nav.pharmacyEnrol') }),
    3: nav.getByRole('link', { name: key('nav.pharmacyStock') }),
    4: nav.getByText(key('nav.pharmacyRequests'), { exact: true }),
    5: nav.getByRole('link', { name: key('nav.pharmacyAccount') }),
    6: nav.getByText(L('Notifications'), { exact: true }),
  });
  await page.keyboard.press('Escape');
  await nav.waitFor({ state: 'hidden' });

  // ---------------------------------------------------------------- one dose, start to finish
  await btn(/Youssef/).click();
  const idCheck = page.getByRole('checkbox', { name: key('counter.identity.confirm') });
  await idCheck.waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('dose-open', {
    1: page.getByRole('heading', { name: /Youssef/ }),
    2: text(key('counter.head.drug'), { exact: true }),
    3: text(key('counter.head.dose'), { exact: true }),
    4: text(key('counter.head.codeValidUntil'), { exact: true }),
    5: text(key('counter.head.price'), { exact: true }),
    6: [btn(L('Cancel')), 'bottom'],
  });

  const nid = text(/282/).first();
  await focus(nid);
  await shot('identity', {
    1: [nid, 'top'],
    2: btn(L.key('common.common.reveal')),
    3: [idCheck, 'start'],
  });
  await idCheck.check();

  const returned = btn(key('counter.packaging.returned'), { exact: true });
  await returned.click();
  await focus(returned);
  await shot('packaging', {
    1: text(key('counter.packaging.label'), { exact: true }),
  });

  const serial = page.getByLabel(key('counter.boxSerial.label'));
  await serial.fill('ZXB-7002');
  const batch = text('ZLV-2409B').first();
  await batch.waitFor();
  await focus(serial);
  await shot('box-serial', {
    1: serial,
    2: batch,
  });

  const submit = btn(key('counter.submit'));
  const payMsg = text(key('counter.msg.paidCounter.headline'));
  await focus(payMsg);
  await shot('payment-message', {
    1: payMsg,
    2: submit,
  });

  await submit.click();
  const waiting = text(key('counter.locked.title'));
  await waiting.waitFor();
  await focus(waiting);
  await shot('waiting', {
    1: waiting,
    2: text(L.reKey('pharmacy.counter.locked.amountDue')).first(),
    3: text(key('counter.patientPreview.title')),
  });

  const done = text(key('counter.done.title'));
  await done.waitFor({ timeout: 30_000 });
  const damaged = page.getByRole('checkbox', { name: key('counter.damage.confirm') });
  await damaged.check();
  await focus(done);
  await shot('hand-over', {
    1: [done, 'start'],
    2: text(key('counter.timeline.submitted')).first(),
    3: [damaged, 'start'],
    4: btn(key('counter.done.next')),
  });

  // ---------------------------------------------------------------- a code that is not here
  await btn(key('counter.done.next')).click();
  await page.goto(`${base}/`); // a fresh screen, without the confirmation toast
  await page.getByRole('heading', { name: key('counter.title') }).waitFor();
  await page.getByLabel(key('counter.codeLabel')).fill('NOT-A-REAL-CODE');
  await btn(key('counter.openCta'), { exact: true }).click();
  const notFound = page.getByRole('alert').first();
  await notFound.waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('unknown-code', {
    1: [notFound, 'bottom'],
    2: page.getByLabel(key('counter.codeLabel')),
  });

  // ---------------------------------------------------------------- a programme without box serials
  await page.goto(`${base}/`);
  await btn(/Hassan Omar|حسن عمر/).click();
  const untracked = text(key('counter.boxSerial.untracked'));
  await untracked.waitFor();
  await page.getByRole('checkbox', { name: key('counter.identity.confirm') }).check();
  const expiry = page.getByLabel(key('counter.batch.actualExpiry'));
  await expiry.fill('2027-06-30');
  await focus(untracked);
  await shot('untracked-dose', {
    1: untracked,
    2: expiry,
    3: page.getByLabel(key('counter.batch.lotNumber')),
    4: text(key('counter.batch.unknownDistributor')),
  });

  // ---------------------------------------------------------------- availability requests
  await page.goto(`${base}/requests`);
  const waitingReqs = page.getByRole('region', { name: key('requests.waiting.title') });
  const answeredReqs = page.getByRole('region', { name: key('requests.answered.title') });
  await btn(key('requests.action.have'), { exact: true }).waitFor();
  await page.waitForTimeout(500);
  await shot('requests', {
    1: text(key('requests.subtitle')),
    2: waitingReqs.getByRole('listitem').first().getByText(/Zolvexa|زولفيكسا/).first(),
    3: btn(key('requests.action.have'), { exact: true }),
    4: btn(key('requests.action.haveNot')),
    5: answeredReqs.getByText(key('requests.state.confirmed'), { exact: true }).first(),
  });
  await btn(key('requests.action.haveNot')).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: key('requests.reason.notStocked') }).check();
  await sheet.getByLabel(key('requests.refuse.noteLabel')).fill(L.key('pharmacy.requests.reason.notStocked'));
  await page.waitForTimeout(300);
  await shot('requests-refuse', {
    1: sheet.getByText(key('requests.refuse.reasonLabel'), { exact: true }),
    2: sheet.getByLabel(key('requests.refuse.noteLabel')),
    3: sheet.getByRole('button', { name: key('requests.refuse.submit') }),
  });
  await page.keyboard.press('Escape');

  // ---------------------------------------------------------------- the other pages
  await page.goto(`${base}/stock`);
  await page.getByRole('heading', { name: key('stock.title') }).waitFor();
  await page.waitForTimeout(500);
  await shot('stock', {
    1: page.getByRole('heading', { name: key('stock.title') }),
    2: page.getByLabel(key('stock.search.label')),
  });

  await page.goto(`${base}/account`);
  await text(key('account.q18.title')).waitFor();
  await page.waitForTimeout(500);
  await shot('account', {
    1: page.getByRole('heading', { name: key('account.title') }),
    2: text(key('account.q18.title')),
  });

  await page.goto(`${base}/notifications`);
  await btn(L('Mark all as read')).waitFor();
  await page.waitForTimeout(500);
  await shot('notifications', {
    1: [btn(L('Mark all as read')), 'bottom'],
  });

  // ---------------------------------------------------------------- enrolling a patient
  await page.goto(`${base}/enrol`);
  const programmes = page.getByRole('region', { name: key('pharmacyEnrol.program') });
  const programme = programmes.getByRole('button').first();
  await programme.waitFor();
  await page.waitForTimeout(400);
  await shot('enrol-programme', {
    1: programme,
  });
  await programme.click();

  const nidField = page.getByLabel(key('pharmacyEnrol.nationalId'));
  await nidField.fill('29001011234567');
  await focus(nidField);
  await shot('enrol-id', {
    1: nidField,
    2: btn(key('pharmacyEnrol.check')),
  });
  await btn(key('pharmacyEnrol.check')).click();
  const notFoundMsg = text(key('pharmacyEnrol.notFound'));
  await notFoundMsg.waitFor();
  await page.getByLabel(key('pharmacyEnrol.name')).fill('Mona Test Patient');
  await page.getByLabel(key('pharmacyEnrol.phone')).fill('01099887766');
  await focus(page.getByLabel(key('pharmacyEnrol.name')));
  await shot('enrol-new-patient', {
    1: [notFoundMsg, 'bottom'],
    2: page.getByLabel(key('pharmacyEnrol.name')),
    3: page.getByLabel(key('pharmacyEnrol.phone')),
    4: btn(key('pharmacyEnrol.sendCode'), { exact: true }),
  });
  await btn(key('pharmacyEnrol.sendCode'), { exact: true }).click();
  const code = page.getByLabel(key('pharmacyEnrol.code'));
  await code.waitFor();
  await code.fill('100000');
  await focus(code);
  await shot('enrol-code', {
    1: page.getByRole('heading', { name: key('pharmacyEnrol.confirmTitle') }),
    2: text(L.reKey('pharmacy.pharmacyEnrol.codeSentTo')).first(),
    3: code,
    4: btn(key('pharmacyEnrol.enrol')),
  });
  await btn(key('pharmacyEnrol.enrol')).click();
  const enrolled = page.getByRole('heading', { name: key('pharmacyEnrol.doneTitle') });
  await enrolled.waitFor();
  await page.waitForTimeout(400);
  await focus(enrolled);
  await shot('enrol-done', {
    1: enrolled,
    2: [text(key('pharmacyEnrol.doneBody')), 'bottom'],
  });

  // A patient the platform already knows.
  await page.goto(`${base}/enrol`);
  await programmes.getByRole('button').first().click();
  await page.getByLabel(key('pharmacyEnrol.nationalId')).fill('29107151206693');
  await btn(key('pharmacyEnrol.check')).click();
  const isThis = text(key('pharmacyEnrol.isThisPatient'));
  await isThis.waitFor();
  await focus(isThis);
  await shot('enrol-known-patient', {
    1: text(key('pharmacyEnrol.found')).first(),
    2: isThis,
    3: btn(key('pharmacyEnrol.yesSendCode')),
  });
});

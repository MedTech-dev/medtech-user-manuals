// Program Coordinator screenshots (the Program Operator portal's case work) — desktop, mock data, English and Arabic.
//   MEDTECH_FRONTEND=<checkout> node tools/capture/coordinator.mjs [en|ar|all]
// Needs the operator portal running in mock mode on http://localhost:5381.
//
// Every page load restarts the portal's demo data, so each section below starts with page.goto and
// works on its own demo case: a decision taken in one section never leaks into the next.
// ONLY=case,approved,... captures just those sections (sign-in always runs).
import { run } from './lib.mjs';

const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, (m) => `\\${m}`);
// The site shows a desktop screenshot across the full text column (about 930px). A region narrower
// than that would be drawn smaller than the column while its markers are placed across the column,
// so small regions (dialogs) are framed at least this wide.
const MIN_FRAME = 960;

await run('coordinator', { port: 5381, device: 'desktop', source: 'medtech-frontend main (mock data)' }, async ({ page, L, shot, focus, base, lang }) => {
  const k = (key) => L.key(`operator.${key}`);
  const c = (key) => L.key(`common.${key}`);
  const btn = (name, o = {}) => page.getByRole('button', { name, ...o });
  const text = (s, o = {}) => page.getByText(s, o);
  const dialog = page.getByRole('dialog');
  const want = (name) => !ONLY || ONLY.has(name);

  /** Success toasts fade after a few seconds; close them so they never sit on a screenshot. */
  async function clearToasts() {
    const dismiss = page.locator('div.fixed[role="region"] button');
    for (let i = 0; i < 6 && (await dismiss.count()) > 0; i++) {
      await dismiss.first().click().catch(() => {});
      await page.waitForTimeout(150);
    }
  }
  async function openCasePage(id) {
    await page.goto(`${base}/cases/${id}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.waitForTimeout(500);
  }
  /** Take the case lock and wait for the countdown panel. */
  async function takeLock() {
    await btn(k('caseDetail.lock.openCta')).click();
    await text(L.reKey('operator.caseDetail.lock.mineBody')).waitFor();
    await page.waitForTimeout(600);
    await clearToasts();
  }
  /** Radix select: open it (retrying a click the menu swallowed), then pick an option.
   *  An open menu hides the rest of the page from role queries, so check for the list, not the trigger. */
  async function openList(trigger) {
    for (let i = 0; i < 4; i++) {
      await trigger.click();
      if (await page.getByRole('listbox').waitFor({ timeout: 1500 }).then(() => true, () => false)) return;
    }
  }
  async function pick(trigger, option) {
    await openList(trigger);
    await option().click();
    await page.getByRole('listbox').waitFor({ state: 'hidden' }).catch(() => {});
    await page.waitForTimeout(250);
  }
  /** The worklist grid is a little wider than the screen; widen the window so every column shows. */
  async function fitTable() {
    await page.locator('table').first().waitFor();
    const over = await page.evaluate(() => {
      const t = document.querySelector('table');
      return t ? t.scrollWidth - t.parentElement.clientWidth : 0;
    });
    if (over > 0) await page.setViewportSize({ width: Math.min(1366 + over + 8, 1520), height: 860 });
    await page.waitForTimeout(300);
  }
  const resetViewport = () => page.setViewportSize({ width: 1366, height: 860 });
  const section = (title) => page.locator('section').filter({ has: page.getByRole('heading', { name: title }) }).first();
  /** A case-page card: a bordered block whose first line is its title. */
  const cardOf = (title) => page.locator('li.rounded-lg').filter({
    has: page.locator('xpath=./div[1]/div[1]').filter({ hasText: title instanceof RegExp ? title : new RegExp(`^${escRe(title)}$`) }),
  }).first();

  /** An invisible box over part of the screen, used as a screenshot region (see MIN_FRAME). */
  async function frameBox(box) {
    await page.evaluate(({ x, y, w, h }) => {
      let f = document.getElementById('__shot_frame');
      if (!f) { f = document.createElement('div'); f.id = '__shot_frame'; document.body.appendChild(f); }
      Object.assign(f.style, {
        position: 'absolute', left: `${x + scrollX}px`, top: `${y + scrollY}px`, width: `${w}px`, height: `${h}px`,
        pointerEvents: 'none', zIndex: '2147483647',
      });
    }, box);
    return page.locator('#__shot_frame');
  }
  async function frameAround(loc, pad = 14) {
    const b = await loc.first().boundingBox();
    const vw = page.viewportSize().width;
    const w = Math.min(vw, Math.max(b.width + 2 * pad, MIN_FRAME));
    const x = Math.max(0, Math.min(b.x + b.width / 2 - w / 2, vw - w));
    return frameBox({ x, y: Math.max(0, b.y - pad), w, h: b.height + 2 * pad });
  }
  /** A frame around several elements at once (all must be on screen). */
  async function frameUnion(locs, pad = 14) {
    const boxes = [];
    for (const l of locs) boxes.push(await l.first().boundingBox());
    const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
    const x1 = Math.max(...boxes.map((b) => b.x + b.width)), y1 = Math.max(...boxes.map((b) => b.y + b.height));
    const vw = page.viewportSize().width;
    const w = Math.min(vw, Math.max(x1 - x0 + 2 * pad, MIN_FRAME));
    const x = Math.max(0, Math.min((x0 + x1) / 2 - w / 2, vw - w));
    return frameBox({ x, y: Math.max(0, y0 - pad), w, h: y1 - y0 + 2 * pad });
  }
  const dropFrame = () => page.evaluate(() => {
    document.getElementById('__shot_frame')?.remove();
    document.querySelectorAll('.__pin').forEach((p) => p.remove());
  });

  /**
   * A marker just outside an element (below or above its box), for buttons and badges where a marker
   * beside the text has no room and lib's 'bottom'/'top' would sit on the element itself.
   */
  let pins = 0;
  async function pinAt(loc, where = 'below', gap = 22) {
    const b = await loc.first().boundingBox();
    const x = b.x + b.width / 2;
    const y = where === 'above' ? b.y - gap : b.y + b.height + gap;
    const id = `__pin${++pins}`;
    await page.evaluate(({ x, y, id }) => {
      const p = document.createElement('div');
      p.id = id;
      p.className = '__pin';
      Object.assign(p.style, { position: 'absolute', left: `${x + scrollX - 1}px`, top: `${y + scrollY - 1}px`, width: '2px', height: '2px', pointerEvents: 'none' });
      document.body.appendChild(p);
    }, { x, y, id });
    return [page.locator(`#${id}`), 'center'];
  }
  const below = (loc, gap) => pinAt(loc, 'below', gap);
  const above = (loc, gap) => pinAt(loc, 'above', gap);

  // ---------------------------------------------------------------- sign in
  await page.goto(`${base}/login`);
  await page.getByLabel(L('Phone number')).waitFor();
  // The mock-mode sign-in hint is a developer aid, not part of the real screen.
  await text(c('auth.devHint.operator')).evaluate((el) => { el.style.display = 'none'; });
  await page.getByLabel(L('Phone number')).fill('01000000005');
  await page.getByLabel(L('Password'), { exact: true }).fill('demo-pass');
  if (want('signin')) {
    await page.waitForTimeout(1200); // the sign-in card fades in
    await shot('sign-in', {
      1: [page.getByLabel(L('Phone number')), 'start'],
      2: [page.getByLabel(L('Password'), { exact: true }), 'start'],
      3: [btn(L('Show password')), 'end'],
      4: btn(L('Sign in')),
      5: [btn(/^(العربية|English)$/), 'start'],
      6: page.getByRole('link', { name: new RegExp(c('auth.userGuide')) }),
    });
  }
  await btn(L('Sign in')).click();
  await page.getByRole('heading', { name: k('worklist.title') }).waitFor();
  await page.locator('table').first().waitFor();
  await page.waitForTimeout(800);

  // ---------------------------------------------------------------- the portal and the worklist
  const nav = page.getByRole('navigation').first();
  if (want('portal')) {
    await shot('portal', {
      1: nav.getByRole('link', { name: c('nav.cases') }),
      2: nav.getByRole('link', { name: k('nav.enrol') }),
      3: nav.getByRole('link', { name: k('nav.nurseVisits') }),
      4: nav.getByRole('link', { name: k('nav.nearExpirations') }),
      5: nav.getByRole('link', { name: c('nav.notifications') }).getByText(c('nav.notifications'), { exact: true }),
      6: await below(btn(c('theme.switchToDark')), 34),
      7: await below(btn(c('settings.title')), 34),
    });
    await dropFrame();
  }

  if (want('worklist')) {
    await fitTable();
    const head = (key) => page.getByRole('columnheader', { name: k(`worklist.column.${key}`) }).first();
    await shot('worklist', {
      1: page.getByRole('tablist'),
      2: page.getByLabel(k('worklist.search.label')),
      3: btn(k('worklist.column.patient')),
      4: [btn(k('worklist.column.enrolled')), 'start'],
      5: head('status').getByText(k('worklist.column.status')),
      6: [head('lock').getByText(k('worklist.column.lock')), 'start'],
      7: text(k('worklist.keyboardHint')),
    });
    await resetViewport();
  }

  if (want('ownership')) {
    await page.getByRole('tab', { name: new RegExp(k('worklist.tab.under')) }).click();
    await text(L.reKey('operator.worklist.lock.other')).first().waitFor();
    await page.waitForTimeout(600);
    await fitTable();
    const table = page.locator('table').first();
    await shot('worklist-ownership', {
      1: [text(L.reKey('operator.worklist.lock.other')).first(), 'start'],
      2: [table.getByText(k('worklist.lock.unassigned')).first(), 'start'],
      3: table.getByText(c('worklist.status.informationRequestedAwaitingPatient')),
      4: table.getByText(c('worklist.status.resubmittedAwaitingRevalidation')),
      5: table.getByText(k('worklist.otherProgramme.short')).first(),
      6: table.getByLabel(lang === 'ar' ? /إساءة استخدام/ : /open abuse signal/).first(),
    }, { clip: table });
    await resetViewport();
  }

  // ---------------------------------------------------------------- one case, read before you open it
  if (want('case')) {
    await openCasePage('case-new-request');
    await btn(k('caseDetail.lock.openCta')).waitFor();
    await shot('case-unowned', {
      1: page.getByRole('heading', { level: 1 }),
      2: await below(text(c('worklist.status.documentsSubmittedAwaitingValidation')).first()),
      3: text(k('caseDetail.lock.unassignedBody')),
      4: [btn(k('caseDetail.lock.openCta')), 'start'],
      5: text(k('caseDetail.otherProgramme')),
      6: text(k('caseDetail.abuse.hint')),
      7: page.getByRole('link', { name: k('caseDetail.back') }),
    });
    await dropFrame();

    // Abuse signals, with the resolved ones folded open.
    const abuseHeading = page.getByRole('heading', { name: k('caseDetail.abuse.title') });
    const abuse = abuseHeading.locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
    const resolvedToggle = page.locator('details summary').first();
    await resolvedToggle.click();
    await page.waitForTimeout(300);
    await shot('abuse-signals', {
      1: abuseHeading.locator('xpath=following-sibling::*[1]'),
      2: abuse.getByText(k('caseDetail.abuse.hint')),
      3: abuse.locator('ul li').first(),
      4: resolvedToggle,
    }, { clip: abuse });
    await resolvedToggle.click();

    // The patient and the programme rules frozen at enrolment.
    const patientCard = cardOf(k('caseDetail.patient.title'));
    const rulesCard = cardOf(k('caseDetail.snapshot.title'));
    const grid = patientCard.locator('xpath=..');
    await focus(grid);
    await shot('case-records', {
      1: patientCard.getByText(k('caseDetail.patient.nationalId'), { exact: true }),
      2: btn(k('caseDetail.patient.idCardFront')),
      3: btn(k('caseDetail.consent.view')),
      4: rulesCard.getByText(k('caseDetail.snapshot.title'), { exact: true }),
      5: [rulesCard.getByText(k('caseDetail.snapshot.listPrice')), 'start'],
      6: rulesCard.getByText(k('caseDetail.snapshot.deadline'), { exact: true }),
    }, { clip: grid });

    await btn(k('caseDetail.patient.idCardFront')).click();
    await dialog.waitFor();
    await dialog.locator('img').first().waitFor();
    await page.waitForTimeout(800);
    await shot('id-card', {
      1: dialog.getByRole('heading').first(),
      2: [dialog.locator('img').first(), 'center'],
      3: dialog.getByRole('button', { name: c('common.close') }),
    }, { clip: await frameAround(dialog) });
    await dropFrame();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });

    await btn(k('caseDetail.consent.view')).click();
    await dialog.waitFor();
    await page.waitForTimeout(500);
    await shot('consent', {
      1: dialog.getByRole('heading').first(),
      2: dialog.getByText(k('caseDetail.consent.statementNote')),
      3: dialog.getByText(k('caseDetail.consent.arabic'), { exact: true }),
      4: dialog.getByText(k('caseDetail.consent.english'), { exact: true }),
      5: dialog.getByRole('button', { name: k('caseDetail.consent.print') }),
    }, { clip: await frameAround(dialog) });
    await dropFrame();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });

    // What the coordinator validates: the answers and the documents.
    const answers = cardOf(L.reKey('operator.caseDetail.answers.title'));
    const docs = cardOf(k('caseDetail.documents.title'));
    await answers.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -90));
    await page.waitForTimeout(250);
    await shot('case-documents', {
      1: answers.getByText(L.reKey('operator.caseDetail.answers.title')).first(),
      2: docs.getByText(k('caseDetail.documents.title'), { exact: true }),
      3: [docs.getByText(k('caseDetail.documents.kind.requiredTest'), { exact: true }).first(), 'start'],
      4: [docs.getByText(k('caseDetail.documents.kind.medical'), { exact: true }).first(), 'start'],
      5: await below(docs.getByText(/prescription/).first(), 20),
    }, { clip: await frameUnion([answers, docs], 24) });
    await dropFrame();

    // ---------------------------------------------------------------- open it: the lock
    await page.evaluate(() => window.scrollTo(0, 0));
    await takeLock();
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('case-locked', {
      1: text(L.reKey('operator.caseDetail.lock.mineBody')),
      2: [btn(k('caseDetail.lock.releaseCta')), 'start'],
      3: await below(text(c('worklist.status.underValidation')).first()),
      4: await below(btn(k('caseDecision.approve.cta'), { exact: true }), 16),
      5: await below(btn(k('caseDecision.correction.cta')), 16),
      6: btn(k('caseDecision.reject.cta'), { exact: true }),
    });
    await dropFrame();

    // The history and the note composer (it needs the lock).
    const history = cardOf(k('caseDetail.activity.title'));
    const note = page.getByLabel(k('caseNotes.label'));
    await note.fill(lang === 'ar' ? 'اتصلت بالمريضة وأكدت أنها سترفع صورة أوضح للأشعة.' : 'Called the patient; she will upload a clearer copy of the scan.');
    await focus(history);
    await shot('case-history', {
      1: history.getByRole('group').getByRole('button').last(),
      2: history.locator('ol li').first(),
      3: history.getByText(k('caseNotes.warning')),
      4: note,
      5: [btn(k('caseNotes.save')), 'start'],
    }, { clip: history });
    await note.fill('');

    // ---------------------------------------------------------------- approve
    await page.evaluate(() => window.scrollTo(0, 0));
    await btn(k('caseDecision.approve.cta'), { exact: true }).click();
    await dialog.waitFor();
    const pharmacy = dialog.getByLabel(k('caseDecision.approve.pharmacy'));
    await page.waitForTimeout(800);
    await pick(pharmacy, () => page.getByRole('option', { name: /El Ezaby/ }));
    await shot('approve', {
      1: dialog.getByRole('heading').first(),
      2: dialog.getByText(L.reKey('operator.cases.assignPharmacy.patientHome')),
      3: pharmacy,
      4: dialog.getByText(k('caseDecision.approve.pharmacyHint')),
      5: dialog.getByLabel(k('caseDecision.approve.note')),
      6: dialog.getByRole('button', { name: k('caseDecision.approve.confirm') }),
    }, { clip: await frameAround(dialog) });
    await dropFrame();
    await dialog.getByRole('button', { name: L('Cancel'), exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });

    // ---------------------------------------------------------------- request a correction
    await btn(k('caseDecision.correction.cta')).click();
    await dialog.waitFor();
    await pick(dialog.getByLabel(k('caseDecision.field.reason')), () => page.getByRole('option').first());
    await dialog.getByLabel(k('caseDecision.correction.note')).fill(lang === 'ar'
      ? 'صورة الأشعة المقطعية غير واضحة، يُرجى رفع نسخة أوضح.'
      : 'The CT scan is unclear — please upload a clearer copy.');
    await shot('correction', {
      1: dialog.getByText(k('caseDecision.correction.body')),
      2: dialog.getByLabel(k('caseDecision.field.reason')),
      3: dialog.getByLabel(k('caseDecision.correction.note')),
      4: dialog.getByText(k('caseDecision.correction.noteHint')),
      5: dialog.getByRole('button', { name: k('caseDecision.correction.confirm') }),
    }, { clip: await frameAround(dialog) });
    await dropFrame();
    await dialog.getByRole('button', { name: L('Cancel'), exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });

    // ---------------------------------------------------------------- reject
    await btn(k('caseDecision.reject.cta'), { exact: true }).click();
    await dialog.waitFor();
    await pick(dialog.getByLabel(k('caseDecision.field.reason')), () => page.getByRole('option').last());
    await dialog.getByLabel(k('caseDecision.field.otherNote')).fill(lang === 'ar'
      ? 'انتقلت المريضة للعلاج خارج مصر.'
      : 'The patient has moved abroad for treatment.');
    await shot('reject', {
      1: dialog.getByText(k('caseDecision.reject.body')),
      2: dialog.getByLabel(k('caseDecision.field.reason')),
      3: dialog.getByLabel(k('caseDecision.field.otherNote')),
      4: dialog.getByRole('button', { name: k('caseDecision.reject.confirm') }),
    }, { clip: await frameAround(dialog) });
    await dropFrame();
    await dialog.getByRole('button', { name: L('Cancel'), exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  }

  // ---------------------------------------------------------------- a case someone else holds
  if (want('other')) {
    await openCasePage('case-locked-by-other');
    const held = text(L.reKey('operator.caseDetail.lock.otherBody'));
    await held.waitFor();
    await shot('case-locked-other', {
      1: page.getByRole('heading', { level: 1 }),
      2: held,
    });
  }

  // ---------------------------------------------------------------- approve with a co-payment tier
  if (want('tier')) {
    await openCasePage('case-telephone');
    await takeLock();
    await btn(k('caseDecision.approve.cta'), { exact: true }).click();
    await dialog.waitFor();
    const tier = dialog.getByLabel(k('caseDecision.approve.tier'));
    await pick(tier, () => page.getByRole('option').nth(1));
    await shot('approve-tier', {
      1: tier,
      2: dialog.getByLabel(k('caseDecision.approve.note')),
      3: dialog.getByRole('button', { name: k('caseDecision.approve.confirm') }),
    }, { clip: await frameAround(dialog) });
    await dropFrame();
  }

  // ---------------------------------------------------------------- a resubmitted case with an extension request
  if (want('resubmitted')) {
    await openCasePage('case-resubmitted');
    await takeLock();
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('resubmitted', {
      1: await below(text(c('worklist.status.resubmittedAwaitingRevalidation')).first()),
      2: text(k('caseDetail.extension.title'), { exact: true }),
      3: text(k('caseDecision.extension.body')),
      4: [btn(k('caseDecision.extension.grant')), 'start'],
      // The last button of the decision row (in Arabic "Reject" and the extension's "Refuse" read the same).
      5: btn(k('caseDecision.approve.cta'), { exact: true }).locator('xpath=..').getByRole('button').last(),
      6: text(L.reKey('operator.caseDetail.correctionNote')),
    });
    await dropFrame();
  }

  // ---------------------------------------------------------------- advanced pharmacy search (programme switch on)
  const searchCard = () => page.getByRole('region', { name: k('caseSearch.title') });
  const codesCard = () => section(k('caseDetail.deliveryCodes.title'));
  const stateBadge = (state) => searchCard().getByText(k(`caseSearch.state.${state}`), { exact: true });
  const requestRow = (state) => searchCard().getByRole('row')
    .filter({ has: page.getByText(k(`caseSearch.state.${state}`), { exact: true }) }).first();

  if (want('search')) {
    // Approve without choosing a pharmacy.
    await openCasePage('case-search-new');
    await takeLock();
    await btn(k('caseDecision.approve.cta'), { exact: true }).click();
    await dialog.waitFor();
    const branch = dialog.getByLabel(k('caseDecision.approve.pharmacy'));
    await page.waitForTimeout(800);
    await pick(branch, () => page.getByRole('option', { name: k('caseDecision.approve.decideLater'), exact: true }));
    await dialog.getByText(k('caseDecision.approve.decideLaterHint')).waitFor();
    await shot('search-approve', {
      1: branch,
      2: dialog.getByText(k('caseDecision.approve.decideLaterHint')),
      3: dialog.getByRole('button', { name: k('caseDecision.approve.confirm') }),
    }, { clip: await frameAround(dialog) });
    await dropFrame();
    await dialog.getByRole('button', { name: k('caseDecision.approve.confirm') }).click();
    // Through the app from here on: a page load would restart the demo data.
    await page.getByRole('heading', { name: k('worklist.title') }).waitFor();
    await page.getByRole('tab', { name: new RegExp(k('worklist.tab.approved')) }).click();
    await page.locator('a[href="/cases/case-search-new"]:visible').first().click();
    await searchCard().waitFor();
    await takeLock();
    await clearToasts();
    await focus(searchCard());
    await shot('search-no-pharmacy', {
      1: searchCard().getByText(k('caseSearch.hint')),
      2: searchCard().getByText(k('caseSearch.empty')),
      3: await below(searchCard().getByRole('button', { name: k('caseSearch.ask.cta') })),
      4: await below(searchCard().getByRole('button', { name: k('caseSearch.offer.cta') })),
      5: searchCard().getByRole('button', { name: k('caseSearch.unfulfilled.cta') }),
      6: codesCard().getByText(k('caseDetail.deliveryCodes.awaitingPharmacy')),
      7: [codesCard().getByRole('button', { name: k('cases.assignPharmacy.first.cta') }), 'start'],
    }, { clip: await frameUnion([searchCard(), codesCard()], 16) });
    await dropFrame();

    // A case whose pharmacies have answered: ask one more, offer, assign.
    await openCasePage('case-search-open');
    await takeLock();
    await searchCard().getByRole('button', { name: k('caseSearch.ask.cta') }).click();
    await dialog.waitFor();
    const askable = dialog.locator('button[role="checkbox"]:not([disabled])').first();
    await askable.waitFor();
    await askable.click();
    await page.waitForTimeout(250);
    await shot('search-ask', {
      1: dialog.getByText(k('caseSearch.ask.body')),
      2: dialog.getByText(k('caseSearch.ask.alreadyOpen')).first(),
      3: [askable, 'start'],
      4: dialog.getByRole('button').last(),
    }, { clip: await frameAround(dialog) });
    await dropFrame();
    await dialog.getByRole('button').last().click();
    await dialog.waitFor({ state: 'hidden' });
    await stateBadge('waiting').first().waitFor();
    await clearToasts();
    await focus(searchCard());
    const confirmedRow = requestRow('confirmed');
    await shot('search-requests', {
      1: confirmedRow.getByText(k('caseSearch.state.confirmed'), { exact: true }),
      2: requestRow('waiting').getByText(k('caseSearch.state.waiting'), { exact: true }),
      3: requestRow('refused').getByText(k('caseSearch.reason.outOfStock')),
      4: [confirmedRow.getByRole('button', { name: k('caseSearch.assign'), exact: true }), 'start'],
      5: confirmedRow.getByRole('button', { name: L.reKey('operator.caseSearch.withdrawRequest') }),
      6: await below(searchCard().getByRole('button', { name: k('caseSearch.offer.cta') })),
    }, { clip: searchCard() });
    await dropFrame();

    // Offer the two confirmed pharmacies to the patient.
    await searchCard().getByRole('button', { name: k('caseSearch.offer.cta') }).click();
    await dialog.waitFor();
    await page.waitForTimeout(500);
    await dialog.getByRole('button', { name: k('caseSearch.offer.confirm') }).click();
    await dialog.waitFor({ state: 'hidden' });
    const offerLine = searchCard().getByText(L.reKey('operator.caseSearch.offerOpen'));
    await offerLine.waitFor();
    await clearToasts();
    await focus(searchCard());
    await shot('search-offered', {
      1: offerLine,
      2: [searchCard().getByRole('button', { name: k('caseSearch.withdrawOffer'), exact: true }), 'start'],
    }, { clip: searchCard() });

    // Withdraw the offer, then assign the first confirmed pharmacy from its row.
    await searchCard().getByRole('button', { name: k('caseSearch.withdrawOffer'), exact: true }).click();
    await offerLine.waitFor({ state: 'detached' });
    await clearToasts();
    await requestRow('confirmed').getByRole('button', { name: k('caseSearch.assign'), exact: true }).click();
    await dialog.waitFor();
    await dialog.getByRole('button', { name: k('caseSearch.assignConfirm.confirm') }).click();
    await dialog.waitFor({ state: 'hidden' });
    await searchCard().getByText(k('caseSearch.assignedHint')).waitFor();
    await page.waitForTimeout(500);
    await clearToasts();
    await focus(searchCard());
    await shot('search-assigned', {
      1: searchCard().getByText(k('caseSearch.assignedHint')),
      2: stateBadge('closed').first(),
      3: codesCard().getByText(L.key('common.psp.doseStatus.readyForCollection'), { exact: true }).first(),
      4: [codesCard().getByRole('button', { name: k('cases.assignPharmacy.cta') }), 'start'],
    }, { clip: await frameUnion([searchCard(), codesCard()], 16) });
    await dropFrame();

    // Nobody can supply it yet: mark the case unfulfilled.
    await openCasePage('case-search-waiting');
    await takeLock();
    await searchCard().getByRole('button', { name: k('caseSearch.unfulfilled.cta') }).click();
    await dialog.waitFor();
    await dialog.getByLabel(k('caseSearch.unfulfilled.note')).fill(lang === 'ar'
      ? 'لا يوجد مخزون في أي فرع، والشحنة القادمة متوقعة الأسبوع المقبل.'
      : 'No branch holds stock; the next delivery is expected next week.');
    await shot('search-unfulfilled-note', {
      1: dialog.getByText(k('caseSearch.unfulfilled.body')),
      2: dialog.getByLabel(k('caseSearch.unfulfilled.note')),
      3: dialog.getByRole('button', { name: k('caseSearch.unfulfilled.confirm') }),
    }, { clip: await frameAround(dialog) });
    await dropFrame();
    await dialog.getByRole('button', { name: k('caseSearch.unfulfilled.confirm') }).click();
    await dialog.waitFor({ state: 'hidden' });
    await searchCard().getByText(k('caseSearch.unfulfilled.badge'), { exact: true }).waitFor();
    await clearToasts();
    await focus(searchCard());
    await shot('search-unfulfilled', {
      1: searchCard().getByText(k('caseSearch.unfulfilled.badge'), { exact: true }),
      2: [searchCard().getByRole('button', { name: k('caseSearch.unfulfilled.clear'), exact: true }), 'start'],
      3: requestRow('waiting').getByText(k('caseSearch.state.waiting'), { exact: true }),
    }, { clip: searchCard() });

    // The worklist row carries the mark.
    await nav.getByRole('link', { name: c('nav.cases'), exact: true }).click();
    await page.getByRole('tab', { name: new RegExp(k('worklist.tab.approved')) }).click();
    const row = page.locator('tr', { has: page.locator('a[href="/cases/case-search-waiting"]') });
    await row.getByLabel(k('worklist.unfulfilled.label')).waitFor();
    await page.waitForTimeout(500);
    await fitTable();
    await focus(row);
    // The row and its neighbours (the whole Approved queue is taller than the screen).
    await shot('search-worklist', {
      1: row.getByLabel(k('worklist.unfulfilled.label')),
      2: [row.getByText(k('worklist.lock.mine'), { exact: true }), 'start'],
    }, { clip: await frameUnion([row.locator('xpath=preceding-sibling::tr[1]'), row, row.locator('xpath=following-sibling::tr[1]')], 0) });
    await dropFrame();
    await resetViewport();
  }

  // ---------------------------------------------------------------- an approved case
  if (want('approved')) {
    await openCasePage('case-approved');
    await takeLock();
    const followUps = section(k('caseDetail.followUps.title'));
    await followUps.getByRole('button', { name: k('caseDetail.followUps.validate') }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('approved-actions', {
      1: await below(text(c('worklist.status.approved'), { exact: true }).first()),
      2: await above(btn(k('caseDecision.collectionDate.cta')), 20),
      3: btn(k('caseDecision.cancel.cta')),
      4: page.getByRole('heading', { name: k('caseDetail.followUps.title') }),
    });
    await dropFrame();

    await shot('follow-ups', {
      1: followUps.getByText(k('caseDetail.followUps.state.reviewed'), { exact: true }).first(),
      2: followUps.getByText(k('caseDetail.followUps.state.awaitingReview'), { exact: true }).first(),
      3: followUps.getByText(L.reKey('operator.followUps.pendingStrength.line')).first(),
      4: [followUps.getByRole('button', { name: k('caseDetail.followUps.validate') }), 'start'],
      5: followUps.getByRole('button', { name: k('caseDetail.followUps.reject') }),
    }, { clip: followUps });

    const codes = section(k('caseDetail.deliveryCodes.title'));
    await focus(codes);
    await shot('delivery-codes', {
      1: [codes.getByRole('button', { name: k('cases.assignPharmacy.cta') }), 'start'],
      2: codes.getByText(L.key('common.psp.doseStatus.received'), { exact: true }),
      3: codes.getByText(L.key('common.psp.doseStatus.readyForCollection'), { exact: true }),
      4: codes.getByText(L.reKey('operator.caseDetail.deliveryCodes.window')),
    }, { clip: codes });

    await codes.getByRole('button', { name: k('cases.assignPharmacy.cta') }).click();
    await dialog.waitFor();
    const branch = dialog.getByLabel(k('cases.assignPharmacy.pharmacy'));
    await page.waitForTimeout(800);
    await pick(branch, () => page.getByRole('option', { name: /Seif/ }));
    await shot('reassign', {
      1: dialog.getByText(k('cases.assignPharmacy.body')),
      2: dialog.getByText(L.reKey('operator.cases.assignPharmacy.patientHome')),
      3: branch,
      4: dialog.getByRole('button', { name: k('cases.assignPharmacy.confirm') }),
    }, { clip: await frameAround(dialog) });
    await dropFrame();
    await dialog.getByRole('button', { name: L('Cancel'), exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });

    await page.evaluate(() => window.scrollTo(0, 0));
    await btn(k('caseDecision.collectionDate.cta')).click();
    await dialog.waitFor();
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await dialog.getByLabel(k('caseDecision.collectionDate.newDate')).fill(soon);
    await dialog.getByLabel(k('caseDecision.collectionDate.reason'), { exact: true }).fill(lang === 'ar'
      ? 'المريض في المستشفى هذا الأسبوع.'
      : 'The patient is in hospital this week.');
    await shot('collection-date', {
      1: dialog.getByText(k('caseDecision.collectionDate.body')),
      2: dialog.getByLabel(k('caseDecision.collectionDate.newDate')),
      3: dialog.getByLabel(k('caseDecision.collectionDate.reason'), { exact: true }),
      4: dialog.getByRole('button', { name: k('caseDecision.collectionDate.confirm') }),
    }, { clip: await frameAround(dialog) });
    await dropFrame();
    await dialog.getByRole('button', { name: L('Cancel'), exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });

    await btn(k('caseDecision.cancel.cta')).click();
    await dialog.waitFor();
    await pick(dialog.getByLabel(k('caseDecision.field.reason')), () => page.getByRole('option').first());
    await shot('cancel-coupon', {
      1: dialog.getByText(k('caseDecision.cancel.body')),
      2: dialog.getByLabel(k('caseDecision.field.reason')),
      3: dialog.getByLabel(k('caseDecision.cancel.note')),
      4: dialog.getByText(L.reKey('operator.cases.cancelInfo.placeReturns')),
      5: dialog.getByRole('button', { name: k('caseDecision.cancel.confirm') }),
    }, { clip: await frameAround(dialog) });
    await dropFrame();
  }

  // ---------------------------------------------------------------- a delivery code stuck waiting for the patient
  if (want('locked-code')) {
    await openCasePage('case-approved-expiring');
    const codes = section(k('caseDetail.deliveryCodes.title'));
    await codes.waitFor();
    await shot('locked-code', {
      1: codes.getByText(L.key('common.psp.doseStatus.locked'), { exact: true }),
      2: codes.getByText(k('caseDetail.deliveryCodes.lockedHint')),
      3: [codes.getByRole('button', { name: k('caseDetail.deliveryCodes.release') }), 'start'],
    }, { clip: codes });
  }


  // ---------------------------------------------------------------- completing the form of a pharmacy-enrolled case
  if (want('form')) {
    await openCasePage('case-form-pending');
    const card = page.getByTestId('complete-form-card');
    await card.waitFor();
    await shot('form-pending', {
      1: page.getByRole('heading', { level: 1 }),
      2: await below(text(k('caseDetail.formPending.badge'), { exact: true }).first()),
      3: page.locator('main header p').nth(1),
      4: [btn(k('caseDetail.lock.openCta')), 'start'],
      5: card.getByText(k('caseDetail.formPending.hint')),
      6: card.getByText(k('caseDetail.formPending.lockHint')),
    });
    await dropFrame();
    await takeLock();
    await card.locator('#enrol-diagnosis').waitFor();
    await pick(card.locator('#enrol-diagnosis'), () => page.getByRole('option').first());
    await pick(card.locator('#enrol-strength'), () => page.getByRole('option').first());
    const groups = card.getByRole('group');
    for (let i = 0; i < (await groups.count()); i++) await groups.nth(i).getByRole('button').first().click();
    const checks = card.getByRole('checkbox');
    for (let i = 0; i < (await checks.count()); i++) await checks.nth(i).click();
    const save = card.getByRole('button', { name: k('caseDetail.formPending.submit') });
    // The form is taller than the screen: make the window tall enough to show it whole, under the top bar.
    await page.setViewportSize({ width: 1366, height: 1500 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await shot('form-complete', {
      1: [card.locator('#enrol-diagnosis'), 'center'],
      2: [card.locator('#enrol-strength'), 'center'],
      3: groups.first(),
      4: card.locator('label[for^="enrol-test-"]').first(),
      5: save,
    }, { clip: card.locator('xpath=ancestor::li[1]') });
    await resetViewport();
  }

  // ---------------------------------------------------------------- enrolling a patient
  if (want('enrol')) {
    await page.goto(`${base}/enrol`);
    const heading = page.locator('main h1');
    const programme = page.getByLabel(k('enrol.program'), { exact: true });
    await programme.waitFor();
    await page.waitForTimeout(800);
    await openList(programme);
    const option = page.getByRole('option').first();
    await option.waitFor();
    await page.waitForTimeout(300);
    await shot('enrol-programme', {
      1: heading,
      2: page.getByText(k('enrol.program'), { exact: true }).first(),
      3: option,
    }, { clip: await frameUnion([heading, page.getByRole('listbox')], 24) });
    await dropFrame();
    await option.click();

    const nid = page.getByLabel(k('enrol.nationalId'));
    await nid.fill('29001011234567');
    await btn(k('enrol.lookup'), { exact: true }).click();
    const notFound = text(k('enrol.notFound'));
    await notFound.waitFor();
    await page.getByLabel(k('enrol.quick.name')).fill(lang === 'ar' ? 'نادية حسن عبد الله' : 'Nadia Hassan Abdallah');
    await page.getByLabel(k('enrol.quick.phone')).fill('01099887766');
    await page.waitForTimeout(300);
    await shot('enrol-new-patient', {
      1: [nid, 'start'],
      2: btn(k('enrol.lookup'), { exact: true }),
      3: notFound,
      4: [page.getByLabel(k('enrol.quick.name')), 'start'],
      5: [page.getByLabel(k('enrol.quick.phone')), 'start'],
      6: btn(k('enrol.sendOtp'), { exact: true }),
    }, { clip: await frameUnion([heading, text(k('enrol.submitHint'))], 24) });
    await dropFrame();

    await btn(k('enrol.sendOtp'), { exact: true }).click();
    const otp = page.getByLabel(k('enrol.otp'));
    await otp.waitFor();
    await otp.fill('100000');
    const submit = btn(k('enrol.submit'));
    await page.waitForTimeout(400);
    await clearToasts();
    await shot('enrol-code', {
      1: btn(L.reKey('operator.enrol.resendIn')),
      2: [otp, 'start'],
      3: submit,
      4: text(k('enrol.submitHint')),
    }, { clip: await frameUnion([heading, text(k('enrol.submitHint'))], 24) });
    await dropFrame();

    await submit.click();
    await page.waitForURL(/\/cases\/[^/]+$/);
    const done = text(L.reKey('operator.enrol.done'));
    await done.waitFor();
    await page.getByTestId('complete-form-card').waitFor();
    await page.waitForTimeout(500);
    await shot('enrol-done', {
      1: [done.locator('xpath=ancestor::*[@role="status"][1]'), 'start'],
      2: page.locator('main header p').nth(1),
      3: await below(text(k('caseDetail.formPending.badge'), { exact: true }).first()),
      4: page.getByTestId('complete-form-card').getByText(k('caseDetail.formPending.lockHint')),
    });
    await dropFrame();

    // A patient the platform already knows.
    await page.goto(`${base}/enrol`);
    await page.getByLabel(k('enrol.program'), { exact: true }).waitFor();
    await page.waitForTimeout(600);
    await pick(page.getByLabel(k('enrol.program'), { exact: true }), () => page.getByRole('option').first());
    await page.getByLabel(k('enrol.nationalId')).fill('29107151206693');
    await btn(k('enrol.lookup'), { exact: true }).click();
    const summary = page.getByTestId('enrol-patient-summary');
    await summary.waitFor();
    await page.waitForTimeout(300);
    await shot('enrol-known-patient', {
      1: text(k('enrol.found'), { exact: true }).first(),
      2: summary.getByText(/\*{2,}|•{2,}/).first(),
      3: btn(k('enrol.useThisPatient')),
    }, { clip: await frameUnion([heading, text(k('enrol.submitHint'))], 24) });
    await dropFrame();
  }

  // ---------------------------------------------------------------- near expirations
  if (want('near')) {
    await page.goto(`${base}/near-expirations`);
    const table = page.locator('table').first();
    await table.waitFor();
    await page.waitForTimeout(600);
    await shot('near-expirations', {
      1: page.getByText(k('allocations.program'), { exact: true }).first(),
      2: await below(btn(k('billing.followUp.export.anonymized'))),
      3: await below(btn(k('billing.followUp.export.identifiable'))),
      4: table.getByRole('row').nth(1).getByText(/^[A-Z]{3}-\d{4}-\d+$/).first(),
      5: await below(table.getByText(k('billing.followUp.facet.warning'), { exact: true }).first(), 24),
      6: await below(table.getByRole('button', { name: L.reKey('operator.billing.followUp.contactFor') }).nth(1), 24),
      7: [table.getByText(k('billing.followUp.contacted'), { exact: true }).last(), 'start'],
    }, { clip: await frameUnion([page.locator('main h1'), text(k('billing.followUp.permissionNote'))], 24) });
    await dropFrame();
  }

  // ---------------------------------------------------------------- nurse visits
  if (want('nurse')) {
    await page.setViewportSize({ width: 1366, height: 1000 });
    await page.goto(`${base}/nurse/visits`);
    const table = page.locator('table').first();
    await table.waitFor();
    await page.waitForTimeout(600);
    await shot('nurse-visits', {
      1: page.getByText(k('nurse.visits.column.status'), { exact: true }).first(),
      2: table.getByText(L.key('common.psp.doseStatus.visitScheduled'), { exact: true }).first(),
      3: [table.getByText(k('nurse.visits.addressNote')).first(), 'start'],
      4: text(k('nurse.visits.cannotReach.title')),
      5: text(k('nurse.visits.noAutoFail')),
    }, { clip: await frameUnion([page.locator('main h1'), text(k('nurse.visits.noAutoFail'))], 24) });
    await resetViewport();
  }

  // ---------------------------------------------------------------- notifications
  if (want('notifications')) {
    await page.goto(`${base}/notifications`);
    await btn(c('notifications.markAllRead')).waitFor();
    await page.locator('main ul li').first().waitFor();
    await page.waitForTimeout(800);
    await shot('notifications', {
      1: await below(btn(c('notifications.markAllRead'))),
      2: page.getByRole('button', { name: c('notifications.filter.unread'), exact: true }).first(),
      3: [page.locator('main ul li span[aria-hidden]').first(), 'start'],
    }, { clip: await frameUnion([page.locator('main h1'), page.locator('main ul li').last()], 24) });
    await dropFrame();
  }
});

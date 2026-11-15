// Program Operator portal screenshots (setup and administration) — desktop, mock data, English and Arabic.
//   MEDTECH_FRONTEND=<checkout> node tools/capture/operator.mjs [en|ar|all]
// Needs the operator portal running in mock mode on http://localhost:5381.
// ONLY=<part,part> limits a run to some parts while iterating (sign-in always runs).
//
// Framing: the site shows a desktop screenshot at the width of the text column (about 940 px) and places
// markers as a share of that column, so every shot here is at least ~1100 px wide — the visible content
// column, a dialog with the screen around it, or a whole tall page — never a narrow crop.
import { run } from './lib.mjs';

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const VIEWPORT = { width: 1366, height: 860 };

// Demo programme names: pickers show the Arabic name on Arabic screens, tables show the Latin one.
const PROG = {
  onco: /OncoCare Support|أونكوكير للدعم/,
  cardia: /Cardia Assist|كارديا أسيست/,
};

await run('operator', { port: 5381, device: 'desktop', source: 'medtech-frontend main (mock data)' }, async ({ page, L, shot, focus, base, rtl }) => {
  // The portal looks a key up in its own catalogue first, then in the shared one.
  const op = (k) => { try { return L.key(`operator.${k}`); } catch { return L.key(`common.${k}`); } };
  const cm = (k) => L.key(`common.${k}`);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** A RegExp matching any of these exact strings. */
  const any = (...xs) => new RegExp(xs.map(esc).join('|'));
  const btn = (name, o = {}) => page.getByRole('button', { name, ...o });
  const text = (s, o = {}) => page.getByText(s, o);
  const label = (s) => page.getByText(s, { exact: true }).first();
  const main = page.getByRole('main');
  const part = async (name, fn) => {
    if (ONLY && !ONLY.includes(name)) return;
    console.log(` · ${name}`);
    await fn();
  };
  const go = async (path) => {
    await page.goto(`${base}${path}`);
    await page.waitForLoadState('networkidle').catch(() => {});
  };
  const top = () => page.evaluate(() => window.scrollTo(0, 0));
  /** Radix selects can swallow a fast click; open until it says it is open, then choose. */
  const pick = async (trigger, option) => {
    // A handle, not a locator: an open list hides the rest of a dialog from role queries.
    const handle = await trigger.first().elementHandle();
    for (let i = 0; i < 6; i++) {
      if ((await handle.getAttribute('aria-expanded')) === 'true') break;
      await handle.click();
      await page.waitForTimeout(250);
    }
    await page.getByRole('option', { name: option }).first().click();
    await page.waitForTimeout(300);
  };
  const pickProgram = (option) => pick(page.getByLabel(op('allocations.program'), { exact: true }), option);

  // ---------------------------------------------------------------- framing helpers
  const FRAME = 'manual-shot-frame';
  /** A transparent fixed box over part of the screen, used as the clip of a shot. */
  async function frameBox({ x, y, w, h }) {
    await page.evaluate(({ id, x, y, w, h }) => {
      let d = document.getElementById(id);
      if (!d) { d = document.createElement('div'); d.id = id; document.body.appendChild(d); }
      Object.assign(d.style, { position: 'fixed', left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, pointerEvents: 'none', zIndex: '2147483647' });
    }, { id: FRAME, x, y, w, h });
    return page.locator(`#${FRAME}`);
  }
  const unframe = () => page.evaluate((id) => document.getElementById(id)?.remove(), FRAME);
  const headerBottom = async () => {
    const b = await page.locator('header').first().boundingBox();
    return b ? Math.max(0, b.y + b.height) : 0;
  };
  /** Where the page's content ends, so a short page is not padded with empty screen. */
  const contentBottom = () => main.evaluate((el) => {
    const pad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
    return Math.max(...[...el.children].map((c) => c.getBoundingClientRect().bottom)) + pad;
  });
  /** The content column as it is on screen now (no sidebar, no top bar). */
  async function snap(name, markers) {
    const m = await main.boundingBox();
    const y = await headerBottom();
    const bottom = Math.min(VIEWPORT.height, await contentBottom());
    const f = await frameBox({ x: m.x, y, w: m.width, h: Math.max(320, bottom - y) });
    await shot(name, markers, { clip: f });
    await unframe();
  }
  /** The whole content column of a long page, top to bottom. */
  async function tall(name, markers) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: VIEWPORT.width, height: Math.max(VIEWPORT.height, h) });
    await page.waitForTimeout(500);
    await top();
    const m = await main.boundingBox();
    const y = await headerBottom();
    const f = await frameBox({ x: m.x, y, w: m.width, h: Math.min(m.y + m.height, await contentBottom()) - y });
    await shot(name, markers, { clip: f });
    await unframe();
    await page.setViewportSize(VIEWPORT);
    await page.waitForTimeout(300);
  }
  /** An open dialog with the dimmed screen around it, as wide as the content column. */
  async function dialogShot(name, markers, dlg) {
    await page.waitForTimeout(350);
    const b = await dlg.boundingBox();
    const vp = page.viewportSize();
    const w = 1100;
    const x = Math.max(0, Math.min(b.x + b.width / 2 - w / 2, vp.width - w));
    const y = Math.max(0, b.y - 28);
    const f = await frameBox({ x, y, w, h: Math.min(vp.height - y, b.height + 56) });
    await shot(name, markers, { clip: f });
    await unframe();
  }

  async function signIn(phone) {
    await go('/login');
    await page.getByLabel(L('Phone number')).waitFor();
    // The mock-mode sign-in hint is a developer aid, not part of the real screen.
    await text(cm('auth.devHint.operator')).evaluate((el) => { el.style.display = 'none'; });
    await page.getByLabel(L('Phone number')).fill(phone);
    await page.getByLabel(L('Password'), { exact: true }).fill('demo-pass');
  }

  // ---------------------------------------------------------------- sign in
  await signIn('01000000001');
  const side = await frameBox({ x: rtl ? 0 : VIEWPORT.width - 1000, y: 0, w: 1000, h: VIEWPORT.height });
  await shot('sign-in', {
    1: [page.getByLabel(L('Phone number')), 'top'],
    2: [page.getByLabel(L('Password'), { exact: true }), 'top'],
    3: [btn(L('Show password')), 'top'],
    4: btn(L('Sign in')),
    5: [btn(/^(العربية|English)$/), 'start'],
    6: page.getByRole('link', { name: new RegExp(esc(cm('auth.userGuide'))) }),
  }, { clip: side });
  await unframe();
  await btn(L('Sign in')).click();
  await page.getByRole('heading', { name: op('programs.title') }).waitFor();

  // ---------------------------------------------------------------- the layout
  await part('layout', async () => {
    await page.waitForTimeout(600);
    const nav = page.getByRole('navigation').first();
    const menuSide = await frameBox({ x: rtl ? VIEWPORT.width - 1000 : 0, y: 0, w: 1000, h: VIEWPORT.height });
    await shot('home', {
      1: nav.getByRole('link', { name: op('nav.overview') }),
      2: nav.getByRole('link', { name: op('nav.programs') }),
      3: nav.getByRole('link', { name: cm('nav.notifications') }),
      4: nav.getByRole('link', { name: op('nav.users') }),
      5: nav.getByRole('link', { name: op('nav.audit') }),
    }, { clip: menuSide });
    await unframe();

    await btn(cm('settings.title')).click();
    const menu = page.getByRole('menu');
    await menu.waitFor();
    await page.waitForTimeout(300);
    const mb = await menu.boundingBox();
    const headerSide = await frameBox({ x: rtl ? 0 : VIEWPORT.width - 1000, y: 0, w: 1000, h: Math.min(VIEWPORT.height, mb.y + mb.height + 40) });
    await shot('settings', {
      1: [page.getByText(/Operator admin|مسؤول المشغّل/).first(), 'start'],
      // An open menu hides the rest of the page from role queries, so the theme button is found by its label.
      2: [page.locator(`header button[aria-label="${cm('theme.switchToLight')}"], header button[aria-label="${cm('theme.switchToDark')}"]`), 'bottom'],
      3: [menu.getByText(cm('settings.language'), { exact: true }), 'start'],
      4: [menu.getByRole('menuitem', { name: new RegExp(esc(cm('nav.userGuide'))) }), 'start'],
      5: [menu.getByRole('menuitem', { name: cm('auth.signOut') }), 'start'],
    }, { clip: headerSide });
    await unframe();
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'hidden' });
  });

  await part('overview', async () => {
    await go('/dashboard');
    await text(op('opDashboard.card.activeCases')).waitFor();
    await page.waitForTimeout(500);
    await snap('overview', {
      1: page.getByRole('heading', { name: op('nav.overview') }),
      2: text(/waiting for validation|بانتظار المراجعة/),
      3: text(op('opDashboard.card.activeCases')),
      4: text(op('opDashboard.card.operatorBalance')),
      5: text(op('opDashboard.card.livePrograms')),
    });
  });

  // ---------------------------------------------------------------- Product Hub
  await part('products', async () => {
    await go('/products');
    const row = page.getByRole('row', { name: /Zolvexa/ });
    await row.waitFor();
    await page.waitForTimeout(400);
    await snap('products', {
      1: [btn(op('products.import.cta')), 'start'],
      2: [btn(op('products.add.cta')).first(), 'start'],
      3: [page.getByLabel(op('products.search.ariaLabel')), 'end'],
      4: page.getByRole('columnheader', { name: op('products.column.usage') }),
      5: [row.getByRole('link', { name: L.reKey('operator.billing.pricing.openFor') }), 'top'],
      6: [row.getByRole('button', { name: cm('common.edit'), exact: true }), 'top'],
      7: [row.getByRole('button', { name: op('products.delete.confirm') }), 'top'],
    });

    await btn(op('products.add.cta')).first().click();
    const form = page.getByRole('dialog');
    await form.getByLabel(op('products.field.commercialName')).fill('Artrocare');
    await form.getByLabel(op('products.field.activeMaterial')).fill('Artrocinib');
    await form.getByLabel(op('products.field.concentrations')).fill('100mg, 200mg');
    await form.getByLabel(op('products.field.packSizes')).fill('30 tablets');
    await dialogShot('product-form', {
      1: [form.getByText(op('products.field.commercialName'), { exact: true }), 'end'],
      2: [form.getByText(op('products.field.activeMaterial'), { exact: true }), 'end'],
      3: [form.getByText(op('products.field.concentrations'), { exact: true }), 'end'],
      4: [form.getByText(op('products.field.dosageForm'), { exact: true }), 'end'],
      5: [form.getByText(op('products.field.packSizes'), { exact: true }), 'end'],
      6: [form.getByText(op('products.field.distributors'), { exact: true }), 'end'],
    }, form);
    await page.keyboard.press('Escape');
    await form.waitFor({ state: 'hidden' });

    await btn(op('products.import.cta')).click();
    const imp = page.getByRole('dialog');
    await imp.getByText(op('products.import.template')).waitFor();
    // Any .xlsx will do: the demo answers with its fixed three-row sample sheet.
    await imp.locator('input[type=file]').setInputFiles({
      name: 'products.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('demo sheet'),
    });
    const commit = imp.getByRole('button', { name: L.reKey('operator.products.import.commit') });
    await commit.waitFor();
    await dialogShot('product-import', {
      1: [imp.getByText(op('products.import.template')), 'end'],
      2: [imp.getByText(op('products.import.fileLabel')), 'end'],
      3: imp.getByText(L.reKey('operator.products.import.count.invalid')),
      4: [imp.getByRole('heading', { name: op('products.import.errors.title') }), 'end'],
      5: [commit, 'start'],
      6: [imp.getByText(op('products.import.history.toggle')), 'end'],
    }, imp);
    await page.keyboard.press('Escape');
  });

  await part('pricing', async () => {
    await go('/products/prod-zolvexa/pricing');
    const choices = page.getByRole('navigation', { name: op('billing.pricing.choices.ariaLabel') });
    await choices.waitFor();
    const table = page.getByRole('table');
    const open = table.getByRole('row', { name: /ZLV-2409B/ });
    await table.getByRole('row', { name: /ZLV-2406A/ }).waitFor();
    await page.waitForTimeout(400);
    await snap('pricing', {
      1: [choices.getByRole('button').first(), 'top'],
      2: [choices.getByText(op('billing.availability.notDefined')).first(), 'start'],
      3: [btn(op('billing.batch.add.cta')), 'start'],
      4: table.getByRole('row', { name: /ZLV-2406A/ }).getByText(op('billing.batches.status.locked')),
      5: [open.getByRole('button', { name: L.reKey('operator.billing.batches.uploadsFor') }), 'top'],
      6: [open.getByRole('button', { name: L.reKey('operator.billing.batches.deleteFor') }), 'bottom'],
    });

    await btn(op('billing.batch.add.cta')).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel(op('billing.batch.add.batchNumber.label')).fill('ZLV-2501N');
    await dlg.getByLabel(op('billing.batch.add.price.label')).fill('45200.50');
    await dlg.getByLabel(op('billing.batch.add.csv.label')).setInputFiles({
      name: 'zlv-2501n.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Serial,Batch Number\nZLV-25-0001,ZLV-2501N\nZLV-25-0002,ZLV-2501N\nZLV-25-0003,ZLV-2501N', 'utf-8'),
    });
    await dlg.getByText(L.reKey('operator.billing.batch.add.csv.summary')).waitFor();
    await dialogShot('add-batch', {
      1: [dlg.getByText(op('billing.batch.add.batchNumber.label'), { exact: true }), 'end'],
      2: [dlg.getByText(op('billing.batch.add.price.label'), { exact: true }), 'end'],
      3: [dlg.getByText(op('billing.batch.add.distributor.label'), { exact: true }), 'end'],
      4: dlg.getByText(L.reKey('operator.billing.batch.add.csv.summary')),
      5: dlg.getByText(op('billing.batch.add.ack.label')),
      6: [dlg.getByRole('button', { name: op('billing.batch.add.cta') }), 'end'],
    }, dlg);
    await page.keyboard.press('Escape');
  });

  // ---------------------------------------------------------------- programmes
  await part('programs', async () => {
    await go('/programs');
    const pulmora = page.getByRole('row', { name: /Pulmora Relief/ });
    await pulmora.waitFor();
    await page.waitForTimeout(400);
    await snap('programs', {
      1: [page.getByRole('link', { name: op('programs.new.cta') }).first(), 'start'],
      2: [page.getByLabel(op('programs.search.label')), 'end'],
      3: page.getByRole('link', { name: 'OncoCare Support' }),
      4: page.getByRole('columnheader', { name: op('programs.column.coupons') }),
      5: pulmora.getByText(cm('status.program.draft'), { exact: true }),
      6: pulmora.getByRole('link', { name: op('programs.form.cta') }),
    });
  });

  // One new programme, built step by step. In-app navigation only from here: a reload resets the demo data.
  await part('builder', async () => {
    await go('/programs');
    await page.getByRole('link', { name: op('programs.new.cta') }).first().click();
    await page.getByRole('heading', { name: op('programs.new.title') }).waitFor();
    const rail = page.getByRole('navigation', { name: L.reKey('operator.programs.wizard.stepOf') });
    const railStep = (k) => rail.getByRole('button', { name: op(`programs.step.${k}`) });
    const cont = btn(op('programs.wizard.continue'));
    const field = (k) => page.getByLabel(op(`programs.field.${k}`), { exact: true });
    const fieldLabel = (k) => label(op(`programs.field.${k}`));
    const fill = async (testid, groupLabel, button, enLabel, arLabel, entries) => {
      const list = page.getByTestId(testid);
      for (const [i, [en, ar]] of entries.entries()) {
        await list.getByRole('button', { name: button }).click();
        const row = list.getByRole('group', { name: `${groupLabel} ${i + 1}` });
        await row.getByLabel(enLabel).fill(en);
        await row.getByLabel(arLabel).fill(ar);
      }
    };
    const reasons = (testid, groupLabel, entries) => fill(testid, groupLabel, op('programs.field.addReason'),
      op('programs.field.reasonLabelEn'), op('programs.field.reasonLabelAr'), entries);
    const docs = (testid, groupLabel, entries) => fill(testid, groupLabel, op('programs.field.addDocument'),
      op('programs.field.docTitleEn'), op('programs.field.docTitleAr'), entries);

    // 1 — identity & product
    await field('name').fill('Veltrix Care');
    await field('nameAr').fill('فيلتريكس كير');
    await field('therapeuticArea').fill(rtl ? 'الأورام' : 'Oncology');
    await pick(field('product'), /Veltrix/);
    await pick(field('condition'), /.+/);
    await btn(op('programs.field.addStrength')).click();
    await pick(page.getByLabel(op('programs.field.strengthLabel'), { exact: true }).first(), '150mg');
    await reasons('reason-list-diagnosisOptions', op('programs.field.diagnosisList'), [
      ['Metastatic melanoma', 'الورم الميلانيني النقيلي'],
      ['Renal cell carcinoma', 'سرطان الخلايا الكلوية'],
    ]);
    await tall('builder-identity', {
      1: [railStep('review'), 'end'],
      2: [fieldLabel('name'), 'end'],
      3: [fieldLabel('nameAr'), 'end'],
      4: [fieldLabel('product'), 'end'],
      5: [fieldLabel('strengths'), 'end'],
      6: [fieldLabel('diagnosisList'), 'end'],
    });
    await cont.click();

    // 2 — funding & coupons
    await field('fundedCoupons').fill('500');
    await field('dosesPerCoupon').fill('3');
    await text(L.reKey('operator.programs.field.boxesRequired')).waitFor();
    await tall('builder-funding', {
      1: [fieldLabel('fundedCoupons'), 'end'],
      2: [fieldLabel('dosesPerCoupon'), 'end'],
      3: text(L.reKey('operator.programs.field.boxesRequired')),
      4: [fieldLabel('defaultExpiry'), 'end'],
      5: [fieldLabel('followUp'), 'end'],
    });
    await cont.click();

    // 3 — discount & payment: first a look at tiered co-payment, then settle on buy & get
    const model = page.getByRole('group', { name: op('programs.field.model') });
    await model.getByRole('button', { name: op('programs.model.tieredCoPayment') }).click();
    const tiers = [['Full support', 'دعم كامل', '100'], ['Partial support', 'دعم جزئي', '50']];
    for (const [i, [en, ar, pct]] of tiers.entries()) {
      if ((await page.getByLabel(op('programs.field.tierLabel')).count()) <= i) await btn(op('programs.field.addTier')).click();
      await page.getByLabel(op('programs.field.tierLabel')).nth(i).fill(en);
      await page.getByLabel(op('programs.field.tierLabelAr')).nth(i).fill(ar);
      await page.getByLabel(op('programs.field.tierDiscount')).nth(i).fill(pct);
    }
    await tall('builder-tiers', {
      1: [fieldLabel('model'), 'end'],
      2: [page.getByRole('group', { name: op('programs.field.tierShape') }), 'end'],
      3: [fieldLabel('tiers'), 'end'],
      4: [page.getByText(op('programs.field.tierPayment'), { exact: true }).first(), 'end'],
      5: [fieldLabel('financialDocs'), 'end'],
      // In Arabic the tier column 'Patient payment' reads exactly like 'Patient pays': take the last one.
      6: [page.getByText(op('programs.field.payment'), { exact: true }).last(), 'end'],
    });
    await model.getByRole('button', { name: op('programs.model.cycleBased') }).click();
    await field('paidDoses').fill('2');
    await field('freeDoses').fill('1');
    await field('freeDosePosition').fill('3');
    const dose2 = page.getByRole('switch', { name: L.reKey('operator.programs.doseWindow.toggle') }).first();
    await dose2.click();
    await page.getByLabel(op('programs.doseWindow.start')).first().fill('20');
    await page.getByLabel(op('programs.doseWindow.end')).first().fill('45');
    await tall('builder-discount', {
      1: [fieldLabel('model'), 'end'],
      2: [fieldLabel('paidDoses'), 'end'],
      3: [fieldLabel('freeDosePosition'), 'end'],
      4: [page.getByRole('group', { name: op('programs.field.cycleShape') }), 'end'],
      5: [fieldLabel('doseWindows'), 'end'],
      6: [fieldLabel('payment'), 'end'],
    });
    await cont.click();

    // 4 — ways in
    const route = (k) => page.getByRole('checkbox', { name: new RegExp(esc(op(`programs.route.${k}`))) });
    for (const k of ['patientApp', 'directDoctor', 'operatorPortal']) {
      if (!(await route(k).isChecked())) await route(k).click();
    }
    await tall('builder-routes', {
      1: label(op('programs.route.patientApp')),
      2: label(op('programs.route.directDoctor')),
      3: label(op('programs.route.operatorPortal')),
      4: label(op('programs.route.pharmacy')),
      5: text(op('programs.field.routesPerDoctor')),
    });
    await cont.click();

    // 5 — patient consent
    const consent = page.getByRole('switch', { name: op('programs.field.consentToggle') });
    if (!(await consent.isChecked())) await consent.click();
    await page.getByLabel(new RegExp(esc(op('programs.field.lifecycleSummary')))).fill(
      'Your doctor enrols you, you upload your documents in the app, the coordinator checks them, then you collect each dose at your pharmacy.');
    await page.getByLabel(new RegExp(esc(op('programs.field.lifecycleSummaryAr')))).fill(
      'يسجّلك طبيبك، وترفع مستنداتك في التطبيق، ويراجعها المنسّق، ثم تستلم كل جرعة من صيدليتك.');
    await field('consentText').fill('I agree to share my medical documents with the programme team so they can review my case.');
    await field('consentTextAr').fill('أوافق على مشاركة مستنداتي الطبية مع فريق البرنامج لمراجعة حالتي.');
    await tall('builder-consent', {
      1: [fieldLabel('consentToggle'), 'end'],
      2: [page.getByText(op('programs.field.lifecycleSummary')).first(), 'end'],
      3: [fieldLabel('consentText'), 'end'],
      4: [fieldLabel('consentTextAr'), 'end'],
    });
    await cont.click();

    // 6 — validation & documents
    await docs('document-list-requiredMedicalDocuments', op('programs.field.medicalDocs'), [
      ['Oncology report', 'تقرير طبيب الأورام'],
    ]);
    await reasons('reason-list-medicalRejectionReasons', op('programs.field.medicalRejections'), [
      ['Diagnosis not confirmed', 'التشخيص غير مؤكد'],
    ]);
    await reasons('reason-list-correctionReasons', op('programs.field.corrections'), [
      ['Report is unreadable', 'التقرير غير واضح'],
    ]);
    await reasons('reason-list-cancellationReasons', op('programs.field.cancellations'), [
      ['Patient asked to stop', 'طلب المريض التوقف'],
    ]);
    await field('uploadWindow').fill('14');
    await tall('builder-validation', {
      1: [fieldLabel('medicalDocs'), 'end'],
      2: [fieldLabel('medicalRejections'), 'end'],
      3: [fieldLabel('corrections'), 'end'],
      4: [fieldLabel('cancellations'), 'end'],
      5: [fieldLabel('uploadWindow'), 'end'],
      6: [fieldLabel('caseLock'), 'end'],
      7: [fieldLabel('extensions'), 'end'],
    });
    await cont.click();

    // 7 — fulfilment
    const method = page.getByRole('group', { name: op('programs.field.method') });
    await method.waitFor();
    const serial = page.getByRole('switch', { name: op('programs.field.boxSerialTracking') });
    if (!(await serial.isChecked())) await serial.click();
    const search = page.getByRole('switch', { name: op('programs.field.advancedSearch') });
    if (!(await search.isChecked())) await search.click();
    await text(op('programs.field.advancedSearchOnHint')).waitFor();
    await tall('builder-fulfilment', {
      1: [method, 'end'],
      2: [fieldLabel('deliveryCodeValidity'), 'end'],
      3: [fieldLabel('boxSerialTracking'), 'end'],
      4: [fieldLabel('restrictedSerials'), 'end'],
      5: [fieldLabel('advancedSearch'), 'end'],
      6: [text(op('programs.field.advancedSearchOnHint')), 'end'],
      7: [text(op('programs.field.blisterAutoNote')), 'bottom'],
    });
    // Continue on this step saves at once (the button turns into Create program during the click),
    // so the review is opened from the step bar.
    await railStep('review').click();
    const create = btn(op('programs.new.submit'));
    await create.waitFor();
    await create.click();
    await page.waitForURL(/\/programs$/);

    // The new draft and its launch checks.
    await page.getByRole('link', { name: 'Veltrix Care' }).click();
    const checks = page.getByRole('heading', { name: op('programs.detail.launchChecks') });
    await checks.waitFor();
    const formLink = page.getByRole('link', { name: op('programs.detail.noFormCta') }).first();
    await formLink.waitFor();
    await text(op('programs.toast.created')).waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await tall('program-checks', {
      1: [page.getByRole('link', { name: op('programs.detail.editInBuilder') }).first(), 'start'],
      2: [label(op('programs.block.identity')), 'end'],
      3: [checks, 'end'],
      4: [formLink, 'end'],
      5: [btn(op('programs.detail.launchBlocked')), 'end'],
    });

    // Publish a first form; the programme can then launch (checked here, not pictured).
    await formLink.click();
    await btn(op('programs.form.addQuestion')).waitFor(); // a new form opens with one empty question
    await page.getByLabel(op('programs.form.questionEn')).last().fill('Previous treatments');
    await page.getByLabel(op('programs.form.questionAr')).last().fill('العلاجات السابقة');
    await pick(page.getByLabel(op('programs.form.questionType')).last(), op('programs.form.type.freeText'));
    await btn(L.reKey('operator.programs.form.publish')).click();
    await page.waitForURL(/\/programs$/);
    // The programme page keeps its earlier launch checks for half a minute; wait them out.
    await page.waitForTimeout(31_000);
    await page.getByRole('link', { name: 'Veltrix Care' }).click();
    const launch = btn(op('programs.detail.launch'));
    await launch.waitFor();
    await launch.click();
    await text(op('programs.detail.launched')).first().waitFor();
  });

  // ---------------------------------------------------------------- stopping a live programme
  await part('stop', async () => {
    await go('/programs/prog-cardia');
    await btn(op('programs.detail.stop')).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel(op('programs.detail.stopReason')).fill(rtl ? 'سحب التمويل من المكتب العلمي.' : 'Funding withdrawn by the scientific office.');
    await dialogShot('program-stop', {
      1: [dlg.getByRole('heading', { name: op('programs.detail.stopTitle') }), 'end'],
      2: [dlg.getByText(op('programs.detail.stopReason'), { exact: true }), 'end'],
      3: dlg.getByRole('button', { name: op('programs.detail.stopConfirm') }),
    }, dlg);
    await page.keyboard.press('Escape');
  });

  // ---------------------------------------------------------------- the enrolment form
  await part('form', async () => {
    await go('/programs/prog-oncocare/form');
    const q1 = page.getByLabel(op('programs.form.questionEn')).first();
    await q1.waitFor();
    await top();
    await page.waitForTimeout(400);
    await snap('form-top', {
      1: [page.getByRole('heading', { name: op('programs.form.title') }), 'end'],
      2: [label(op('programs.form.locked.diagnosis')), 'end'],
      3: [label(op('programs.form.questionEn')), 'end'],
      4: [label(op('programs.form.questionType')), 'end'],
      5: [label(op('programs.form.questionRequired')), 'end'],
      6: [btn(op('programs.form.addOption')).first(), 'start'],
    });

    const conditional = btn(op('programs.form.condition.cta')).last();
    await conditional.click();
    await page.waitForTimeout(400);
    const tests = page.getByPlaceholder(op('programs.form.testEn')).first();
    await focus(tests);
    await snap('form-bottom', {
      1: [label(op('programs.form.condition.question')), 'end'],
      2: [label(op('programs.form.condition.option')), 'end'],
      3: [btn(op('programs.form.addQuestion')), 'end'],
      4: [tests, 'end'],
      5: [btn(op('programs.form.addTest')), 'end'],
      6: [btn(L.reKey('operator.programs.form.publish')).locator('..'), 'end'],
    });
  });

  // ---------------------------------------------------------------- networks
  await part('doctors', async () => {
    await go('/network/doctors');
    await pickProgram(PROG.onco);
    const code = page.getByLabel(op('network.doctors.attach.code'));
    await code.fill('DOC-EG-9D27E4');
    await btn(op('network.attach.lookupCta')).click();
    const found = text(L.reKey('operator.network.attach.resolved'));
    await found.waitFor();
    await page.getByLabel(op('network.doctors.attach.opening')).fill('5');
    await page.waitForTimeout(300);
    const samir = page.getByRole('row', { name: /Samir Fahmy/ });
    await snap('doctor-network', {
      1: [page.getByLabel(op('allocations.program'), { exact: true }), 'end'],
      2: [label(op('network.doctors.attach.code')), 'end'],
      3: [found, 'end'],
      4: [label(op('network.doctors.attach.opening')), 'end'],
      5: [btn(op('network.doctors.attach.cta')), 'start'],
      6: [samir.getByRole('switch', { name: L.reKey('operator.network.routes.directDoctorFor') }), 'start'],
      7: [samir.getByRole('button', { name: L.reKey('operator.network.doctors.removeFor') }), 'start'],
    });
  });

  await part('pharmacies', async () => {
    // The pharmacy table is wide: a wider window shows every column at once.
    await page.setViewportSize({ width: 1640, height: VIEWPORT.height });
    await go('/network/pharmacies');
    await pickProgram(PROG.onco);
    const roshdy = page.getByRole('row', { name: /Roshdy/ });
    const ezaby = page.getByRole('row', { name: /El Ezaby/ });
    await roshdy.waitFor();
    await page.waitForTimeout(400);
    const m = await main.boundingBox();
    const y = await headerBottom();
    const f = await frameBox({ x: m.x, y, w: m.width, h: Math.min(VIEWPORT.height, await contentBottom()) - y });
    await shot('pharmacy-network', {
      1: [label(op('network.pharmacies.attach.code')), 'end'],
      2: [btn(op('network.attach.lookupCta')), 'start'],
      3: roshdy.getByText(op('network.stock.none')),
      4: [roshdy.getByRole('switch'), 'end'],
      5: [ezaby.getByText('5 / 0 / 0', { exact: true }), 'start'],
      6: [roshdy.getByRole('textbox'), 'top'],
      7: [ezaby.getByRole('button', { name: L.reKey('operator.network.stock.toggleFor') }), 'bottom'],
    }, { clip: f });
    await unframe();
    await page.setViewportSize(VIEWPORT);
  });

  // ---------------------------------------------------------------- places
  await part('allocation', async () => {
    await go('/allocations');
    await pickProgram(PROG.onco);
    await text(op('allocations.pools.title')).waitFor();
    const samir = page.getByRole('row', { name: /Samir/ }).filter({ has: page.getByRole('textbox', { name: L.reKey('operator.allocations.grant.amountFor') }) });
    await samir.getByRole('textbox').fill('5');
    await tall('allocation', {
      1: [text(op('allocations.pools.title')), 'end'],
      2: text(op('allocations.pools.operatorBalance'), { exact: true }).first(),
      3: [btn(op('allocations.pools.save')), 'end'],
      4: [text(op('allocations.funding.title')), 'end'],
      5: [page.getByRole('heading', { name: op('allocations.doctors.title') }), 'end'],
      6: [samir.getByRole('textbox'), 'top'],
      7: [page.getByRole('heading', { name: op('allocations.requests.title') }), 'end'],
    });
  });

  // ---------------------------------------------------------------- users
  await part('users', async () => {
    await go('/users');
    const omar = page.getByRole('row', { name: /Omar Fathy/ });
    const youssef = page.getByRole('row', { name: /Youssef Ramy/ });
    await omar.waitFor();
    await page.waitForTimeout(400);
    await snap('users', {
      1: [btn(op('users.add.cta')), 'start'],
      2: [page.getByLabel(op('users.search.ariaLabel')), 'end'],
      3: page.getByRole('row', { name: /Hala Mostafa/ }).getByText(/Super admin|المسؤول الرئيسي/),
      4: [youssef.getByRole('button', { name: L.reKey('operator.users.rename.for') }), 'bottom'],
      5: [youssef.getByRole('button', { name: L.reKey('operator.users.programs.for') }), 'bottom'],
      6: [youssef.getByRole('button', { name: cm('users.activate') }), 'bottom'],
      7: [youssef.getByRole('button', { name: op('users.delete.confirm') }), 'bottom'],
    });

    await btn(op('users.add.cta')).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel(op('users.field.displayName')).fill(rtl ? 'سارة نبيل' : 'Sara Nabil');
    await dlg.getByLabel(op('users.field.phone')).fill('01012345678');
    await dlg.getByLabel(op('users.field.temporaryPassword')).fill('Welcome-2026');
    await dialogShot('add-user', {
      1: [dlg.getByText(op('users.field.displayName'), { exact: true }), 'end'],
      2: [dlg.getByText(op('users.field.phone'), { exact: true }), 'end'],
      3: [dlg.getByText(op('users.field.temporaryPassword'), { exact: true }), 'end'],
      4: [dlg.getByText(op('users.field.role'), { exact: true }), 'end'],
      5: [dlg.getByRole('button', { name: op('users.add.submit') }), 'end'],
    }, dlg);
    await page.keyboard.press('Escape');
    await dlg.waitFor({ state: 'hidden' });

    await omar.getByRole('button', { name: L.reKey('operator.users.programs.for') }).click();
    const access = page.getByRole('dialog');
    const canEnrol = access.getByRole('switch').first();
    await canEnrol.waitFor();
    await dialogShot('user-access', {
      1: [access.getByRole('checkbox').first(), 'start'],
      2: [access.getByText(op('users.programs.canEnrol'), { exact: true }).first(), 'end'],
      3: [access.getByText(op('users.programs.places'), { exact: false }).first(), 'end'],
      4: [access.getByText(op('users.programs.grantHint')), 'end'],
      5: [access.getByRole('button', { name: op('users.programs.save') }), 'end'],
    }, access);
    await page.keyboard.press('Escape');
  });

  // ---------------------------------------------------------------- home nurse
  await part('nurse', async () => {
    await go('/nurse/capacity');
    await btn(op('nurse.capacity.add')).click();
    const dlg = page.getByRole('dialog');
    await pick(dlg.getByRole('combobox').first(), PROG.cardia);
    await pick(dlg.getByLabel(op('nurse.capacity.field.governorate')), /Cairo|القاهرة/);
    await pick(dlg.getByLabel(op('nurse.capacity.field.region')), /Heliopolis|مصر الجديدة/);
    for (const d of [0, 2, 4]) await dlg.getByRole('button', { name: op(`nurse.day.${d}`), exact: true }).click();
    await dlg.getByLabel(op('nurse.capacity.field.capacity')).fill('2');
    await dialogShot('nurse-rule', {
      1: [dlg.getByText(op('nurse.capacity.field.program'), { exact: true }), 'end'],
      2: [dlg.getByText(op('nurse.capacity.field.governorate'), { exact: true }), 'end'],
      3: [dlg.getByText(op('nurse.capacity.field.region'), { exact: true }), 'end'],
      4: [dlg.getByText(L.key('operator.nurse.capacity.column.days'), { exact: true }), 'end'],
      5: [dlg.getByText(op('nurse.capacity.field.slotMinutes'), { exact: true }), 'end'],
      6: [dlg.getByText(op('nurse.capacity.field.capacity'), { exact: true }), 'end'],
      7: [dlg.getByText(op('nurse.capacity.field.active'), { exact: true }), 'end'],
    }, dlg);
    await page.keyboard.press('Escape');

    await go('/nurse/visits');
    const card = page.locator('section').filter({ hasText: op('nurse.visits.cannotReach.title') });
    await card.waitFor();
    await page.waitForTimeout(400);
    await tall('nurse-visits', {
      1: [page.getByRole('combobox').first(), 'end'],
      2: text(cm('psp.doseStatus.visitScheduled'), { exact: true }).first(),
      3: [text(op('nurse.visits.addressNote')).first(), 'end'],
      4: [text(op('nurse.visits.cannotReach.title')), 'end'],
      5: [text(op('nurse.visits.noAutoFail')), 'end'],
    });
  });

  // ---------------------------------------------------------------- limits, audit, dashboards, reports, alerts
  await part('limit', async () => {
    await go('/settings/coupon-limit');
    await page.getByLabel(op('limits.field.maxCoupons')).waitFor();
    await page.waitForTimeout(400);
    await snap('coupon-limit', {
      1: [text(op('limits.flagsOnly')), 'end'],
      2: [label(op('limits.field.maxCoupons')), 'end'],
      3: [label(op('limits.field.windowDays')), 'end'],
      4: [btn(cm('common.save')), 'end'],
    });
  });

  await part('audit', async () => {
    await go('/audit');
    const firstRow = page.getByRole('row').nth(1);
    await firstRow.waitFor();
    await page.waitForTimeout(400);
    await snap('audit', {
      1: [label(op('audit.search.label')), 'end'],
      2: [label(op('audit.filter.entityType')), 'end'],
      3: [label(op('audit.filter.from')), 'end'],
      4: [page.getByRole('columnheader', { name: op('audit.column.actor') }), 'end'],
      5: [page.getByRole('columnheader', { name: op('audit.column.action') }), 'end'],
      6: [page.getByRole('columnheader', { name: op('audit.column.summary') }), 'end'],
    });
  });

  await part('metrics', async () => {
    await go('/metrics');
    const tabs = page.getByRole('tablist');
    await tabs.waitFor();
    await page.waitForTimeout(1500);
    await snap('metrics', {
      1: [page.getByRole('navigation', { name: op('metrics.title') }).getByRole('link').first(), 'start'],
      2: [page.getByLabel(op('metrics.filter.program')), 'top'],
      3: [page.getByRole('group', { name: op('metrics.filter.rangeLabel') }), 'top'],
      4: [page.getByRole('group', { name: op('metrics.filter.granularityLabel') }), 'top'],
      5: [tabs.getByRole('tab').first(), 'top'],
    });
  });

  await part('compensation', async () => {
    await go('/compensation');
    await pickProgram(PROG.onco);
    await btn(L.reKey('operator.billing.reports.regenerateFor')).first().waitFor();
    await page.waitForTimeout(400);
    await tall('compensation', {
      1: [page.getByLabel(op('allocations.program'), { exact: true }), 'end'],
      2: [label(op('billing.reports.view.label')), 'end'],
      3: [label(op('billing.reports.from.label')), 'end'],
      4: [label(op('billing.reports.pharmacyFilter.label')), 'end'],
      5: [btn(op('billing.reports.generate.cta'), { exact: true }), 'end'],
      6: [btn(L.reKey('operator.billing.reports.regenerateFor')).first(), 'start'],
      7: [btn(L.reKey('operator.billing.reports.downloadFor')).first(), 'end'],
    });
  });

  await part('notifications', async () => {
    await go('/notifications');
    await btn(cm('notifications.markAllRead')).waitFor();
    await page.waitForTimeout(500);
    await snap('notifications', {
      1: [btn(cm('notifications.markAllRead')), 'start'],
      2: [btn(cm('notifications.filter.unread')), 'end'],
      3: [main.getByRole('listitem').first(), 'end'],
    });
  });

  // ---------------------------------------------------------------- the Super Admin
  await part('super', async () => {
    await btn(cm('settings.title')).click();
    await page.getByRole('menuitem', { name: cm('auth.signOut') }).click();
    await page.getByLabel(L('Phone number')).waitFor();
    await signIn('01000000004');
    await btn(L('Sign in')).click();
    await page.getByRole('heading', { name: op('programs.title') }).waitFor();
    await go('/metrics');
    const title = text(op('metrics.bottleneck.title'));
    await title.waitFor();
    await page.waitForTimeout(1200);
    await snap('super-bottleneck', {
      1: [title, 'end'],
      2: [text(op('metrics.bottleneck.dummyBadge'), { exact: true }), 'start'],
      3: [text(L.reKey('operator.metrics.bottleneck.callout')), 'end'],
      4: [text(op('metrics.bottleneck.tag'), { exact: true }).last(), 'end'],
    });
  });
});

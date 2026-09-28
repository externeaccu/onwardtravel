// Verifies the window.claude mock itself: async arrival, rules, queries, {self} privacy.
export default async function (page, t) {
  const r = await page.evaluate(async () => {
    const out = {};
    out.syncMember = typeof window.claude.db; // must be 'undefined'
    const db = await window.claude.use('db');
    const user = await window.claude.use('user');
    out.dbNull = db === null; out.userNull = user === null;
    if (!db || !user) return out;
    out.me = await user.me(); out.canEdit = await user.canEdit(); out.canWrite = await user.can('data.write');
    // departures: read by all, write by admin only
    try { await db.doc('departures/d1').set({ trekId: 'poon-hill', start: '2026-10-05', capacity: 8, spotsLeft: 8, status: 'open' }); out.depWrite = 'ok'; } catch (e) { out.depWrite = e.code; }
    out.depRead = (await db.doc('departures/d1').get()).exists;
    // bookings/{self}
    const uid = await user.id();
    try { await db.doc('bookings/' + uid).set({ items: [{ id: 'b1', departureId: 'd1', status: 'requested' }] }); out.ownBookingWrite = 'ok'; } catch (e) { out.ownBookingWrite = e.code; }
    out.ownBookingRead = (await db.doc('bookings/' + uid).get()).exists;
    try { await db.doc('bookings/u_alice').set({ items: [] }); out.siblingWrite = 'ok'; } catch (e) { out.siblingWrite = e.code; }
    out.siblingRead = (await db.doc('bookings/u_alice').get()).exists;
    const q = await db.collection('departures').where('status', '==', 'open').orderBy('start').get();
    out.querySize = q.size;
    out.listAllBookings = (await db.collection('bookings').get()).size;
    // snapshot fires
    out.snap = await new Promise(res => { const un = db.doc('departures/d1').onSnapshot(s => { un(); res(s.exists); }); });
    return out;
  });
  t.log(JSON.stringify(r));
  t.expect(r.syncMember === 'undefined', 'no synchronous claude.db member');
  if (t.role === 'none') { t.expect(r.dbNull && r.userNull, 'role none => both null'); return r; }
  t.expect(!r.dbNull && !r.userNull, 'db and user resolve');
  if (t.role === 'owner' || t.role === 'admin') {
    t.expect(r.depWrite === 'ok', 'admin can write departures');
    t.expect(r.siblingWrite === 'ok' && r.siblingRead === true, 'admin can read/write sibling bookings');
    t.expect(r.listAllBookings >= 2, 'admin lists all bookings');
  } else if (t.role === 'interact') {
    t.expect(r.depWrite === 'invalid_argument', 'contributor cannot write departures');
    t.expect(r.ownBookingWrite === 'ok' && r.ownBookingRead === true, 'contributor writes/reads own bookings');
    t.expect(r.siblingWrite === 'invalid_argument' && r.siblingRead === false, 'contributor cannot see sibling bookings');
    t.expect(r.listAllBookings === 1, 'contributor lists only own booking doc');
  } else if (t.role === 'view') {
    t.expect(r.depWrite === 'invalid_argument' && r.ownBookingWrite === 'invalid_argument', 'viewer cannot write');
    t.expect(r.canWrite === false, 'can(data.write) false for viewer');
  }
  return r;
}

// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    phoneKey, isValidPhone, leadCode, asStatus, callStats, fromDeviceCall, resolveRange, istDay, istStart,
    daysIn, dailyCalls, formatDuration, workSummary, followUpBucket, mapImportRow, pct,
} from "./sales-crm.ts";

test("phone numbers match on the last 10 digits", () => {
    assert.equal(phoneKey("+91 98765-43210"), "9876543210");
    assert.equal(phoneKey("09876543210"), "9876543210");
    assert.equal(phoneKey("98765 43210"), "9876543210");
    assert.equal(isValidPhone("12345"), false);
    assert.equal(leadCode(1024), "L-1024");
});

test("statuses read from labels and codes", () => {
    assert.equal(asStatus("Quotation Sent"), "QUOTATION_SENT");
    assert.equal(asStatus("follow-up required"), "FOLLOW_UP");
    assert.equal(asStatus("converted"), "CONVERTED");
    assert.equal(asStatus("maybe"), null);
});

const at = (iso) => new Date(iso);
const call = (o) => ({ userId: "u1", direction: "OUTGOING", status: "CONNECTED", source: "DEVICE", startedAt: at("2026-11-21T05:00:00Z"), durationSec: 60, talkSec: 60, ...o });

test("call stats count verified calls only; manual entries never add talk time", () => {
    const s = callStats([
        call({ talkSec: 120, durationSec: 120 }),
        call({ status: "NOT_ANSWERED", talkSec: 0, durationSec: 0 }),
        call({ direction: "INCOMING", status: "MISSED", talkSec: 0, durationSec: 0, source: "PROVIDER", startedAt: at("2026-11-21T09:00:00Z") }),
        call({ direction: "INCOMING", status: "REJECTED", talkSec: 0, durationSec: 0 }),
        call({ talkSec: 60, durationSec: 75, source: "PROVIDER" }),
        call({ source: "MANUAL", talkSec: null, durationSec: null }), // self-reported
    ]);
    assert.equal(s.total, 5);
    assert.equal(s.outgoing, 3);
    assert.equal(s.incoming, 2);
    assert.equal(s.connected, 2);
    assert.equal(s.missed, 1);
    assert.equal(s.rejected, 1);
    assert.equal(s.notAnswered, 1);
    assert.equal(s.talkSec, 180);
    assert.equal(s.durationSec, 195);
    assert.equal(s.avgTalkSec, 90);
    assert.equal(s.selfReported, 1);
    assert.deepEqual(s.lastCallAt, at("2026-11-21T09:00:00Z"));
});

test("android call log rows: outgoing with 0s is not answered, never connected", () => {
    const base = { id: "1", number: "9876543210", date: Date.parse("2026-11-21T05:00:00Z") };
    assert.equal(fromDeviceCall({ ...base, type: 2, duration: 0 }).status, "NOT_ANSWERED");
    const out = fromDeviceCall({ ...base, type: 2, duration: 95 });
    assert.equal(out.status, "CONNECTED");
    assert.equal(out.talkSec, 95);
    assert.equal(out.endedAt.toISOString(), "2026-11-21T05:01:35.000Z");
    assert.equal(fromDeviceCall({ ...base, type: 3, duration: 0 }).status, "MISSED");
    assert.equal(fromDeviceCall({ ...base, type: 5, duration: 0 }).status, "REJECTED");
    assert.equal(fromDeviceCall({ ...base, type: 1, duration: 40 }).direction, "INCOMING");
    assert.equal(fromDeviceCall({ ...base, type: 99, duration: 1 }), null);
});

test("date ranges are India days", () => {
    // 11 pm UTC on the 20th is already the 21st in India
    assert.equal(istDay(at("2026-11-20T19:00:00Z")), "2026-11-21");
    assert.equal(istStart("2026-11-21").toISOString(), "2026-11-20T18:30:00.000Z");
    const today = resolveRange("today", "2026-11-21");
    assert.equal(today.start.toISOString(), "2026-11-20T18:30:00.000Z");
    assert.equal(today.end.toISOString(), "2026-11-21T18:30:00.000Z");
    assert.deepEqual([resolveRange("yesterday", "2026-11-01").from, resolveRange("7d", "2026-11-21").from, resolveRange("30d", "2026-11-21").from], ["2026-10-31", "2026-11-15", "2026-10-23"]);
    const c = resolveRange("custom", "2026-11-21", "2026-11-10", "2026-11-05"); // swapped ends
    assert.deepEqual([c.from, c.to], ["2026-11-05", "2026-11-10"]);
    assert.equal(resolveRange("custom", "2026-11-21", "junk").preset, "today");
    assert.equal(resolveRange("nonsense", "2026-11-21").preset, "today");
    assert.equal(daysIn("2026-11-28", "2026-12-02").length, 5);
});

test("daily calls chart buckets by India day and skips self-reported calls", () => {
    const d = dailyCalls([
        call({ startedAt: at("2026-11-20T19:00:00Z") }), // 21st IST
        call({ startedAt: at("2026-11-20T10:00:00Z"), status: "NOT_ANSWERED", talkSec: 0 }),
        call({ startedAt: at("2026-11-20T10:00:00Z"), source: "MANUAL" }),
    ], "2026-11-20", "2026-11-21");
    assert.deepEqual(d.map((x) => [x.day, x.calls, x.connected, x.talkSec]), [["2026-11-20", 1, 0, 0], ["2026-11-21", 1, 1, 60]]);
});

test("durations read naturally", () => {
    assert.equal(formatDuration(42), "42s");
    assert.equal(formatDuration(75), "1m 15s");
    assert.equal(formatDuration(3900), "1h 05m");
    assert.equal(formatDuration(null), "0s");
});

test("work summary: logged in time minus breaks, clipped to the range, open session runs to now", () => {
    const start = at("2026-11-21T00:00:00Z"), end = at("2026-11-22T00:00:00Z");
    const sessions = [
        { startedAt: at("2026-11-21T04:00:00Z"), endedAt: at("2026-11-21T08:00:00Z") }, // 4h
        { startedAt: at("2026-11-21T09:00:00Z"), endedAt: null }, // open
        { startedAt: at("2026-11-20T04:00:00Z"), endedAt: at("2026-11-20T08:00:00Z") }, // other day
    ];
    const events = [
        { status: "AVAILABLE", startedAt: at("2026-11-21T04:00:00Z"), endedAt: at("2026-11-21T06:00:00Z") },
        { status: "LUNCH", startedAt: at("2026-11-21T06:00:00Z"), endedAt: at("2026-11-21T06:30:00Z") },
        { status: "BREAK", startedAt: at("2026-11-21T09:30:00Z"), endedAt: null }, // still on break
    ];
    const s = workSummary(sessions, events, start, end, at("2026-11-21T10:00:00Z"));
    assert.equal(s.loggedInSec, 5 * 3600);
    assert.equal(s.breakSec, 3600);
    assert.equal(s.workedSec, 4 * 3600);
    assert.equal(s.breaks, 2);
    assert.deepEqual(s.firstLogin, at("2026-11-21T04:00:00Z"));
    assert.equal(s.lastLogout, null); // still working
});

test("follow-ups: overdue once due time passes, today until India midnight", () => {
    const now = at("2026-11-21T06:00:00Z"); // 11:30 IST
    assert.equal(followUpBucket(at("2026-11-21T05:00:00Z"), now), "OVERDUE");
    assert.equal(followUpBucket(at("2026-11-21T18:00:00Z"), now), "TODAY"); // 23:30 IST
    assert.equal(followUpBucket(at("2026-11-21T18:45:00Z"), now), "UPCOMING"); // 00:15 IST next day
    assert.equal(pct(1, 3), 33.3);
    assert.equal(pct(1, 0), 0);
});

test("import rows: header aliases, validation and Indian dates", () => {
    const r = mapImportRow({ "Customer Name": " Mehta ", "Mobile Number": "+91 98111 22233", City: "Delhi", "Product Interest": "curtains, Blinds", Budget: "₹45,000", Priority: "hot", Status: "Interested", "Next Follow-up": "05/12/2026", "Assigned To": "ravi@shop.in" });
    assert.equal(r.ok, true);
    assert.equal(r.row.name, "Mehta");
    assert.deepEqual(r.row.productInterest, ["Curtains", "Blinds"]);
    assert.equal(r.row.budget, 45000);
    assert.equal(r.row.priority, "Hot");
    assert.equal(r.row.status, "INTERESTED");
    assert.equal(r.row.nextFollowUp, "2026-12-05");
    assert.equal(r.row.assignee, "ravi@shop.in");
    assert.equal(mapImportRow({ name: "X", phone: 46000 + 0 }).ok, false); // bad phone
    assert.equal(mapImportRow({ phone: "9876543210" }).ok, false); // no name
    assert.equal(mapImportRow({ name: "X", phone: "9876543210", status: "maybe" }).ok, false);
    assert.equal(mapImportRow({ name: "X", phone: "9876543210", "follow up date": 46361 }).row.nextFollowUp, "2026-12-05"); // Excel serial
    assert.equal(mapImportRow({ name: "X", phone: "9876543210" }).row.priority, "Warm");
});

import { parseExotel, parseGeneric, parseProviderTime, encodeCustomField } from "./telephony.ts";

test("exotel callback: talk time decides connected; India timestamps", () => {
    assert.equal(parseProviderTime("2026-11-21 10:00:00").toISOString(), "2026-11-21T04:30:00.000Z");
    const out = parseExotel({
        CallSid: "abc", Status: "completed", Direction: "outbound-api", From: "09811111111", To: "09876543210",
        StartTime: "2026-11-21 10:00:00", EndTime: "2026-11-21 10:03:00", ConversationDuration: "150",
        CustomField: encodeCustomField("u1", "lead1"), RecordingUrl: "https://rec/1.mp3",
    });
    assert.equal(out.status, "CONNECTED");
    assert.equal(out.customerPhone, "09876543210");
    assert.equal(out.agent.userId, "u1");
    assert.equal(out.leadId, "lead1");
    assert.equal(out.durationSec, 180);
    assert.equal(out.talkSec, 150);
    assert.equal(out.answeredAt.toISOString(), "2026-11-21T04:30:30.000Z");
    // completed but nobody talked: not connected
    assert.equal(parseExotel({ CallSid: "x", Status: "completed", Direction: "outbound-api", To: "1", ConversationDuration: "0" }).status, "NOT_ANSWERED");
    assert.equal(parseExotel({ CallSid: "x", Status: "busy", Direction: "outbound-api", To: "1" }).status, "BUSY");
    const missed = parseExotel({ CallSid: "y", Status: "no-answer", Direction: "inbound", From: "09876543210", DialWhomNumber: "09811111111" });
    assert.equal(missed.direction, "INCOMING");
    assert.equal(missed.status, "MISSED");
    assert.equal(missed.agent.phone, "09811111111");
    assert.equal(parseExotel({}), null);
});

test("generic webhook: connected without talk time is not connected", () => {
    const base = { externalId: "g1", customerPhone: "9876543210", startedAt: "2026-11-21T04:30:00Z", agentEmail: "a@b.c" };
    assert.equal(parseGeneric({ ...base, status: "connected", talkSec: 0 }).status, "NOT_ANSWERED");
    const ok = parseGeneric({ ...base, status: "answered", talkSec: 42, endedAt: "2026-11-21T04:31:00Z" });
    assert.equal(ok.status, "CONNECTED");
    assert.equal(ok.durationSec, 60);
    assert.equal(parseGeneric({ ...base, direction: "incoming", status: "missed" }).direction, "INCOMING");
    assert.equal(parseGeneric({ customerPhone: "1" }), null);
});

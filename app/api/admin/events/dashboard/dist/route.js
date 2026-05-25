"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.GET = void 0;
var admin_1 = require("@/lib/admin");
var auth_1 = require("@/lib/auth");
var db_1 = require("@/lib/db");
var server_1 = require("next/server");
var MAX_IMPACT_SECONDS = 30 * 24 * 60 * 60;
function toNumber(value) {
    var numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
}
function toNullableNumber(value) {
    if (value == null)
        return null;
    var numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}
function parseImpactSeconds(value) {
    var match = value.match(/^(\d+)(seconds|minutes|hours|days)$/);
    if (!match)
        return null;
    var amount = Number(match[1]);
    if (!Number.isInteger(amount) || amount <= 0)
        return null;
    var unit = match[2];
    var seconds = unit === "days"
        ? amount * 24 * 60 * 60
        : unit === "hours"
            ? amount * 60 * 60
            : unit === "minutes"
                ? amount * 60
                : amount;
    if (seconds > MAX_IMPACT_SECONDS)
        return null;
    return seconds;
}
function GET(request) {
    var _a, _b, _c, _d, _e, _f;
    return __awaiter(this, void 0, void 0, function () {
        var session, email, isAdmin, searchParams, postToBookDetailSeconds, postToLoanSeconds, bookDetailToLoanSeconds, _g, summaryResult, pathResult, rankingResult, recentLogsResult, summary, paths, error_1;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0: return [4 /*yield*/, auth_1.auth()];
                case 1:
                    session = _h.sent();
                    email = (_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.email;
                    if (!email) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: "認証が必要です" }, { status: 401 })];
                    }
                    return [4 /*yield*/, admin_1.Admin(email)];
                case 2:
                    isAdmin = _h.sent();
                    if (!isAdmin) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 })];
                    }
                    searchParams = new URL(request.url).searchParams;
                    postToBookDetailSeconds = parseImpactSeconds((_b = searchParams.get("postToBookDetailImpactTime")) !== null && _b !== void 0 ? _b : "");
                    postToLoanSeconds = parseImpactSeconds((_c = searchParams.get("postToLoanImpactTime")) !== null && _c !== void 0 ? _c : "");
                    bookDetailToLoanSeconds = parseImpactSeconds((_d = searchParams.get("bookDetailToLoanImpactTime")) !== null && _d !== void 0 ? _d : "");
                    if (postToBookDetailSeconds == null ||
                        postToLoanSeconds == null ||
                        bookDetailToLoanSeconds == null) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: "影響時間は 1seconds〜30days の形式で指定してください" }, { status: 400 })];
                    }
                    _h.label = 3;
                case 3:
                    _h.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, Promise.all([
                            db_1.db.query("SELECT\n           COUNT(*) FILTER (WHERE \"eventType\" = 'post_view') AS \"postViewCount\",\n           COUNT(*) FILTER (WHERE \"eventType\" = 'book_detail_view') AS \"bookDetailViewCount\",\n           COUNT(*) FILTER (WHERE \"eventType\" = 'loan') AS \"loanCount\",\n           COUNT(DISTINCT \"userEmail\") AS \"uniqueUserCount\"\n         FROM \"ResearchEvent\""),
                            db_1.db.query("WITH\n           --\u6295\u7A3F\u3092\u898B\u305F\u3042\u3068\u3001\u6307\u5B9A\u6642\u9593\u5185\u306B\u540C\u3058\u672C\u306E\u8A73\u7D30\u3092\u898B\u305F\u304B\u305A\n           \"postToBookDetail\" AS (\n             SELECT\n               detail.id,\n               EXTRACT(EPOCH FROM (detail.\"occurredAt\" - post.\"occurredAt\")) AS seconds\n             FROM \"ResearchEvent\" detail\n             JOIN LATERAL (\n               SELECT post.\"occurredAt\"\n               FROM \"ResearchEvent\" post\n               WHERE post.\"eventType\" = 'post_view'\n                 AND post.\"userEmail\" = detail.\"userEmail\"\n                 AND post.\"bookId\" = detail.\"bookId\"\n                 AND post.\"occurredAt\" <= detail.\"occurredAt\"\n                 AND post.\"occurredAt\" >= detail.\"occurredAt\" - ($1::int * interval '1 second')\n               ORDER BY post.\"occurredAt\" DESC\n               LIMIT 1\n             ) post ON true\n             WHERE detail.\"eventType\" = 'book_detail_view'\n           ),\n           --\u6295\u7A3F\u3092\u898B\u305F\u5F8C\u6307\u5B9A\u6642\u9593\u5185\u306B\u540C\u3058\u672C\u3092\u501F\u308A\u305F\u304B\u305A\n           \"postToLoan\" AS (\n             SELECT loan.id\n             FROM \"ResearchEvent\" loan\n             WHERE loan.\"eventType\" = 'loan'\n               AND EXISTS (\n                 SELECT 1\n                 FROM \"ResearchEvent\" post\n                 WHERE post.\"eventType\" = 'post_view'\n                   AND post.\"userEmail\" = loan.\"userEmail\"\n                   AND post.\"bookId\" = loan.\"bookId\"\n                   AND post.\"occurredAt\" <= loan.\"occurredAt\"\n                   AND post.\"occurredAt\" >= loan.\"occurredAt\" - ($2::int * interval '1 second')\n                   AND NOT EXISTS (\n                     SELECT 1\n                     FROM \"ResearchEvent\" previous_loan\n                     WHERE previous_loan.\"eventType\" = 'loan'\n                       AND previous_loan.\"userEmail\" = loan.\"userEmail\"\n                       AND previous_loan.\"bookId\" = loan.\"bookId\"\n                       AND previous_loan.\"occurredAt\" > post.\"occurredAt\"\n                       AND previous_loan.\"occurredAt\" < loan.\"occurredAt\"\n                   )\n               )\n           ),\n           --\u6295\u7A3F\u30FB\u30B3\u30E1\u30F3\u30C8\u5185\u306E\u672C\u30EA\u30F3\u30AF\u3092\u62BC\u3057\u305F\u304B\u305A\n           \"threadLinkClick\" AS (\n             SELECT link.id\n             FROM \"ResearchEvent\" link\n             WHERE link.\"eventType\" = 'book_link_click'\n               AND link.\"sourceType\" IN ('thread', 'comment')\n           ),\n           --ai\u30C1\u30E3\u30C3\u30C8\u5185\u306E\u672C\u30EA\u30F3\u30AF\u3092\u62BC\u3057\u305F\u304B\u305A\n            \"aichatlinkClick\" AS(\n              SELECT link.id\n              FROM \"ResearchEvent\" link\n              WHERE link.\"eventType\" = 'book_link_click'\n                AND link.\"sourceType\" = 'ai_chat'\n            ),\n           --\u672C\u306E\u8A73\u7D30\u3092\u898B\u305F\u5F8C\u3001\u6307\u5B9A\u6642\u9593\u5185\u306B\u540C\u3058\u672C\u3092\u501F\u308A\u305F\u304B\u305A\n           \"bookDetailToLoan\" AS (\n             SELECT\n               loan.id,\n               EXTRACT(EPOCH FROM (loan.\"occurredAt\" - detail.\"occurredAt\")) AS seconds\n             FROM \"ResearchEvent\" loan\n             JOIN LATERAL (\n               SELECT detail.\"occurredAt\"\n               FROM \"ResearchEvent\" detail\n                 WHERE detail.\"eventType\" = 'book_detail_view'\n                   AND detail.\"userEmail\" = loan.\"userEmail\"\n                   AND detail.\"bookId\" = loan.\"bookId\"\n                   AND detail.\"occurredAt\" <= loan.\"occurredAt\"\n                 AND detail.\"occurredAt\" >= loan.\"occurredAt\" - ($3::int * interval '1 second')\n                 AND NOT EXISTS (\n                   SELECT 1\n                   FROM \"ResearchEvent\" previous_loan\n                   WHERE previous_loan.\"eventType\" = 'loan'\n                     AND previous_loan.\"userEmail\" = loan.\"userEmail\"\n                     AND previous_loan.\"bookId\" = loan.\"bookId\"\n                     AND previous_loan.\"occurredAt\" > detail.\"occurredAt\"\n                     AND previous_loan.\"occurredAt\" < loan.\"occurredAt\"\n                 )\n               ORDER BY detail.\"occurredAt\" DESC\n               LIMIT 1\n             ) detail ON true\n             WHERE loan.\"eventType\" = 'loan'\n           )\n         SELECT\n           (SELECT COUNT(*) FROM \"postToBookDetail\") AS \"postToBookDetailCount\",\n           (SELECT COUNT(*) FROM \"postToLoan\") AS \"postToLoanCount\",\n           (SELECT COUNT(*) FROM \"threadLinkClick\") AS \"threadLinkClickCount\",\n           (SELECT COUNT(*) FROM \"bookDetailToLoan\") AS \"bookDetailToLoanCount\",\n           (SELECT AVG(seconds) FROM \"postToBookDetail\") AS \"avgPostToBookDetailSeconds\",\n           (SELECT AVG(seconds) FROM \"bookDetailToLoan\") AS \"avgBookDetailToLoanSeconds\"", [
                                postToBookDetailSeconds,
                                postToLoanSeconds,
                                bookDetailToLoanSeconds,
                            ]),
                            db_1.db.query("SELECT\n           event.\"bookId\",\n           book.title,\n           COUNT(*) AS \"viewCount\"\n         FROM \"ResearchEvent\" event\n         LEFT JOIN \"Book\" book ON book.id = event.\"bookId\"\n         WHERE event.\"eventType\" = 'book_detail_view'\n         GROUP BY event.\"bookId\", book.title\n         ORDER BY COUNT(*) DESC, book.title ASC\n         LIMIT 10"),
                            db_1.db.query("SELECT\n           event.id,\n           event.\"occurredAt\",\n           event.\"eventType\",\n           event.\"userEmail\",\n           event.\"bookId\",\n           event.\"sourceType\",\n           event.\"sourceId\",\n           book.title AS \"bookTitle\"\n         FROM \"ResearchEvent\" event\n         LEFT JOIN \"Book\" book ON book.id = event.\"bookId\"\n         ORDER BY event.\"occurredAt\" DESC, event.id DESC\n         LIMIT 20"),
                        ])];
                case 4:
                    _g = _h.sent(), summaryResult = _g[0], pathResult = _g[1], rankingResult = _g[2], recentLogsResult = _g[3];
                    summary = (_e = summaryResult.rows[0]) !== null && _e !== void 0 ? _e : {};
                    paths = (_f = pathResult.rows[0]) !== null && _f !== void 0 ? _f : {};
                    return [2 /*return*/, server_1.NextResponse.json({
                            summary: {
                                postViewCount: toNumber(summary.postViewCount),
                                bookDetailViewCount: toNumber(summary.bookDetailViewCount),
                                loanCount: toNumber(summary.loanCount),
                                uniqueUserCount: toNumber(summary.uniqueUserCount)
                            },
                            paths: {
                                postToBookDetailCount: toNumber(paths.postToBookDetailCount),
                                postToLoanCount: toNumber(paths.postToLoanCount),
                                threadLinkClickCount: toNumber(paths.threadLinkClickCount),
                                bookDetailToLoanCount: toNumber(paths.bookDetailToLoanCount),
                                avgPostToBookDetailSeconds: toNullableNumber(paths.avgPostToBookDetailSeconds),
                                avgBookDetailToLoanSeconds: toNullableNumber(paths.avgBookDetailToLoanSeconds)
                            },
                            ranking: rankingResult.rows.map(function (row) { return ({
                                bookId: row.bookId,
                                title: row.title,
                                viewCount: toNumber(row.viewCount)
                            }); }),
                            recentLogs: recentLogsResult.rows
                        }, { status: 200 })];
                case 5:
                    error_1 = _h.sent();
                    console.error("イベントダッシュボードの取得に失敗:", error_1);
                    return [2 /*return*/, server_1.NextResponse.json({ error: "イベントダッシュボードの取得に失敗しました" }, { status: 500 })];
                case 6: return [2 /*return*/];
            }
        });
    });
}
exports.GET = GET;

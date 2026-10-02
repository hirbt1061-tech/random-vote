const SHEETNAMEPOLLS = "Polls";

const SHEETNAMEVOTES = "Votes";

/*

首次部署前：

1. 新建一个 Google Sheet。
2. 扩展程序 → Apps Script。
3. 把本文件全部粘进去。
4. 修改 ADMIN_KEY 为你自己的长随机字符串。
5. 运行 setup() 一次，授权。
6. 部署 → 新部署 → 类型选择"Web 应用"。

执行身份：我

谁可以访问：任何人

1. 复制 /exec URL，填进前端页面。

*/

const ADMIN_KEY = "请在这里改成你自己的管理员密钥";

function setup() {

const ss = SpreadsheetApp.getActiveSpreadsheet();

if (!ss.getSheetByName(SHEETNAMEPOLLS)) {

const s = ss.insertSheet(SHEETNAMEPOLLS);

// 加上 type / minChoices / maxChoices 三列

s.appendRow([

"pollId", "title", "optionsJson", "type",

"minChoices", "maxChoices", "createdAt", "active"

]);

}

if (!ss.getSheetByName(SHEETNAMEVOTES)) {

const s = ss.insertSheet(SHEETNAMEVOTES);

// 一行 = 一个人的一次投票（多选会有多行，用 voteGroup 归组）

s.appendRow(["timestamp", "pollId", "optionIndex", "voteGroup"]);

}

}

function doGet(e) {

try {

const action = e.parameter.action;

if (action === "getPoll") {

return json(getPoll(e.parameter.pollId));

}

return json_({ ok: true, message: "Vote API is running" });

} catch (err) {

return json_({ ok: false, error: String(err.message || err) });

}

}

function doPost(e) {

try {

const body = JSON.parse(e.postData.contents || "{}");

if (body.action === "createPoll") return json(createPoll(body));

if (body.action === "vote") return json(vote(body));

return json_({ ok: false, error: "未知操作" });

} catch (err) {

return json_({ ok: false, error: String(err.message || err) });

}

}

function createPoll_(b) {

checkAdmin_(b.adminKey);

const title = String(b.title || "").trim();

const options = Array.isArray(b.options)

? b.options.map(x => String(x).trim()).filter(Boolean)

: [];

if (!title) throw new Error("标题不能为空");

if (options.length < 2) throw new Error("至少需要两个选项");

let type = b.type === "multiple" ? "multiple" : "single";

let minChoices = 1;

let maxChoices = 1;

if (type === "multiple") {

minChoices = Math.max(1, Number(b.minChoices) || 1);

maxChoices = Math.max(0, Number(b.maxChoices) || 0);

if (maxChoices > 0 && maxChoices < minChoices) {

throw new Error("最多选择数量不能小于最少选择数量");

}

}

const id = Utilities.getUuid().replace(/-/g, "").slice(0, 12);

const sheet = SpreadsheetApp.getActive().getSheetByName(SHEETNAMEPOLLS);

sheet.appendRow([

id,

title,

JSON.stringify(options),

type,

minChoices,

maxChoices,

new Date(),

true

]);

return { ok: true, pollId: id };

}

function getPoll_(pollId) {

if (!pollId) throw new Error("缺少 pollId");

const ss = SpreadsheetApp.getActive();

const ps = ss.getSheetByName(SHEETNAMEPOLLS);

const vs = ss.getSheetByName(SHEETNAMEVOTES);

const rows = ps.getDataRange().getValues();

let poll = null;

for (let i = 1; i < rows.length; i++) {

if (String(rows[i][0]) === String(pollId)) {

poll = {

id: String(rows[i][0]),

title: String(rows[i][1]),

options: JSON.parse(rows[i][2]),

type: rows[i][3] === "multiple" ? "multiple" : "single",

minChoices: Number(rows[i][4]) || 1,

maxChoices: Number(rows[i][5]) || 0,

active: Boolean(rows[i][7])

};

break;

}

}

if (!poll) throw new Error("投票不存在");

const counts = poll.options.map((o, i) => ({ option: o, count: 0, index: i }));

// 用 voteGroup 去重：同一次提交里同一选项只算一次

const voteRows = vs.getDataRange().getValues();

const seen = {}; // key: pollId + "|" + voteGroup + "|" + optionIndex

for (let i = 1; i < voteRows.length; i++) {

if (String(voteRows[i][1]) === String(pollId)) {

const idx = Number(voteRows[i][2]);

const group = String(voteRows[i][3] || "");

const key = pollId + "|" + group + "|" + idx;

if (seen[key]) continue;

seen[key] = true;

if (counts[idx]) counts[idx].count++;

}

}

const total = Object.keys(seen).length

? countUniqueVoters_(vs, pollId)

: 0;

return {

ok: true,

poll: {

id: poll.id,

title: poll.title,

options: poll.options,

type: poll.type,

minChoices: poll.minChoices,

maxChoices: poll.maxChoices,

total: total

},

results: counts.map(x => ({

option: x.option,

count: x.count,

index: x.index

}))

};

}

// 统计"有多少人投过票"（按 voteGroup 去重）

function countUniqueVoters_(vs, pollId) {

const voteRows = vs.getDataRange().getValues();

const groups = new Set();

for (let i = 1; i < voteRows.length; i++) {

if (String(voteRows[i][1]) === String(pollId)) {

groups.add(String(voteRows[i][3] || ""));

}

}

return groups.size;

}

function vote_(b) {

const pollId = String(b.pollId || "");

if (!pollId) throw new Error("投票参数错误");

// 兼容单选旧格式 optionIndex 和多选新格式 selectedOptions

let selected = [];

if (Array.isArray(b.selectedOptions)) {

selected = b.selectedOptions.map(Number).filter(n => Number.isInteger(n));

} else if (Number.isInteger(Number(b.optionIndex))) {

selected = [Number(b.optionIndex)];

}

if (selected.length === 0) throw new Error("请至少选择一个选项");

// 校验选项存在 + 数量限制

const data = getPoll_(pollId);

const maxIdx = data.poll.options.length - 1;

for (const i of selected) {

if (i < 0 || i > maxIdx) throw new Error("选项不存在");

}

if (data.poll.type === "single" && selected.length !== 1) {

throw new Error("这是单选投票，只能选一个");

}

if (data.poll.type === "multiple") {

if (selected.length < data.poll.minChoices) {

throw new Error("至少选择 " + data.poll.minChoices + " 个");

}

if (data.poll.maxChoices > 0 && selected.length > data.poll.maxChoices) {

throw new Error("最多选择 " + data.poll.maxChoices + " 个");

}

}

const lock = LockService.getScriptLock();

lock.waitLock(5000);

try {

const sheet = SpreadsheetApp.getActive().getSheetByName(SHEETNAMEVOTES);

const voteGroup = Utilities.getUuid().replace(/-/g, "").slice(0, 12);

const now = new Date();

selected.forEach(idx => {

sheet.appendRow([now, pollId, idx, voteGroup]);

});

} finally {

lock.releaseLock();

}

return { ok: true };

}

function checkAdmin_(key) {

if (!key || key !== ADMIN_KEY) throw new Error("管理员密钥错误");

}

function json_(obj) {

return ContentService

.createTextOutput(JSON.stringify(obj))

.setMimeType(ContentService.MimeType.JSON);

}

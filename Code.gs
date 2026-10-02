const SHEET_NAME_POLLS = "Polls";
const SHEET_NAME_VOTES = "Votes";

/*
首次部署前：
1. 新建一个 Google Sheet。
2. 扩展程序 → Apps Script。
3. 把本文件全部粘进去。
4. 修改 ADMIN_KEY 为你自己的长随机字符串。
5. 运行 setup() 一次，授权。
6. 部署 → 新部署 → 类型选择“Web 应用”。
   执行身份：我
   谁可以访问：任何人
7. 复制 /exec URL，填进前端页面。
*/

const ADMIN_KEY = "请在这里改成你自己的管理员密钥";

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_NAME_POLLS)) {
    const s = ss.insertSheet(SHEET_NAME_POLLS);
    s.appendRow(["pollId","title","optionsJson","createdAt","active"]);
  }
  if (!ss.getSheetByName(SHEET_NAME_VOTES)) {
    const s = ss.insertSheet(SHEET_NAME_VOTES);
    s.appendRow(["timestamp","pollId","optionIndex"]);
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === "getPoll") {
      return json_(getPoll_(e.parameter.pollId));
    }
    return json_({ok:true,message:"Vote API is running"});
  } catch (err) {
    return json_({ok:false,error:String(err.message || err)});
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    if (body.action === "createPoll") return json_(createPoll_(body));
    if (body.action === "vote") return json_(vote_(body));
    return json_({ok:false,error:"未知操作"});
  } catch (err) {
    return json_({ok:false,error:String(err.message || err)});
  }
}

function createPoll_(b) {
  checkAdmin_(b.adminKey);
  const title = String(b.title || "").trim();
  const options = Array.isArray(b.options) ? b.options.map(x=>String(x).trim()).filter(Boolean) : [];
  if (!title) throw new Error("标题不能为空");
  if (options.length < 2) throw new Error("至少需要两个选项");

  const id = Utilities.getUuid().replace(/-/g,"").slice(0,12);
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME_POLLS);
  sheet.appendRow([id,title,JSON.stringify(options),new Date(),true]);
  return {ok:true,pollId:id};
}

function getPoll_(pollId) {
  if (!pollId) throw new Error("缺少 pollId");
  const ss = SpreadsheetApp.getActive();
  const ps = ss.getSheetByName(SHEET_NAME_POLLS);
  const vs = ss.getSheetByName(SHEET_NAME_VOTES);
  const rows = ps.getDataRange().getValues();
  let poll = null;

  for (let i=1;i<rows.length;i++) {
    if (String(rows[i][0]) === String(pollId)) {
      poll = {
        id:String(rows[i][0]),
        title:String(rows[i][1]),
        options:JSON.parse(rows[i][2]),
        active:Boolean(rows[i][4])
      };
      break;
    }
  }
  if (!poll) throw new Error("投票不存在");

  const counts = poll.options.map((o,i)=>({option:o,count:0,index:i}));
  const voteRows = vs.getDataRange().getValues();
  for (let i=1;i<voteRows.length;i++) {
    if (String(voteRows[i][1]) === String(pollId)) {
      const idx = Number(voteRows[i][2]);
      if (counts[idx]) counts[idx].count++;
    }
  }
  return {
    ok:true,
    poll:{id:poll.id,title:poll.title,options:poll.options,total:counts.reduce((a,x)=>a+x.count,0)},
    results:counts.map(x=>({option:x.option,count:x.count,index:x.index}))
  };
}

function vote_(b) {
  const pollId = String(b.pollId || "");
  const optionIndex = Number(b.optionIndex);
  if (!pollId || !Number.isInteger(optionIndex)) throw new Error("投票参数错误");

  // 这里只验证选项是否存在。匿名模式下无法可靠阻止同一真人多次投票。
  const data = getPoll_(pollId);
  if (optionIndex < 0 || optionIndex >= data.poll.options.length) {
    throw new Error("选项不存在");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    SpreadsheetApp.getActive().getSheetByName(SHEET_NAME_VOTES)
      .appendRow([new Date(),pollId,optionIndex]);
  } finally {
    lock.releaseLock();
  }
  return {ok:true};
}

function checkAdmin_(key) {
  if (!key || key !== ADMIN_KEY) throw new Error("管理员密钥错误");
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

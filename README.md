# 免费长期投票页

这个项目由：
- GitHub Pages：放静态前端
- Google Sheets：保存投票与票数
- Google Apps Script：提供免费 API

## 1. 建 Google Sheet
新建一个空白 Google Sheet。

## 2. 设置后端
打开“扩展程序 → Apps Script”，把 `Code.gs` 的内容全部复制进去。

把：
ADMIN_KEY = "请在这里改成你自己的管理员密钥";
改成你自己的长随机字符串。

运行 `setup()` 一次并完成 Google 授权。

然后：
“部署 → 新部署 → Web 应用”
- 执行身份：我
- 谁可以访问：任何人

复制 `/exec` 结尾的 Web App URL。

## 3. 发布前端
把 `index.html` 上传到 GitHub 仓库。
仓库 Settings → Pages → Deploy from branch → main / root。

得到类似：
https://你的用户名.github.io/仓库名/

打开这个地址，就能直接创建投票。

## 4. 创建投票
填写：
- Apps Script Web App URL
- 管理员密钥
- 投票标题
- 两个或更多选项

点击“创建投票”，页面会生成一个类似：
https://你的用户名.github.io/仓库名/?poll=abc123456789

把这个链接发给别人即可。

## 5. 统计
任何人打开投票链接都能看到当前结果。
投票后会显示：
- 每个选项票数
- 每个选项百分比
- 总票数

投票没有截止日期，因此会一直存在，除非你删除/修改 Google Sheet 或 Apps Script。

## 注意
这个版本是“匿名、低门槛投票”，不是严格防刷票系统。
前端用 localStorage 防止同一浏览器重复投票，但用户清空浏览器数据、更换设备或使用其他浏览器后仍可能再次投票。

如果你需要“一人一票”的严格限制，需要登录、验证码或其他身份验证服务，那就不是纯静态 + 免费 Sheets 这么简单了。

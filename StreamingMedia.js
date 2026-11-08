/*
 * Surge streaming and AI region probe panel.
 * Uses small public web/API probes; no account credentials are requested.
 */
var startedAt = Date.now();
var groups = [];
var results = [];
var finished = 0;
var country = "";
var countryReady = false;
var policyGroupName = readArgument("group") || "Proxy";
var policyName = "";
var policyNotice = "";

function readArgument(key) {
  var arg = typeof $argument === "string" ? $argument : "";
  var match = arg.match(new RegExp("(?:^|&)" + key + "=([^&]*)"));
  if (!match) return "";
  try { return decodeURIComponent(match[1]); } catch (_) { return match[1]; }
}

function getSelectedPolicy() {
  try {
    var detail = $surge.selectGroupDetails();
    var decisions = detail && detail.decisions ? detail.decisions : {};
    if (decisions[policyGroupName]) {
      policyName = decisions[policyGroupName];
      return;
    }
    policyNotice = "策略组“" + policyGroupName + "”未找到，检测请求按 Surge 当前规则路由";
  } catch (e) {
    policyNotice = "无法读取策略组，检测请求按 Surge 当前规则路由";
  }
}

function request(method, url, body, callback) {
  var options = {
    url: url,
    timeout: 8,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8"
    },
    "auto-cookie": true
  };
  if (policyName) options.policy = policyName;
  if (body !== null && body !== undefined) {
    options.body = body;
    options.headers["Content-Type"] = "application/json";
  }
  try {
    $httpClient[method](options, function (error, response, data) {
      callback(error, response || {}, data || "");
    });
  } catch (e) {
    callback(String(e), {}, "");
  }
}

function addResult(name, category, status, detail) {
  results.push({ name: name, category: category, status: status, detail: detail || "" });
  finished++;
  if (finished === 16 && countryReady) render();
}

function classifyWeb(name, url, category) {
  request("head", url, null, function (error, response) {
    var code = Number(response.status || 0);
    if (code === 405 || code === 501) {
      request("get", url, null, function (fallbackError, fallbackResponse, data) {
        classifyResult(name, category, fallbackError, fallbackResponse, data);
      });
      return;
    }
    classifyResult(name, category, error, response, "");
  });
}

function classifyResult(name, category, error, response, data) {
  var code = Number(response.status || 0);
  var body = String(data || "");
  if (error || code === 0 || code >= 500) {
    addResult(name, category, "unknown", "连接失败");
  } else if (code === 403 || code === 451 || /not available in your (country|region)|unavailable in your (country|region)|geo.?block|forbidden-location/i.test(body)) {
    addResult(name, category, "blocked", "地区限制或 IP 被拦截");
  } else if ((code >= 200 && code < 400) || code === 401 || code === 405) {
    addResult(name, category, "ok", "入口可达");
  } else {
    addResult(name, category, "unknown", "HTTP " + code);
  }
}

function jsonField(body, field) {
  var value = String(body || "");
  try {
    var parsed = JSON.parse(value);
    if (parsed && parsed[field] !== undefined) return parsed[field];
  } catch (_) {}
  var escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var match = value.match(new RegExp('"' + escaped + '"\\s*:\\s*"?([^",}]+)'));
  return match ? match[1].replace(/^"|"$/g, "") : "";
}

function checkNetflix() {
  request("get", "https://www.netflix.com/title/81280792", null, function (error, response, data) {
    var code = Number(response.status || 0);
    if (error || !code) return addResult("Netflix", "media", "unknown", "连接失败");
    if (/Oh no!|not available in your (country|region)|unavailable in your (country|region)/i.test(data)) {
      return addResult("Netflix", "media", "blocked", "该测试片目不可用");
    }
    if (code === 403 || code === 451 || code === 404) return addResult("Netflix", "media", "blocked", "片库受限或 IP 被拦截");
    if (code >= 200 && code < 400 && String(data).length > 0) return addResult("Netflix", "media", "ok", "测试片目可访问");
    addResult("Netflix", "media", "unknown", "HTTP " + code);
  });
}

function checkDisney() {
  var payload = JSON.stringify({ deviceFamily: "browser", applicationRuntime: "chrome", deviceProfile: "windows", attributes: {} });
  var optionsBody = payload;
  var url = "https://disney.api.edge.bamgrid.com/devices";
  var headers = {
    "authorization": "Bearer ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84",
    "content-type": "application/json; charset=UTF-8",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36"
  };
  var opts = { url: url, timeout: 8, headers: headers, body: optionsBody, "auto-cookie": true };
  if (policyName) opts.policy = policyName;
  $httpClient.post(opts, function (error, response, data) {
    var code = Number((response || {}).status || 0);
    if (error || !code) return addResult("Disney+", "media", "unknown", "连接失败");
    if (code === 403 || code === 451 || /forbidden-location|geo.?block/i.test(String(data || ""))) {
      return addResult("Disney+", "media", "blocked", "地区限制或 IP 被拦截");
    }
    if (code >= 200 && code < 300 && /"assertion"\s*:/.test(String(data || ""))) {
      return addResult("Disney+", "media", "ok", "设备区域接口可用");
    }
    addResult("Disney+", "media", "unknown", "接口响应格式变化（HTTP " + code + "）");
  });
}

function checkYouTube() {
  request("get", "https://www.youtube.com/premium", null, function (error, response, data) {
    var code = Number(response.status || 0);
    var body = String(data || "");
    if (error || !code || code >= 500) return addResult("YouTube", "media", "unknown", "连接失败");
    if (code === 403 || code === 451 || /Premium is not available in your country|not available in your country/i.test(body)) {
      return addResult("YouTube", "media", "blocked", "Premium 地区不可用");
    }
    if (code >= 200 && code < 400 && /premium|countryCode|INNERTUBE_CONTEXT/i.test(body)) {
      return addResult("YouTube", "media", "ok", "Premium 页面可访问");
    }
    addResult("YouTube", "media", "unknown", "HTTP " + code);
  });
}

function checkBilibili() {
  var session = String(Date.now()) + String(Math.floor(Math.random() * 1000000));
  var url = "https://api.bilibili.com/pgc/player/web/playurl?avid=18281381&cid=29892777&qn=0&type=&otype=json&ep_id=183799&fourk=1&fnver=0&fnval=16&session=" + session + "&module=bangumi";
  request("get", url, null, function (error, response, data) {
    var code = Number(response.status || 0);
    var resultCode = String(jsonField(data, "code"));
    if (error || !code || code >= 500) return addResult("B站港澳台", "media", "unknown", "播放接口连接失败");
    if (resultCode === "0") return addResult("B站港澳台", "media", "ok", "番剧播放接口可用");
    if (resultCode === "-10403") return addResult("B站港澳台", "media", "blocked", "当前地区无权播放");
    addResult("B站港澳台", "media", "unknown", "接口返回 " + (resultCode || ("HTTP " + code)));
  });
}

function checkAbema() {
  request("get", "https://api.abema.io/v1/ip/check?device=android", null, function (error, response, data) {
    var region = String(jsonField(data, "isoCountryCode") || "").toUpperCase();
    if (error || !response.status) return addResult("Abema", "media", "unknown", "区域接口连接失败");
    if (region === "JP") return addResult("Abema", "media", "ok", "日本区域（JP）");
    if (region) return addResult("Abema", "media", "blocked", "检测区域 " + region + "，仅支持日本");
    addResult("Abema", "media", "unknown", "无法读取区域");
  });
}

function checkBahamut() {
  request("get", "https://ani.gamer.com.tw/ajax/getdeviceid.php", null, function (error, response, data) {
    var device = String(jsonField(data, "deviceid") || "");
    if (error || !device) return addResult("巴哈动画疯", "media", "unknown", "设备接口无有效响应");
    var url = "https://ani.gamer.com.tw/ajax/token.php?adID=89422&sn=37783&device=" + encodeURIComponent(device);
    request("get", url, null, function (tokenError, tokenResponse, tokenData) {
      if (tokenError || !tokenResponse.status) return addResult("巴哈动画疯", "media", "unknown", "播放令牌接口失败");
      if (!/animeSn/.test(String(tokenData || ""))) return addResult("巴哈动画疯", "media", "blocked", "测试番剧无法取得播放令牌");
      request("get", "https://ani.gamer.com.tw/", null, function (homeError, homeResponse, homeData) {
        var geo = String(homeData || "").match(/data-geo="([^"]+)"/i);
        if (homeError || !homeResponse.status) return addResult("巴哈动画疯", "media", "unknown", "主页区域信息读取失败");
        if (geo) return addResult("巴哈动画疯", "media", "ok", "区域 " + geo[1]);
        addResult("巴哈动画疯", "media", "unknown", "未能读取地区标记");
      });
    });
  });
}

function checkCountry() {
  request("get", "https://api.country.is/", null, function (error, response, data) {
    if (!error && response.status >= 200 && response.status < 300) {
      country = String(jsonField(data, "country") || "").toUpperCase();
    }
    countryReady = true;
    if (finished === 16) render();
  });
}

function flag(code) {
  var flags = {
    US: "🇺🇸", HK: "🇭🇰", MO: "🇲🇴", TW: "🇹🇼", JP: "🇯🇵", SG: "🇸🇬", KR: "🇰🇷",
    GB: "🇬🇧", CA: "🇨🇦", AU: "🇦🇺", NZ: "🇳🇿", FR: "🇫🇷", DE: "🇩🇪", NL: "🇳🇱",
    IN: "🇮🇳", BR: "🇧🇷", TH: "🇹🇭", MY: "🇲🇾", ID: "🇮🇩", PH: "🇵🇭", CN: "🇨🇳"
  };
  return flags[code] || (code ? "🌐" : "🏳️");
}

function icon(status) {
  if (status === "ok") return "✅";
  if (status === "blocked") return "❌";
  return "⚠️";
}

function render() {
  if (render.done) return;
  render.done = true;
  var media = results.filter(function (item) { return item.category === "media"; });
  var ai = results.filter(function (item) { return item.category === "ai"; });
  var ok = results.filter(function (item) { return item.status === "ok"; }).length;
  var blocked = results.filter(function (item) { return item.status === "blocked"; }).length;
  var unknown = results.length - ok - blocked;
  var elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  var route = policyName ? policyGroupName + " → " + policyName : "按 Surge 当前规则";
  var region = country ? flag(country) + " " + country : "🌐 未识别";
  var lines = [
    "🔓 节点选择  " + route,
    "🌍 出口区域  " + region,
    "📊 可用 " + ok + "/" + results.length + " · 受限 " + blocked + " · 未确认 " + unknown,
    "",
    "📺 流媒体平台"
  ];
  media.forEach(function (item) {
    lines.push(icon(item.status) + " " + item.name + "  " + (item.detail || "") + "  " + (country ? flag(country) : "🌐"));
  });
  lines.push("", "🤖 AI 平台");
  ai.forEach(function (item) {
    lines.push(icon(item.status) + " " + item.name + "  " + (item.detail || "") + "  " + (country ? flag(country) : "🌐"));
  });
  lines.push("", "🕒 检测时间  " + new Date().toLocaleTimeString() + "（约 " + elapsed + " 秒）");
  if (policyNotice) lines.push("ℹ️ " + policyNotice);
  lines.push("⚠️ 网页/API 探测不代表账号订阅或实际播放一定可用");
  $done({
    title: "流媒体检测 · " + ok + "/" + results.length + " 可用",
    content: lines.join("\n"),
    icon: ok >= results.length - 2 ? "play.rectangle.fill" : "play.rectangle",
    "icon-color": ok >= results.length - 2 ? "#34C759" : "#FF9F0A"
  });
}

getSelectedPolicy();
checkCountry();
checkNetflix();
checkDisney();
checkYouTube();
checkBilibili();
checkAbema();
checkBahamut();

var webChecks = [
  ["Prime Video", "https://www.primevideo.com/", "media"],
  ["Spotify", "https://www.spotify.com/", "media"],
  ["Max", "https://www.max.com/", "media"],
  ["Hulu", "https://www.hulu.com/welcome", "media"],
  ["Paramount+", "https://www.paramountplus.com/", "media"],
  ["Viu", "https://www.viu.com/ott/hk/", "media"],
  ["Peacock", "https://www.peacocktv.com/", "media"],
  ["ChatGPT", "https://chatgpt.com/", "ai"],
  ["Claude", "https://claude.ai/", "ai"],
  ["Gemini", "https://gemini.google.com/app", "ai"]
];
webChecks.forEach(function (item) { classifyWeb(item[0], item[1], item[2]); });

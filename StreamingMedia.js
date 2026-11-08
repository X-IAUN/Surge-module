
/*
 * Surge streaming and AI availability panel.
 * Based on Surge's callback HTTP API; no account credentials are requested.
 */
var startedAt = Date.now();
var results = [];
var completed = 0;
var country = "";
var countryReady = false;
var isDone = false;
var policyGroupName = getArgument("group") || "Proxy";
var policyName = "";
var policyNotice = "";

function getArgument(key) {
  var arg = typeof $argument === "string" ? $argument : "";
  var match = arg.match(new RegExp("(?:^|&)" + key + "=([^&]*)"));
  if (!match) return "";
  try { return decodeURIComponent(match[1]); } catch (e) { return match[1]; }
}

function selectPolicy() {
  try {
    var info = $surge.selectGroupDetails();
    var decisions = info && info.decisions ? info.decisions : {};
    if (decisions[policyGroupName]) {
      policyName = decisions[policyGroupName];
    } else {
      policyNotice = "策略组“" + policyGroupName + "”未找到，检测按当前规则路由";
    }
  } catch (e) {
    policyNotice = "无法读取策略组，检测按当前规则路由";
  }
}

function request(method, url, extra) {
  return new Promise(function (resolve, reject) {
    var options = {
      url: url,
      timeout: 8,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      },
      "auto-cookie": true
    };
    if (policyName) options.policy = policyName;
    if (extra) {
      if (extra.headers) {
        for (var key in extra.headers) options.headers[key] = extra.headers[key];
      }
      if (extra.body !== undefined) options.body = extra.body;
    }
    var callback = function (error, response, data) {
      if (error !== null && error !== undefined) {
        reject(error);
        return;
      }
      resolve({ response: response || {}, data: data || "" });
    };
    try {
      if (method === "get") $httpClient.get(options, callback);
      else if (method === "head") $httpClient.head(options, callback);
      else if (method === "post") $httpClient.post(options, callback);
      else reject("Unsupported HTTP method: " + method);
    } catch (e) {
      reject(e);
    }
  });
}

function jsonField(body, field) {
  try {
    var obj = JSON.parse(String(body || ""));
    if (obj && obj[field] !== undefined && obj[field] !== null) return obj[field];
  } catch (e) {}
  var re = new RegExp('"' + field + '"\\s*:\\s*"?([^",}]+)');
  var match = String(body || "").match(re);
  return match ? match[1].replace(/^"|"$/g, "") : "";
}

function result(name, category, status, detail) {
  return { name: name, category: category, status: status, detail: detail || "" };
}

function checkNetflixTitle(id) {
  return request("get", "https://www.netflix.com/title/" + id, {
    headers: { "Accept-Language": "en-US,en;q=0.9" }
  });
}

function checkNetflix() {
  return checkNetflixTitle("81280792").then(function (first) {
    var code = Number(first.response.status || 0);
    var body = String(first.data || "");
    var region = "";
    var originating = first.response.headers && first.response.headers["x-originating-url"];
    if (originating) {
      var parts = String(originating).split("/");
      region = (parts[3] || "").split("-")[0];
      if (region === "title") region = "US";
    }
    if (code === 200 && !/Oh no!|not available in your (country|region)/i.test(body)) {
      return result("Netflix", "media", "ok", "测试片目可访问" + (region ? " · " + region.toUpperCase() : ""));
    }
    if (code === 403 || code === 451) return result("Netflix", "media", "blocked", "地区限制或 IP 被拦截");
    if (code === 404) {
      return checkNetflixTitle("80018499").then(function (second) {
        var secondCode = Number(second.response.status || 0);
        if (secondCode === 200 && !/Oh no!|not available in your (country|region)/i.test(String(second.data || ""))) {
          return result("Netflix", "media", "ok", "可访问（片库可能不完整）");
        }
        if (secondCode === 403 || secondCode === 404 || secondCode === 451) {
          return result("Netflix", "media", "blocked", "当前片库受限");
        }
        return result("Netflix", "media", "unknown", "备用片目检测失败");
      });
    }
    return result("Netflix", "media", "unknown", "HTTP " + code);
  }).catch(function () {
    return result("Netflix", "media", "unknown", "请求失败");
  });
}

function checkDisney() {
  var body = JSON.stringify({
    query: "mutation registerDevice($input: RegisterDeviceInput!) { registerDevice(registerDevice: $input) { grant { grantType assertion } } }",
    variables: {
      input: {
        applicationRuntime: "chrome",
        attributes: {
          browserName: "chrome",
          browserVersion: "128.0.0",
          manufacturer: "apple",
          model: null,
          operatingSystem: "macintosh",
          operatingSystemVersion: "10.15.7",
          osDeviceIds: []
        },
        deviceFamily: "browser",
        deviceLanguage: "en",
        deviceProfile: "macosx"
      }
    }
  });
  return request("post", "https://disney.api.edge.bamgrid.com/graph/v1/device/graphql", {
    headers: {
      "Accept-Language": "en",
      "Authorization": "ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84",
      "Content-Type": "application/json"
    },
    body: body
  }).then(function (response) {
    var code = Number(response.response.status || 0);
    if (code === 403 || code === 451) return result("Disney+", "media", "blocked", "地区限制或 IP 被拦截");
    if (code !== 200) return result("Disney+", "media", "unknown", "HTTP " + code);
    var json = JSON.parse(String(response.data || "{}"));
    if (json.errors || !json.extensions || !json.extensions.sdk || !json.extensions.sdk.session) {
      return result("Disney+", "media", "unknown", "区域接口返回格式变化");
    }
    var session = json.extensions.sdk.session;
    var region = session.location && session.location.countryCode ? String(session.location.countryCode).toUpperCase() : "";
    if (session.inSupportedLocation === true || session.inSupportedLocation === "true") {
      return result("Disney+", "media", "ok", "已支持" + (region ? " · " + region : ""));
    }
    if (session.inSupportedLocation === false || session.inSupportedLocation === "false") {
      return result("Disney+", "media", "blocked", "当前地区暂不支持" + (region ? " · " + region : ""));
    }
    return result("Disney+", "media", "unknown", "无法读取地区状态");
  }).catch(function () {
    return result("Disney+", "media", "unknown", "区域接口请求失败");
  });
}

function checkYouTube() {
  return request("get", "https://www.youtube.com/premium", {
    headers: {
      "Accept-Language": "en",
      "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+700"
    }
  }).then(function (response) {
    var code = Number(response.response.status || 0);
    var body = String(response.data || "");
    if (code === 403 || code === 451 || body.indexOf("Premium is not available in your country") !== -1) {
      return result("YouTube", "media", "blocked", "Premium 当前地区不可用");
    }
    if (code !== 200) return result("YouTube", "media", "unknown", "HTTP " + code);
    var region = jsonField(body, "countryCode");
    if (!region) {
      var match = body.match(/"INNERTUBE_CONTEXT_GL"\\s*:\\s*"([A-Z]{2})"/);
      region = match ? match[1] : country;
    }
    return result("YouTube", "media", "ok", "Premium 页面可访问" + (region ? " · " + String(region).toUpperCase() : ""));
  }).catch(function () {
    return result("YouTube", "media", "unknown", "请求失败");
  });
}

function checkBilibili() {
  var session = String(Date.now()) + String(Math.floor(Math.random() * 1000000));
  var url = "https://api.bilibili.com/pgc/player/web/playurl?avid=18281381&cid=29892777&qn=0&type=&otype=json&ep_id=183799&fourk=1&fnver=0&fnval=16&session=" + session + "&module=bangumi";
  return request("get", url).then(function (response) {
    var code = Number(response.response.status || 0);
    var apiCode = String(jsonField(response.data, "code"));
    if (apiCode === "0") return result("B站港澳台", "media", "ok", "番剧播放接口可用");
    if (apiCode === "-10403") return result("B站港澳台", "media", "blocked", "当前地区无权播放");
    return result("B站港澳台", "media", "unknown", "接口返回 " + (apiCode || code));
  }).catch(function () {
    return result("B站港澳台", "media", "unknown", "播放接口请求失败");
  });
}

function checkAbema() {
  return request("get", "https://api.abema.io/v1/ip/check?device=android").then(function (response) {
    var region = String(jsonField(response.data, "isoCountryCode") || "").toUpperCase();
    if (region === "JP") return result("Abema", "media", "ok", "日本区域 · JP");
    if (region) return result("Abema", "media", "blocked", "检测区域 " + region + "，仅支持日本");
    return result("Abema", "media", "unknown", "无法读取区域");
  }).catch(function () {
    return result("Abema", "media", "unknown", "区域接口请求失败");
  });
}

function checkBahamut() {
  return request("get", "https://ani.gamer.com.tw/ajax/getdeviceid.php").then(function (response) {
    var device = String(jsonField(response.data, "deviceid") || "");
    if (!device) return result("巴哈动画疯", "media", "unknown", "设备接口无有效响应");
    var tokenUrl = "https://ani.gamer.com.tw/ajax/token.php?adID=89422&sn=37783&device=" + encodeURIComponent(device);
    return request("get", tokenUrl).then(function (tokenResponse) {
      if (!/animeSn/.test(String(tokenResponse.data || ""))) {
        return result("巴哈动画疯", "media", "blocked", "测试番剧无法取得播放令牌");
      }
      return request("get", "https://ani.gamer.com.tw/").then(function (homeResponse) {
        var geo = String(homeResponse.data || "").match(/data-geo="([^"]+)"/i);
        if (geo) return result("巴哈动画疯", "media", "ok", "区域 " + geo[1]);
        return result("巴哈动画疯", "media", "unknown", "未能读取地区标记");
      });
    });
  }).catch(function () {
    return result("巴哈动画疯", "media", "unknown", "检测请求失败");
  });
}

function checkCountry() {
  return request("get", "https://api.country.is/").then(function (response) {
    if (Number(response.response.status || 0) >= 200 && Number(response.response.status || 0) < 300) {
      country = String(jsonField(response.data, "country") || "").toUpperCase();
    }
  }).catch(function () {});
}

function checkWeb(name, url, category) {
  return request("head", url).then(function (response) {
    var code = Number(response.response.status || 0);
    if (code === 405 || code === 501) return request("get", url).then(function (fallback) {
      return classifyWebResult(name, category, fallback.response, fallback.data);
    });
    return classifyWebResult(name, category, response.response, response.data);
  }).catch(function () {
    return result(name, category, "unknown", "连接失败");
  });
}

function classifyWebResult(name, category, response, data) {
  var code = Number(response.status || 0);
  var body = String(data || "");
  if (code === 403 || code === 451 || /not available in your (country|region)|unavailable in your (country|region)|geo.?block|forbidden-location/i.test(body)) {
    return result(name, category, "blocked", "地区限制或 IP 被拦截");
  }
  if ((code >= 200 && code < 400) || code === 401) return result(name, category, "ok", "入口可达");
  return result(name, category, "unknown", "HTTP " + code);
}

function flag(code) {
  var flags = {
    US: "🇺🇸", HK: "🇭🇰", MO: "🇲🇴", TW: "🇹🇼", JP: "🇯🇵", SG: "🇸🇬", KR: "🇰🇷",
    GB: "🇬🇧", CA: "🇨🇦", AU: "🇦🇺", NZ: "🇳🇿", FR: "🇫🇷", DE: "🇩🇪", NL: "🇳🇱",
    IN: "🇮🇳", BR: "🇧🇷", TH: "🇹🇭", MY: "🇲🇾", ID: "🇮🇩", PH: "🇵🇭", CN: "🇨🇳"
  };
  return flags[code] || (code ? "🌐" : "🏳️");
}

function statusIcon(status) {
  if (status === "ok") return "✅";
  if (status === "blocked") return "❌";
  return "⚠️";
}

function render() {
  var ok = 0;
  var blocked = 0;
  var unknown = 0;
  var media = [];
  var ai = [];
  for (var i = 0; i < results.length; i++) {
    if (results[i].status === "ok") ok++;
    else if (results[i].status === "blocked") blocked++;
    else unknown++;
    if (results[i].category === "media") media.push(results[i]);
    else ai.push(results[i]);
  }
  var region = country ? flag(country) + " " + country : "🌐 未识别";
  var route = policyName ? policyGroupName + " → " + policyName : "按 Surge 当前规则";
  var lines = [
    "🔓 节点选择  " + route,
    "🌍 出口区域  " + region,
    "📊 可用 " + ok + "/" + results.length + " · 受限 " + blocked + " · 未确认 " + unknown,
    "",
    "📺 流媒体平台"
  ];
  function addRows(rows) {
    for (var n = 0; n < rows.length; n++) {
      lines.push(statusIcon(rows[n].status) + " " + rows[n].name + "  " + rows[n].detail + "  " + (country ? flag(country) : "🌐"));
    }
  }
  addRows(media);
  lines.push("", "🤖 AI 平台");
  addRows(ai);
  lines.push("", "🕒 检测时间  " + new Date().toLocaleTimeString() + "（约 " + Math.max(1, Math.round((Date.now() - startedAt) / 1000)) + " 秒）");
  if (policyNotice) lines.push("ℹ️ " + policyNotice);
  lines.push("⚠️ 网页/API 探测不代表账号订阅或实际播放一定可用");
  return {
    title: "流媒体检测 · " + ok + "/" + results.length + " 可用",
    content: lines.join("\n"),
    icon: "play.tv.fill",
    "icon-color": "#FF2D55"
  };
}

function finish() {
  if (isDone) return;
  isDone = true;
  $done(render());
}

function addCheck(check) {
  var index = results.length;
  results.push(result(check.name, check.category, "unknown", "检测中"));
  completed++;
  try {
    Promise.resolve(check.run()).then(function (value) {
      results[index] = value || result(check.name, check.category, "unknown", "无返回结果");
    }).catch(function () {
      results[index] = result(check.name, check.category, "unknown", "请求异常");
    }).then(function () {
      completed--;
      if (completed === 0 && countryReady) finish();
    });
  } catch (e) {
    results[index] = result(check.name, check.category, "unknown", "脚本异常");
    completed--;
    if (completed === 0 && countryReady) finish();
  }
}

selectPolicy();
var allChecks = [
  { name: "Netflix", category: "media", run: checkNetflix },
  { name: "Disney+", category: "media", run: checkDisney },
  { name: "YouTube", category: "media", run: checkYouTube },
  { name: "Prime Video", category: "media", run: function () { return checkWeb("Prime Video", "https://www.primevideo.com/", "media"); } },
  { name: "Spotify", category: "media", run: function () { return checkWeb("Spotify", "https://www.spotify.com/", "media"); } },
  { name: "Max", category: "media", run: function () { return checkWeb("Max", "https://www.max.com/", "media"); } },
  { name: "Hulu", category: "media", run: function () { return checkWeb("Hulu", "https://www.hulu.com/welcome", "media"); } },
  { name: "Paramount+", category: "media", run: function () { return checkWeb("Paramount+", "https://www.paramountplus.com/", "media"); } },
  { name: "Viu", category: "media", run: function () { return checkWeb("Viu", "https://www.viu.com/ott/hk/", "media"); } },
  { name: "B站港澳台", category: "media", run: checkBilibili },
  { name: "Peacock", category: "media", run: function () { return checkWeb("Peacock", "https://www.peacocktv.com/", "media"); } },
  { name: "Abema", category: "media", run: checkAbema },
  { name: "巴哈动画疯", category: "media", run: checkBahamut },
  { name: "ChatGPT", category: "ai", run: function () { return checkWeb("ChatGPT", "https://chatgpt.com/", "ai"); } },
  { name: "Claude", category: "ai", run: function () { return checkWeb("Claude", "https://claude.ai/", "ai"); } },
  { name: "Gemini", category: "ai", run: function () { return checkWeb("Gemini", "https://gemini.google.com/app", "ai"); } }
];

setTimeout(function () {
  for (var i = 0; i < results.length; i++) {
    if (results[i].detail === "检测中") results[i] = result(results[i].name, results[i].category, "unknown", "检测超时");
  }
  countryReady = true;
  finish();
}, 32000);

checkCountry().then(function () {
  countryReady = true;
  if (completed === 0) finish();
});
for (var i = 0; i < allChecks.length; i++) addCheck(allChecks[i]);

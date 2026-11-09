/*
 * IPPure - Surge IP 纯净度面板
 * 数据源：https://my.ippure.com/v1/info
 *
 * $argument：Proxy=<策略组或节点>&MarkIP=<true/false>
 */

var API_URL = "https://my.ippure.com/v1/info";
var args = parseScriptArgument(typeof $argument === "string" ? $argument : "");
var policy = args.policy;
var markIP = args.markIP;
var panelTitle = "IP 纯净度";

var request = {
  url: API_URL,
  headers: {
    Accept: "application/json",
    "User-Agent": "Surge IPPure Panel"
  },
  timeout: 8,
  "auto-cookie": false
};

request.policy = policy;

$httpClient.get(request, function (error, response, body) {
  if (error) {
    finishError("请求失败", String(error));
    return;
  }

  var status = Number(response && (response.status || response.statusCode));
  if (status < 200 || status >= 300) {
    finishError("接口异常", "HTTP " + (status || "未知"));
    return;
  }

  var data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    finishError("数据解析失败", "接口未返回有效 JSON");
    return;
  }

  var ip = text(data.ip);
  if (!ip) {
    finishError("未获取到 IP", "接口返回数据缺少 ip 字段");
    return;
  }

  var risk = extractRisk(data);
  var level = riskLevel(risk);
  var countryCode = text(data.countryCode).toUpperCase();
  var location = compactLocation(data, countryCode);
  var asn = data.asn !== undefined && data.asn !== null && data.asn !== ""
    ? "AS" + data.asn
    : "-";
  var residential = Boolean(data.isResidential);
  var networkType = residential ? "🏠 住宅 / 家宽" : "🏢 机房 / 商业";
  var ipVersion = ip.indexOf(":") >= 0 ? "IPv6" : "IPv4";
  var displayIP = markIP ? maskIP(ip) : ip;
  var score = Number.isFinite(risk) ? String(Math.round(risk)) : "--";

  var lines = [
    ipVersion + "  " + displayIP,
    "位置  " + (location || "-"),
    "ASN   " + asn,
    "类型  " + networkType,
    "风险等级  " + level.icon + " " + score
  ];

  $done({
    title: panelTitle,
    content: lines.join("\n"),
    style: level.style
  });
});

function finishError(message, detail) {
  var lines = [message, detail || "未知错误"];

  $done({
    title: panelTitle,
    content: lines.join("\n"),
    style: "error"
  });
}

function parseScriptArgument(input) {
  var marker = "&MarkIP=";
  var markerIndex = input.lastIndexOf(marker);
  var policyPart = markerIndex >= 0 ? input.slice(0, markerIndex) : input;
  var markIPPart = markerIndex >= 0 ? input.slice(markerIndex + marker.length) : "true";

  if (policyPart.indexOf("Proxy=") === 0) {
    policyPart = policyPart.slice(6);
  }

  return {
    policy: policyPart.trim() || "DIRECT",
    markIP: String(markIPPart || "true").toLowerCase() === "true"
  };
}

function extractRisk(source) {
  var candidates = [
    source.fraudScore,
    source.fraud_score,
    source.riskScore,
    source.risk_score,
    source.score,
    source.risk && source.risk.score,
    source.security && source.security.riskScore
  ];

  for (var i = 0; i < candidates.length; i += 1) {
    if (candidates[i] === undefined || candidates[i] === null || candidates[i] === "") {
      continue;
    }
    var parsed = Number(candidates[i]);
    if (Number.isFinite(parsed)) return parsed;
  }

  return NaN;
}

function riskLevel(risk) {
  if (!Number.isFinite(risk)) {
    return { icon: "⚪️", style: "info" };
  }
  if (risk >= 80) {
    return { icon: "🔴", style: "error" };
  }
  if (risk >= 70) {
    return { icon: "🟠", style: "error" };
  }
  if (risk >= 40) {
    return { icon: "🟡", style: "alert" };
  }
  return { icon: "🟢", style: "good" };
}

function compactLocation(source, countryCode) {
  var flag = flagEmoji(countryCode);
  var city = text(source.city || source.region || source.state);
  var country = text(source.country);
  var parts = [];

  if (flag) parts.push(flag);
  if (city) parts.push(city);
  if (country && country !== city) parts.push(country);
  if (!city && !country && countryCode) parts.push(countryCode);

  return parts.join(" · ");
}

function maskIP(ip) {
  if (ip.indexOf(".") >= 0) {
    var ipv4 = ip.split(".");
    if (ipv4.length === 4) return ipv4[0] + "." + ipv4[1] + ".••." + ipv4[3];
    return ip;
  }

  var ipv6 = ip.split(":");
  if (ipv6.length >= 4) {
    return ipv6.slice(0, 2).join(":") + ":••:" + ipv6.slice(-1)[0];
  }
  return ip;
}

function flagEmoji(code) {
  if (!code || code.length !== 2) return "";
  var upper = code.toUpperCase();
  return String.fromCodePoint(
    127397 + upper.charCodeAt(0),
    127397 + upper.charCodeAt(1)
  );
}

function text(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

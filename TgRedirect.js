const rawArgument = String($argument || "").trim();

// 读取 Surge 模块参数：客户端=Swiftgram
const client = rawArgument
  .replace(/^客户端=/i, "")
  .trim();

console.log("RAW ARGUMENT =", rawArgument);
console.log("CLIENT =", client);
console.log("URL =", $request.url);


// ==============================
// Telegram / Swiftgram
// ==============================

if (client === "Telegram") {
  // Telegram 官方客户端不需要重定向
  $done({});
  return;
}


if (client === "Swiftgram") {

  const match = $request.url.match(
    /^https?:\/\/(?:t\.me|telegram\.me)\/(.+)$/i
  );

  if (!match) {
    console.log("URL NOT MATCH");
    $done({});
    return;
  }

  const tail = match[1];

  // 去掉 QueryString
  const path = tail.split("?")[0];

  const parts = path
    .split("/")
    .filter(Boolean);

  if (!parts.length) {
    console.log("EMPTY PATH");
    $done({});
    return;
  }

  let location = "";

  // ==============================
  // t.me/+xxxxxxxx
  // ==============================

  if (parts[0].startsWith("+")) {

    location =
      "tg://resolve?domain=" +
      encodeURIComponent(parts[0]);

  }

  // ==============================
  // t.me/joinchat/xxxxxxxx
  // ==============================

  else if (
    parts[0] === "joinchat" &&
    parts[1]
  ) {

    location =
      "tg://resolve?domain=" +
      encodeURIComponent(
        "+" + parts[1]
      );

  }

  // ==============================
  // t.me/channel/123
  // ==============================

  else {

    location =
      "tg://resolve?domain=" +
      encodeURIComponent(parts[0]);

    // 帖子链接
    if (
      parts[1] &&
      /^\d+$/.test(parts[1])
    ) {

      location +=
        "&post=" +
        encodeURIComponent(parts[1]);

    }

  }


  console.log("REDIRECT =", location);


  // ==============================
  // 返回 302
  // ==============================

  $done({
    response: {
      status: 302,

      headers: {
        Location: location,
        "Cache-Control": "no-store"
      },

      body: ""
    }
  });

  return;
}


// ==============================
// 未知客户端
// ==============================

console.log(
  "UNKNOWN CLIENT =",
  client
);

$done({});

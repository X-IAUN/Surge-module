const SCHEME = {
  Telegram: "tg",
  Nagram: "tg",
  Swiftgram: "sg",
  Turrit: "turrit",
  iMe: "ime",
  Nicegram: "ng",
  Lingogram: "lingo"
};

function getQueryValue(query, key) {
  if (!query) return "";

  const match = query.match(
    new RegExp(
      "(?:^|&)" +
      key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      "=([^&]*)"
    )
  );

  return match
    ? decodeURIComponent(match[1])
    : "";
}

function createDeepLink(
  scheme,
  path,
  query
) {
  const parts = path
    .split("/")
    .filter(Boolean);

  if (!parts.length) {
    return "";
  }

  // t.me/+xxxxxx
  if (parts[0].startsWith("+")) {
    return (
      scheme +
      "://join?invite=" +
      encodeURIComponent(
        parts[0].substring(1)
      )
    );
  }

  // t.me/joinchat/xxxxxx
  if (
    parts[0] === "joinchat" &&
    parts[1]
  ) {
    return (
      scheme +
      "://join?invite=" +
      encodeURIComponent(parts[1])
    );
  }

  // t.me/addstickers/xxxx
  if (
    parts[0] === "addstickers" &&
    parts[1]
  ) {
    return (
      scheme +
      "://addstickers?set=" +
      encodeURIComponent(parts[1])
    );
  }

  // t.me/share/url
  if (
    parts[0] === "share" &&
    parts[1] === "url"
  ) {
    const url =
      getQueryValue(query, "url");

    const text =
      getQueryValue(query, "text");

    let result =
      scheme +
      "://msg_url?url=" +
      encodeURIComponent(url);

    if (text) {
      result +=
        "&text=" +
        encodeURIComponent(text);
    }

    return result;
  }

  // t.me/channel/123
  if (
    parts[1] &&
    /^\d+$/.test(parts[1])
  ) {
    return (
      scheme +
      "://resolve?domain=" +
      encodeURIComponent(parts[0]) +
      "&post=" +
      encodeURIComponent(parts[1])
    );
  }

  // t.me/channel
  return (
    scheme +
    "://resolve?domain=" +
    encodeURIComponent(parts[0])
  );
}


const url = $request.url;

console.log(
  "URL =",
  url
);

const argument =
  String($argument || "")
    .trim();

console.log(
  "ARGUMENT =",
  argument
);


// Surge 参数可能是：
// Swiftgram
// 或 CLIENT=Swiftgram

const client =
  argument
    .replace(
      /^CLIENT=/i,
      ""
    )
    .trim();

console.log(
  "CLIENT =",
  client
);


// Telegram 官方客户端
// 不需要跳转

if (client === "Telegram") {
  console.log(
    "Official Telegram"
  );

  $done({});
  return;
}


// 获取客户端 Scheme

const scheme =
  SCHEME[client];

if (!scheme) {
  console.log(
    "UNKNOWN CLIENT =",
    client
  );

  $done({});
  return;
}


// 匹配 t.me

const match =
  url.match(
    /^https?:\/\/(?:t\.me|telegram\.me)\/(.+)$/i
  );

if (!match) {
  console.log(
    "URL NOT MATCH"
  );

  $done({});
  return;
}


let tail =
  match[1];


// 处理 t.me/s/xxx

if (
  tail.startsWith("s/")
) {
  tail =
    tail.substring(2);
}


const questionIndex =
  tail.indexOf("?");

const path =
  questionIndex === -1
    ? tail
    : tail.substring(
        0,
        questionIndex
      );

const query =
  questionIndex === -1
    ? ""
    : tail.substring(
        questionIndex + 1
      );


const location =
  createDeepLink(
    scheme,
    path,
    query
  );


if (!location) {
  console.log(
    "EMPTY LOCATION"
  );

  $done({});
  return;
}


console.log(
  "CLIENT =",
  client
);

console.log(
  "SCHEME =",
  scheme
);

console.log(
  "LOCATION =",
  location
);


// 302 跳转

$done({
  response: {
    status: 302,

    headers: {
      Location: location,
      "Cache-Control":
        "no-store, no-cache"
    },

    body: ""
  }
});

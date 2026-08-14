const SCHEMES = {
  Telegram: "tg",
  Swiftgram: "sg",
  Turrit: "turrit",
  iMe: "ime",
  Nicegram: "ng",
  Lingogram: "lingo",
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

  return match ? decodeURIComponent(match[1]) : "";
}

function createDeepLink(scheme, path, query) {
  const parts = path.split("/").filter(Boolean);

  if (!parts.length) {
    return "";
  }

  // t.me/+xxxxxx
  if (parts[0].startsWith("+")) {
    return (
      scheme +
      "://join?invite=" +
      encodeURIComponent(parts[0].substring(1))
    );
  }

  // t.me/joinchat/xxxxxx
  if (parts[0] === "joinchat" && parts[1]) {
    return (
      scheme +
      "://join?invite=" +
      encodeURIComponent(parts[1])
    );
  }

  // t.me/addstickers/xxxxxx
  if (parts[0] === "addstickers" && parts[1]) {
    return (
      scheme +
      "://addstickers?set=" +
      encodeURIComponent(parts[1])
    );
  }

  // t.me/share/url?url=xxx&text=xxx
  if (parts[0] === "share" && parts[1] === "url") {
    const url = getQueryValue(query, "url");
    const text = getQueryValue(query, "text");

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

  // t.me/s/channel/123
  if (parts[0] === "s") {
    parts.shift();
  }

  if (!parts.length) {
    return "";
  }

  // t.me/channel/123
  if (parts[1] && /^\d+$/.test(parts[1])) {
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
const client = String($argument || "Telegram").trim();

const scheme = SCHEMES[client];

if (!url || !scheme) {
  $done({});
} else {
  const match = url.match(
    /^https?:\/\/t\.me\/(.+)$/i
  );

  if (!match) {
    $done({});
  } else {
    const tail = match[1];

    const questionIndex = tail.indexOf("?");

    const path =
      questionIndex === -1
        ? tail
        : tail.substring(0, questionIndex);

    const query =
      questionIndex === -1
        ? ""
        : tail.substring(questionIndex + 1);

    const location = createDeepLink(
      scheme,
      path,
      query
    );

    if (!location) {
      $done({});
    } else {
      $done({
        response: {
          status: 302,
          headers: {
            Location: location,
            "Cache-Control": "no-store",
          },
          body: "",
        },
      });
    }
  }
}

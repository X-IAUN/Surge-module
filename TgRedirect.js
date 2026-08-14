const SCHEMES = {
  Telegram: "tg",
  Nagram: "tg",
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

function createDeepLink(client, path, query) {
  const parts = path.split("/").filter(Boolean);

  if (!parts.length) return "";

  // Telegram
  if (client === "Telegram") {
    return "";
  }

  // Swiftgram
  // Swiftgram 使用 tg://sg/... 作为自己的 Deep Link
  if (client === "Swiftgram") {
    if (parts[0].startsWith("+")) {
      return (
        "tg://sg/join?invite=" +
        encodeURIComponent(parts[0].slice(1))
      );
    }

    if (parts[0] === "joinchat" && parts[1]) {
      return (
        "tg://sg/join?invite=" +
        encodeURIComponent(parts[1])
      );
    }

    if (parts[0] === "share" && parts[1] === "url") {
      const url = getQueryValue(query, "url");
      const text = getQueryValue(query, "text");

      let result =
        "tg://sg/msg_url?url=" +
        encodeURIComponent(url);

      if (text) {
        result +=
          "&text=" +
          encodeURIComponent(text);
      }

      return result;
    }

    if (parts[1] && /^\d+$/.test(parts[1])) {
      return (
        "tg://sg/resolve?domain=" +
        encodeURIComponent(parts[0]) +
        "&post=" +
        encodeURIComponent(parts[1])
      );
    }

    return (
      "tg://sg/resolve?domain=" +
      encodeURIComponent(parts[0])
    );
  }

  // 其他客户端
  const scheme = SCHEMES[client];

  if (!scheme) return "";

  if (parts[0].startsWith("+")) {
    return (
      scheme +
      "://join?invite=" +
      encodeURIComponent(parts[0].slice(1))
    );
  }

  if (parts[0] === "joinchat" && parts[1]) {
    return (
      scheme +
      "://join?invite=" +
      encodeURIComponent(parts[1])
    );
  }

  if (parts[0] === "addstickers" && parts[1]) {
    return (
      scheme +
      "://addstickers?set=" +
      encodeURIComponent(parts[1])
    );
  }

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

  if (parts[1] && /^\d+$/.test(parts[1])) {
    return (
      scheme +
      "://resolve?domain=" +
      encodeURIComponent(parts[0]) +
      "&post=" +
      encodeURIComponent(parts[1])
    );
  }

  return (
    scheme +
    "://resolve?domain=" +
    encodeURIComponent(parts[0])
  );
}

const url = $request.url;

if (!url) {
  $done({});
} else {
  const match = url.match(
    /^https?:\/\/(?:t\.me|telegram\.me)\/(.+)$/i
  );

  if (!match) {
    $done({});
  } else {
    const tail = match[1];

    const questionIndex = tail.indexOf("?");

    let path =
      questionIndex === -1
        ? tail
        : tail.substring(0, questionIndex);

    const query =
      questionIndex === -1
        ? ""
        : tail.substring(questionIndex + 1);

    if (path.startsWith("s/")) {
      path = path.substring(2);
    }

    const client = String(
      $argument || "Telegram"
    ).trim();

    // 官方 Telegram：直接放行
    if (client === "Telegram") {
      $done({});
    } else {
      const location = createDeepLink(
        client,
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
              "Cache-Control": "no-store"
            },
            body: ""
          }
        });
      }
    }
  }
}

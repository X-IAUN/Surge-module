const SCHEME = "tg";

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

function createDeepLink(path, query) {
  const parts = path.split("/").filter(Boolean);

  if (!parts.length) return "";

  if (parts[0].startsWith("+")) {
    return "tg://join?invite=" +
      encodeURIComponent(parts[0].substring(1));
  }

  if (parts[0] === "joinchat" && parts[1]) {
    return "tg://join?invite=" +
      encodeURIComponent(parts[1]);
  }

  if (parts[0] === "addstickers" && parts[1]) {
    return "tg://addstickers?set=" +
      encodeURIComponent(parts[1]);
  }

  if (parts[0] === "share" && parts[1] === "url") {
    const url = getQueryValue(query, "url");
    const text = getQueryValue(query, "text");

    let result =
      "tg://msg_url?url=" +
      encodeURIComponent(url);

    if (text) {
      result += "&text=" +
        encodeURIComponent(text);
    }

    return result;
  }

  if (parts[0] === "s") {
    parts.shift();
  }

  if (!parts.length) return "";

  if (parts[1] && /^\d+$/.test(parts[1])) {
    return "tg://resolve?domain=" +
      encodeURIComponent(parts[0]) +
      "&post=" +
      encodeURIComponent(parts[1]);
  }

  return "tg://resolve?domain=" +
    encodeURIComponent(parts[0]);
}

const url = $request.url;

if (!url) {
  $done({});
} else {
  const match = url.match(
    /^https?:\/\/t\.me\/(.+)$/i
  );

  if (!match) {
    $done({});
  } else {
    const tail = match[1];
    const index = tail.indexOf("?");

    const path =
      index === -1
        ? tail
        : tail.substring(0, index);

    const query =
      index === -1
        ? ""
        : tail.substring(index + 1);

    const location = createDeepLink(path, query);

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

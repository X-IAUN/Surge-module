const SCHEMES = {
  Telegram: "tg",
  Nagram: "nagram",
  Swiftgram: "sg",
  Turrit: "turrit",
  iMe: "ime",
  Nicegram: "ng",
  Lingogram: "lingo",
};

const client = String($argument || "Telegram").trim();
const scheme = SCHEMES[client];

if (!scheme) {
  $done({});
} else {
  const match = $request.url.match(/^https?:\/\/t\.me\/(.+)$/i);

  if (!match) {
    $done({});
  } else {
    const parts = match[1].split("?")[0].split("/").filter(Boolean);

    if (!parts.length) {
      $done({});
    } else {
      let location;

      // t.me/+xxxxxx
      if (parts[0].startsWith("+")) {
        location = `${scheme}://join?invite=${encodeURIComponent(parts[0].slice(1))}`;
      }

      // t.me/joinchat/xxxxxx
      else if (parts[0] === "joinchat" && parts[1]) {
        location = `${scheme}://join?invite=${encodeURIComponent(parts[1])}`;
      }

      // t.me/channel/123
      else if (parts[1] && /^\d+$/.test(parts[1])) {
        location =
          `${scheme}://resolve?domain=${encodeURIComponent(parts[0])}` +
          `&post=${encodeURIComponent(parts[1])}`;
      }

      // t.me/channel
      else {
        location =
          `${scheme}://resolve?domain=${encodeURIComponent(parts[0])}`;
      }

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

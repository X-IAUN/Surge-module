const rawArgument = String($argument || "").trim();

const client = rawArgument
  .replace(/^CLIENT=/i, "")
  .trim();

console.log("RAW ARGUMENT =", rawArgument);
console.log("CLIENT =", client);
console.log("URL =", $request.url);

if (client === "Swiftgram") {
  const match = $request.url.match(
    /^https?:\/\/(?:t\.me|telegram\.me)\/(.+)$/i
  );

  if (match) {
    const parts = match[1]
      .split("?")[0]
      .split("/")
      .filter(Boolean);

    if (parts.length) {
      let location;

      if (parts[0].startsWith("+")) {
        location =
          "tg://resolve?domain=" +
          encodeURIComponent(parts[0]);
      } else {
        location =
          "tg://resolve?domain=" +
          encodeURIComponent(parts[0]);

        if (parts[1] && /^\d+$/.test(parts[1])) {
          location +=
            "&post=" +
            encodeURIComponent(parts[1]);
        }
      }

      console.log("REDIRECT =", location);

      $done({
        response: {
          status: 302,
          headers: {
            Location: location
          },
          body: ""
        }
      });

      return;
    }
  }
}

console.log("NO REDIRECT");
$done({});

const client = String($argument || "").trim();

console.log("CLIENT =", client);
console.log("URL =", $request.url);

// 测试 Swiftgram
if (client === "Swiftgram") {
  const match = $request.url.match(
    /^https?:\/\/(?:t\.me|telegram\.me)\/(.+)$/i
  );

  if (match) {
    const path = match[1].split("?")[0];

    const parts = path
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

      console.log("Swiftgram TEST =", location);

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

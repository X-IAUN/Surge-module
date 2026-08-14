const client = String($argument || "Telegram").trim();

console.log("CLIENT =", client);
console.log("URL =", $request.url);

if (client === "Telegram") {
  $done({});
  return;
}

if (client !== "Swiftgram") {
  console.log("UNKNOWN CLIENT =", client);
  $done({});
  return;
}

const match = $request.url.match(
  /^https?:\/\/(?:t\.me|telegram\.me)\/(.+)$/i
);

if (!match) {
  console.log("URL NOT MATCH");
  $done({});
  return;
}

let tail = match[1];

if (tail.startsWith("s/")) {
  tail = tail.substring(2);
}

const queryIndex = tail.indexOf("?");

const path =
  queryIndex === -1
    ? tail
    : tail.substring(0, queryIndex);

const parts = path
  .split("/")
  .filter(Boolean);

if (!parts.length) {
  console.log("EMPTY PATH");
  $done({});
  return;
}

let location;

if (parts[0].startsWith("+")) {

  location =
    "tg://resolve?domain=" +
    encodeURIComponent(parts[0]);

} else if (
  parts[0] === "joinchat" &&
  parts[1]
) {

  location =
    "tg://resolve?domain=+" +
    encodeURIComponent(parts[1]);

} else {

  location =
    "tg://resolve?domain=" +
    encodeURIComponent(parts[0]);

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

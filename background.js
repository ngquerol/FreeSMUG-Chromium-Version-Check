const freeSmugVersionRssUrl = "https://sourceforge.net/projects/osxportableapps/rss?path=/Chromium";
const freeSmugVersionRegex = /Chromium_OSX_([\d.]+).dmg/;
const stableVersionJsonUrl = "https://omahaproxy.appspot.com/all.json";
const freedomCookie = "FreedomCookie=true;domain=sourceforge.net;path=/";
const fetchTimeout = 10000;

function timedPromise(delay, promise) {
  return Promise.race([
    new Promise((_, reject) => setTimeout(reject, delay, "Operation timed out.")),
    promise
  ]);
}

function fetchStableVersion() {
  return timedPromise(fetchTimeout, fetch(stableVersionJsonUrl, {
    headers: { accept: "application/json" }
  }).then(response => response.json())
    .then(json => {
      const version = json.find(oses => oses.os === "mac").versions
                          .find(versions => versions.channel === "stable").version;
      return version ? Promise.resolve({
        version
      }) : Promise.reject("Invalid JSON response.");
    }).catch(error => Promise.reject(error)));
}

function fetchFreeSmugVersion() {
  return timedPromise(fetchTimeout, fetch(freeSmugVersionRssUrl, {
    credentials: "include",
    headers: {
      accept: "application/rss+xml",
      cookie: freedomCookie
    }
  }).then(response => response.text())
    .then(text => {
      const xml = new DOMParser().parseFromString(text, "application/xml");
      const firstItem = xml.evaluate("(//rss/channel/item)[1]", xml).iterateNext();
      const link = firstItem.getElementsByTagName("link")[0].textContent;
      const version = link.match(freeSmugVersionRegex)[1];

      return version ? Promise.resolve({
        version: version,
        downloadUrl: link
      }) : Promise.reject("Invalid XML response.");
    }).catch(error => Promise.reject(error)));
}

function fetchVersion({versionType, currentVersion}) {
  let response = {
    type: "versionInfo",
    versionType,
    currentVersion
  };

  let versionPromise;

  switch (versionType) {
    case "freesmug":
      versionPromise = fetchFreeSmugVersion();
      break;

    case "stable":
      versionPromise = fetchStableVersion();
      break;

    default:
      versionPromise = Promise.reject("Unknown version type \"" + versionType + "\".");
      break;
  }

  versionPromise.then(({ version, downloadUrl = "" }) => {
    response.matched = matchVersions(currentVersion, version);
    response.version = version;
    response.downloadUrl = downloadUrl;
    chrome.runtime.sendMessage(response);
  }).catch(error => {
    response.error = error;
    chrome.runtime.sendMessage(response);
  });
}

function matchVersions(version1, version2) {
  const v1 = version1.split(".");
  const v2 = version2.split(".");

  if (v1.length !== 4 || v2.length !== 4) { return false; }

  return v1.map((x, i) => [x, v2[i]])
           .every((x, y) => parseInt(x, 10) === parseInt(y, 10));
}

chrome.runtime.onMessage.addListener((message, sender, _) => {
  if (message.type === "fetchVersion") { fetchVersion(message); }
});

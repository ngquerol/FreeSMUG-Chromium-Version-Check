const freeSmugVersionRssUrl = "https://sourceforge.net/projects/osxportableapps/rss?path=/Chromium";
const freeSmugVersionRegex = /Chromium_OSX_([\d.]+).dmg/;
const stableVersionJsonUrl = "https://omahaproxy.appspot.com/all.json";
const freedomCookie = "FreedomCookie=true;domain=sourceforge.net;path=/";

chrome.runtime.onMessage.addListener((message, sender, response) => {
  if (message.type === "fetchVersion") {
    fetchVersion(message);
  }
});

function timedPromise(delay, promise) {
  return Promise.race([
    new Promise((resolve, reject) => {
      setTimeout(reject, delay, "Operation timed out.");
    }),
    promise
  ]);
}

function fetchStableVersion() {
  return timedPromise(5000, fetch(stableVersionJsonUrl, {
    headers: {
      accept: "application/json"
    }
  }).then(response => {
    return response.json();
  }).then(json => {
    const version = json
          .find(os => os["os"] === "mac")["versions"]
          .find(version => version["channel"] === "stable")["version"];
    return version ? Promise.resolve(version) : Promise.reject("Invalid response.");
  }).catch(error => Promise.reject(error)));
}

function fetchFreeSmugVersion() {
  return timedPromise(5000, fetch(freeSmugVersionRssUrl, {
    credentials: "include",
    headers: {
      accept: "application/rss+xml",
      cookie: freedomCookie
    }
  }).then(response => {
    return response.text();
  }).then(text => {
    const xml = new DOMParser().parseFromString(text, "application/xml");
    const firstItem = xml.evaluate("(//rss/channel/item)[1]", xml).iterateNext();
    const link = firstItem.getElementsByTagName("link")[0].textContent;
    const version = link.match(freeSmugVersionRegex)[1];

    return version ? Promise.resolve({
      version: version,
      downloadUrl: link
    }) : Promise.reject("Invalid response.");
  }).catch(error => Promise.reject(error)));
}

function fetchVersion({versionType, currentVersion}) {
  let response = {
    type: "versionInfo",
    versionType: versionType,
    currentVersion: currentVersion
  };

  if (versionType === "freesmug") {
    fetchFreeSmugVersion().then(({version, downloadUrl}) => {
      response.matched = matchVersions(currentVersion, version);
      response.version = version;
      response.downloadUrl = downloadUrl;
      chrome.runtime.sendMessage(response);
    }).catch(error => {
      response.error = error;
      chrome.runtime.sendMessage(response);
    });
  } else if (versionType === "stable") {
    fetchStableVersion().then(version => {
      response.version = version;
      chrome.runtime.sendMessage(response);
    }).catch(error => {
      response.error = error;
      chrome.runtime.sendMessage(response);
    });
  }
}

function matchVersions(version1, version2) {
  const v1 = version1.split(".");
  const v2 = version2.split(".");

  if (v1.length !== 4 || v2.length !== 4) { return false; }

  return v1
    .map((x, i) => [x, v2[i]])
    .every((x, y) => parseInt(x, 10) === parseInt(y, 10));
}

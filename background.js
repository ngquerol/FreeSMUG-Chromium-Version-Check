const currentVersion = window.navigator.userAgent.match(/Chrome\/([\d.]+)/)[1];

const freeSmugVersionRssUrl = "https://sourceforge.net/projects/osxportableapps/rss?path=/Chromium";
const freeSmugVersionRegex = /Chromium_OSX_([\d.]+).dmg/;
const stableVersionJsonUrl = "https://omahaproxy.appspot.com/all.json";
const freedomCookie = "FreedomCookie=true;domain=sourceforge.net;path=/";

const alarmId = "versionCheck";
const notificationId = "newVersionNotification";

const notificationButtons = {
  download: { index: 0, title: "Download", iconUrl: "images/download.png" },
  dismiss: { index: 1, title: "Dismiss", iconUrl: "images/dismiss.png" }
};

const fetchTimeout = 10000;

let settings = {};

function timedPromise(delay, promise) {
  return Promise.race([
    new Promise((_, reject) => setTimeout(reject, delay, "Operation timed out.")),
    promise
  ]);
}

function formDownloadUrl(versionNumber) {
  return "https://downloads.sourceforge.net/osxportableapps/Chromium_OSX_" + versionNumber + ".dmg"
}

function matchVersions(version1, version2) {
  const v1 = version1.split(".");
  const v2 = version2.split(".");

  if (v1.length !== 4 || v2.length !== 4) { return false; }

  return v1.map((x, i) => [x, v2[i]])
    .every((x, y) => parseInt(x, 10) === parseInt(y, 10));
}

function fetchStableVersion() {
  return timedPromise(fetchTimeout, fetch(stableVersionJsonUrl, {
    headers: { accept: "application/json" }
  }).then(response => {
    return response.json();
  }).then(json => {
    const version = json.find(oses => oses.os === "mac").versions
          .find(versions => versions.channel === "stable").version;
    return version ? Promise.resolve(version) : Promise.reject("Invalid JSON response.");
  }).catch(error => {
    return Promise.reject(error);
  }));
}

function fetchFreeSmugVersion() {
  return timedPromise(fetchTimeout, fetch(freeSmugVersionRssUrl, {
    credentials: "include",
    headers: {
      accept: "application/rss+xml",
      cookie: freedomCookie
    }
  }).then(response => {
    return response.text()
  }).then(text => {
    const xml = new DOMParser().parseFromString(text, "application/xml");
    const firstItem = xml.evaluate("(//rss/channel/item)[1]", xml).iterateNext();
    const link = firstItem.getElementsByTagName("link")[0].textContent;
    const version = link.match(freeSmugVersionRegex)[1];

    return version ? Promise.resolve(version) : Promise.reject("Invalid XML response.");
  }).catch(error => {
    return Promise.reject(error);
  }));
}

function fetchVersion(versionType) {
  switch(versionType) {
  case "freesmug": return fetchFreeSmugVersion();
  case "stable": return fetchStableVersion();
  }
}

function fetchSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["stable", "checkFrequency"], items => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(error);
      } else {
        resolve(items);
      }
    });
  });
}

function setupCheckAlarm(checkFrequency) {
  if (settings.checkFrequency < 0) {
    chrome.alarms.clear(alarmId);
    return;
  }

  const checkTime = new Date(Date.now() + checkFrequency);

  checkTime.setHours(0);
  checkTime.setMinutes(0);
  checkTime.setSeconds(0);

  chrome.alarms.create(alarmId, {
    when: checkTime.getTime(),
    periodInMinutes: checkTime.getTime() / 60000
  });
}

function notifyNewVersion(versionInfo) {
  chrome.notifications.create(notificationId, {
    type: "basic",
    requireInteraction: true,
    iconUrl: "images/update.png",
    title: "New FreeSMUG Chromium version",
    message: "Version «" + versionInfo.versionNumber + "» is available.",
    contextMessage: "You have version «" + currentVersion + "».",
    buttons: [
      { title: notificationButtons.download.title, iconUrl: notificationButtons.download.iconUrl },
      { title: notificationButtons.dismiss.title, iconUrl: notificationButtons.dismiss.iconUrl }
    ]
  });

  chrome.notifications.onButtonClicked.addListener((id, idx) => {
    if (id === notificationId && idx === notificationButtons.download.index) {
      chrome.tabs.create({ url: formDownloadUrl(versionInfo.downloadUrl) });
    }
    chrome.notifications.clear(notificationId);
  });
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== alarmId) { return; }

  let versionInfo = {
    type: "versionInfo",
    versionType: "freesmug"
  };

  fetchVersion(versionInfo.versionType).then(versionNumber => {
    versionInfo.matchesStable = matchVersions(currentVersion, versionNumber);
    versionInfo.versionNumber = versionNumber;
    notifyNewVersion(versionInfo);
  }).catch(error => {
    versionInfo.error = error;
    console.error("Could not check for new " + versionInfo.versionType + " version: " + error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, _) => {
  if (message.type !== "fetchVersion") { return; }

  let versionInfo = {
    type: "versionInfo",
    versionType: message.versionType
  };

  fetchVersion(message.versionType).then(versionNumber => {
    versionInfo.versionNumber = versionNumber;

    if (message.versionType === "freesmug") {
      versionInfo.matchesStable = matchVersions(versionNumber, currentVersion);
      versionInfo.downloadUrl = formDownloadUrl(versionNumber);
    }

    chrome.runtime.sendMessage(versionInfo);
  }).catch(error => {
    versionInfo.error = error;
    console.error("Could not check for new " + versionInfo.versionType + " version: " + error);
  });
});

chrome.storage.onChanged.addListener((changes, _) => {
  Object.keys(changes).forEach(item => {
    if (item === "checkFrequency") { setupCheckAlarm(settings[item]); }
    settings[item] = changes[item].newValue
  })
});

fetchSettings().then(items => {
  settings = items;
  setupCheckAlarm(settings.checkFrequency);
}).catch(_ => {
  settings = {
    stable: true,
    checkFrequency: -1
  };
});

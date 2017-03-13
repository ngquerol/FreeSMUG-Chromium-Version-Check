const currentVersion = window.navigator.userAgent.match(/Chrome\/([\d.]+)/)[1];

const freeSmugVersionRssUrl = "https://sourceforge.net/projects/osxportableapps/rss?path=/Chromium";
const freeSmugVersionRegex = /Chromium_OSX_([\d.]+).dmg/;
const stableVersionJsonUrl = "https://omahaproxy.appspot.com/all.json";

const alarmId = "versionCheck";
const alarmTimestampKey = "lastAutomaticVersionCheck";
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

  return v1.map((v1elem, i) => [v1elem, v2[i]])
    .every(vElems => parseInt(vElems[0], 10) === parseInt(vElems[1], 10));
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
  }));
}

function fetchFreeSmugVersion() {
  return timedPromise(fetchTimeout, fetch(freeSmugVersionRssUrl, {
    credentials: "include",
    headers: { accept: "application/rss+xml" }
  }).then(response => {
    return response.text()
  }).then(text => {
    const xml = new DOMParser().parseFromString(text, "application/xml");
    const firstItem = xml.evaluate("(//rss/channel/item)[1]", xml).iterateNext();
    const link = firstItem.getElementsByTagName("link")[0].textContent;
    const version = link.match(freeSmugVersionRegex)[1];

    return version ? Promise.resolve(version) : Promise.reject("Invalid XML response.");
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

function scheduleCheck() {
  const checkFrequency = settings.checkFrequency;

  chrome.storage.local.get([alarmTimestampKey], items => {
    const lastCheck = items[alarmTimestampKey];

    if (!lastCheck || ((Date.now() - lastCheck) >= checkFrequency)) {
      checkForNewFreeSMUGVersion();
    }

    chrome.alarms.clear(alarmId);

    if (settings.checkFrequency < 0) {
      return;
    }

    chrome.alarms.create(alarmId, {
      when: lastCheck + checkFrequency,
      periodInMinutes: checkFrequency / 60000
    });
  })
}

function checkForNewFreeSMUGVersion() {
  let versionInfo = { type: "versionInfo", versionType: "freesmug" };

  fetchVersion(versionInfo.versionType).then(versionNumber => {
    let checkTimestamp = {};
    checkTimestamp[alarmTimestampKey] = Date.now();
    chrome.storage.local.set(checkTimestamp);

    const upToDate = matchVersions(currentVersion, versionNumber);
    if (upToDate) { return; }

    versionInfo.matchesStable = upToDate;
    versionInfo.versionNumber = versionNumber;

    notifyNewFreeSMUGVersion(versionInfo);
  }).catch(error => {
    versionInfo.error = error;
    console.error(`Could not complete automatic check for new ${versionInfo.versionType} version: ${error}`);
  });
}

function notifyNewFreeSMUGVersion(versionInfo) {
  chrome.notifications.create(notificationId, {
    type: "basic",
    requireInteraction: true,
    iconUrl: "images/update.png",
    title: "New FreeSMUG Chromium version",
    message: `Version «${versionInfo.versionNumber}» is available.`,
    contextMessage: `You have version «${currentVersion}».`,
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

chrome.cookies.set({
  url: "https://sourceforge.net",
  name: "FreedomCookie",
  value: "true",
  expirationDate: new Date().setFullYear(new Date().getFullYear() + 1)
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== alarmId) { return; }
  checkForNewFreeSMUGVersion();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "fetchVersion") { return; }

  let versionInfo = { type: "versionInfo", versionType: message.versionType };

  fetchVersion(message.versionType).then(versionNumber => {
    versionInfo.versionNumber = versionNumber;

    if (message.versionType === "freesmug") {
      versionInfo.matchesStable = matchVersions(versionNumber, currentVersion);
      versionInfo.downloadUrl = formDownloadUrl(versionNumber);
    }

    chrome.runtime.sendMessage(versionInfo);
  }).catch(error => {
    versionInfo.error = error;
    chrome.runtime.sendMessage(versionInfo);
  })
});

chrome.storage.onChanged.addListener(changes => {
  Object.keys(changes).forEach(item => {
    settings[item] = changes[item].newValue
    if (item === "checkFrequency") { scheduleCheck(); }
  })
});

fetchSettings().then(items => {
  settings = items;
  scheduleCheck();
}).catch(() => {
  settings = {
    stable: true,
    checkFrequency: -1
  };
});

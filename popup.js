const notificationId = "newVersionNotification";
const notificationButtons = {
  download: { index: 0, title: "Download", iconUrl: "images/download.png" },
  dismiss: { index: 1, title: "Dismiss", iconUrl: "images/dismiss.png" }
};

let notifyNewVersions;
let showStableVersions;
let latestDownloadUrl;

function displayVersion(message) {
  const versionTag = document.getElementById(message.versionType);
  const currentVersionTag = document.getElementById("current");

  if (message.error) {
    versionTag.textContent = "?";
    versionTag.classList.add("failed");
    versionTag.title = "Could not retrieve " + message.versionType + " version:\n\n" + message.error;
  } else {
    versionTag.textContent = message.version;

    if (message.versionType === "freesmug") {
      latestDownloadUrl = message.downloadUrl;

      currentVersionTag.classList.add(
        message.matched ? "matched" : "mismatched"
      );

      if (!message.matched && notifyNewVersions) { notifyVersion(message); }
    }
  }
}

function notifyVersion({ version, currentVersion }) {
  chrome.notifications.create(notificationId, {
    type: "basic",
    requireInteraction: true,
    iconUrl: "images/update.png",
    title: "New FreeSMUG Chromium version",
    message: "Version «" + version + "» is available.",
    contextMessage: "You have version «" + currentVersion + "».",
    buttons: [
      { title: notificationButtons.download.title, iconUrl: notificationButtons.download.iconUrl },
      { title: notificationButtons.dismiss.title, iconUrl: notificationButtons.dismiss.iconUrl }
    ]
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const currentVersion = window.navigator.userAgent.match(/Chrome\/([\d.]+)/)[1];

  let versionTypes = ["freesmug"];

  chrome.storage.sync.get(["notify", "stable"], items => {
    notifyNewVersions = items.notify;
    showStableVersions = items.stable;

    document.getElementById("current").textContent = currentVersion;

    if (showStableVersions) {
      versionTypes.push("stable");
      document.getElementById("stable").parentNode.classList.remove("hidden");
    } else {
      document.getElementById("stable").parentNode.classList.add("hidden");
    }

    chrome.notifications.onButtonClicked.addListener((id, idx) => {
      if (id === notificationId && idx === notificationButtons.download.index) {
        chrome.tabs.create({ url: latestDownloadUrl });
      }

      chrome.notifications.clear(notificationId);
    });

    chrome.runtime.onMessage.addListener((message, sender, _) => {
      if (message.type === "versionInfo") { displayVersion(message); }
    });

    versionTypes.forEach(versionType => chrome.runtime.sendMessage({
      type: "fetchVersion",
      versionType: versionType,
      currentVersion: currentVersion
    }));
  });
});

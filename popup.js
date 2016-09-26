const currentVersion = window.navigator.userAgent.match(/Chrome\/([\d.]+)/)[1];
const currentVersionTag = document.getElementById("current");

var latestDownloadUrl;
var notificationId;

window.onload = () => {
  currentVersionTag.textContent = currentVersion;

  chrome.notifications.onButtonClicked.addListener((id, idx) => {
    if (id === notificationId && idx === 0) {
      chrome.tabs.create({ url: latestDownloadUrl });
    }

    chrome.notifications.clear(notificationId);
  });

  chrome.runtime.onMessage.addListener((message, sender, response) => {
    if (message.type === "versionInfo") {
      updateVersion(message);
    }
  });

  ["stable", "freesmug"].forEach(v => chrome.runtime.sendMessage({
    type: "fetchVersion",
    versionType: v,
    currentVersion: currentVersion
  }));
};

function updateVersion(message) {
  const versionTag = document.getElementById(message.versionType);

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

      if (!message.matched) {
        notifyNewVersion(message);
      }
    }
  }
}

function notifyNewVersion({ version, currentVersion }) {
  chrome.notifications.create(notificationId, {
    type: "basic",
    requireInteraction: true,
    iconUrl: "images/update.png",
    title: "New FreeSMUG Chromium version",
    message: "Version «" + version + "» is available.",
    contextMessage: "You have version «" + currentVersion + "».",
    buttons: [
      { title: "Download", iconUrl: "images/download.png" },
      { title: "Dismiss", iconUrl: "images/dismiss.png" }
    ]
  }, id => notificationId = id);
}

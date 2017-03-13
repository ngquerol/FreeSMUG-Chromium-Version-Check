const currentVersion = window.navigator.userAgent.match(/Chrome\/([\d.]+)/)[1];

function displayVersion(versionInfo) {
  const versionTag = document.getElementById(versionInfo.versionType);

  if (versionInfo.error) {
    versionTag.textContent = "?";
    versionTag.classList.add("failed");
    versionTag.title = `Could not retrieve ${versionInfo.versionType} version:\n\n${versionInfo.error}`;
  } else {
    versionTag.textContent = versionInfo.versionNumber;

    if (versionInfo.versionType === "freesmug") {
      document.getElementById("current").classList.add(
        versionInfo.matchesStable ? "matched" : "mismatched"
      );

      if (!versionInfo.matchesStable) {
        displayDownloadButton(versionInfo.downloadUrl);
      }
    }
  }
}

function displayDownloadButton(downloadUrl) {
  const downloadUrlRow = document.createElement("div");
  const downloadUrlButton = document.createElement("button");

  downloadUrlRow.classList.add("row");
  downloadUrlRow.classList.add("download-row");
  downloadUrlButton.textContent = "Download new version";
  downloadUrlRow.appendChild(downloadUrlButton);

  downloadUrlButton.addEventListener("click", () => {
    chrome.tabs.create({ url: downloadUrl });
  });

  document.getElementById("versions").appendChild(downloadUrlRow);
}

function fetchSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["stable"], items => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(error);
      } else {
        resolve(items);
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("current").textContent = currentVersion;

  fetchSettings().then(settings => {
    let versions = ["freesmug"];

    if (settings.stable) {
      versions.push("stable");
      document.getElementById("stable").parentNode.classList.remove("hidden");
    } else {
      document.getElementById("stable").parentNode.classList.add("hidden");
    }

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "versionInfo") { displayVersion(message); }
    });

    versions.forEach(version => {
      chrome.runtime.sendMessage({
        type: "fetchVersion",
        versionType: version
      });
    });
  });
});

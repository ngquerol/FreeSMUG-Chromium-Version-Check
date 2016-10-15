function saveOptions() {
  chrome.storage.sync.set({
    checkFrequency: parseInt(document.getElementById("check_frequency").value, 10),
    stable: document.getElementById("stable").checked
  }, () => {
    const status = document.getElementById("status");
    status.textContent = "Options saved.";
    setTimeout(() => status.textContent = "", 750);
  });
}

function restoreOptions() {
  chrome.storage.sync.get({
    checkFrequency: "never",
    stable: true
  }, items => {
    document.getElementById("stable").checked = items.stable;
    document.getElementById("check_frequency").value = items.checkFrequency;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("save").addEventListener("click", saveOptions);
  restoreOptions();
});

const notify = document.getElementById("notify");
const checkFrequency = document.getElementById("check_frequency");
const stable = document.getElementById("stable");
const save = document.getElementById("save");
const status = document.getElementById("status");

function saveOptions() {
  chrome.storage.sync.set({
    notify: notify.checked,
    checkFrequency: checkFrequency.value,
    stable: stable.checked
  }, () => {
    status.textContent = "Options saved.";
    setTimeout(() => status.textContent = "", 750);
  });
}

function restoreOptions() {
  chrome.storage.sync.get({
    notify: true,
    checkFrequency: "never",
    stable: true
  }, items => {
    notify.checked = items.notify;
    checkFrequency.value = items.checkFrequency;
    stable.checked = items.stable;
  });
}

save.addEventListener("click", saveOptions);
document.addEventListener("DOMContentLoaded", restoreOptions);

function checkAuth() {
  return {
    name: "Alex Super",
    company: "SafetyDocs HQ",
  }
}

const user = checkAuth()

if (user && document.getElementById("userAvatar")) {
  document.getElementById("userAvatar").textContent = user.name.charAt(0)
}

function switchTab(tabName, evt) {
  document.querySelectorAll(".pill").forEach((tab) => tab.classList.remove("is-active"))
  document.querySelectorAll(".tab-content").forEach((panel) => panel.classList.remove("active"))

  const trigger = evt?.currentTarget || document.querySelector(`[data-tab="${tabName}"]`)
  if (trigger) {
    trigger.classList.add("is-active")
  }
  const panel = document.getElementById("tab-" + tabName)
  if (panel) {
    panel.classList.add("active")
  }
}


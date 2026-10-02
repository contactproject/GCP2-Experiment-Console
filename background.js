chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["main.js"],
      world: "MAIN"
    });
  } catch (error) {
    console.error("GCP2 console injection failed:", error);
  }
});

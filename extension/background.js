// Background script for future use
console.log("Background script loaded");

// Cache management for nutri-scores
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_NUTRI_SCORE") {
    getStoredNutriScore(request.productId).then((score) =>
      sendResponse({ score })
    );
    return true; // Will respond asynchronously
  }
});

async function getStoredNutriScore(productId) {
  const result = await chrome.storage.local.get(productId);
  if (result[productId]) {
    const data = result[productId];
    // Check if cache is still valid
    if (Date.now() - data.timestamp < CACHE_EXPIRY) {
      return data.score;
    }
    // If expired, remove it
    await chrome.storage.local.remove(productId);
  }
  return null;
}

// Function to store a new score
async function storeNutriScore(productId, score) {
  await chrome.storage.local.set({
    [productId]: {
      score,
      timestamp: Date.now(),
    },
  });
}

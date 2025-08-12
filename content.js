console.log("Rohlik Enhanced loaded");

const VERSION = "v5";
const dbName = `nutriScoreDB_${VERSION}`;
const storeName = `nutriScores_${VERSION}`;
let db;

const initDB = () => {
  return new Promise((resolve) => {
    // Check if indexedDB is available
    if (!window.indexedDB) {
      console.debug("IndexedDB not available, using localStorage");
      resolve();
      return;
    }

    const request = indexedDB.open(dbName, 1);

    request.onerror = () => {
      console.debug("IndexedDB failed to open, using localStorage");
      resolve();
    };

    request.onsuccess = () => {
      console.debug("IndexedDB opened successfully");
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
      }
    };
  });
};

// Initialize DB when script loads
initDB().catch(console.warn);

async function fetchNutritionData(productId) {
  const url = `https://www.rohlik.cz/api/v1/products/${productId}/composition`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();

  if (!data.nutritionalValues?.[0]?.values) {
    return null;
  }

  const values = data.nutritionalValues[0].values;

  return {
    energyKJ: values.energyKJ?.amount ?? null,
    proteins: values.protein?.amount ?? null,
    carbs: values.carbohydrates?.amount ?? null,
    sugars: values.sugars?.amount ?? null,
    fats: values.fats?.amount ?? null,
    saturatedFats: values.saturatedFats?.amount ?? null,
    fiber: values.fiber?.amount ?? null,
    salt: values.salt?.amount ?? null,
  };
}

async function fetchCategoryData(productId) {
  const url = `https://www.rohlik.cz/api/v1/products/${productId}/categories`;
  const response = await fetch(url);
  const data = await response.json();
  return data?.categories || [];
}

// Cache operations
async function getCachedScore(productId) {
  if (!db) {
    const cached = localStorage.getItem(`${storeName}_${productId}`);
    if (cached) {
      const parsedCache = JSON.parse(cached);
      return parsedCache?.score ?? null;
    }
    return null;
  }

  const cached = await new Promise((resolve) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(productId);

    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        resolve(result.score);
      } else {
        resolve(undefined);
      }
    };
    request.onerror = () => resolve(null);
  });
  return cached;
}

async function setCachedScore(productId, score) {
  const cacheData = { id: productId, score, timestamp: Date.now() };

  if (!db) {
    localStorage.setItem(
      `${storeName}_${productId}`,
      JSON.stringify(cacheData)
    );
    return;
  }

  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  store.put(cacheData);
}

async function fetchNutriScore(productId) {
  try {
    // Check cache first
    const cachedScore = await getCachedScore(productId);
    if (cachedScore !== undefined) {
      return cachedScore;
    }

    const [data, categories] = await Promise.all([
      fetchNutritionData(productId),
      fetchCategoryData(productId),
    ]);

    // Check for alcoholic beverages first. Those don't have a Nutri-Score
    if (
      categories?.some(
        (cat) =>
          cat.name.toLowerCase().includes("víno") ||
          cat.name.toLowerCase().includes("piva") ||
          cat.name.toLowerCase().includes("lihoviny")
      )
    ) {
      await setCachedScore(productId, null);
      return null;
    }

    if (!data) {
      await setCachedScore(productId, null);
      return null;
    }

    // Determine product category flags based on category names
    const isCheese = categories.some((cat) =>
      cat.name.toLowerCase().includes("sýr")
    );
    const isRedMeat = categories.some(
      (cat) =>
        cat.name.toLowerCase().includes("hověz") ||
        cat.name.toLowerCase().includes("vepřov")
    );
    const isBeverage = categories.some((cat) =>
      cat.name.toLowerCase().includes("nápoje")
    );
    const isFatsOilsNutsOrSeeds = categories.some(
      (cat) =>
        cat.name.toLowerCase().includes("oleje") ||
        cat.name.toLowerCase().includes("máslo, tuky a margaríny") ||
        cat.name.toLowerCase().includes("ořechy") ||
        cat.name.toLowerCase().includes("semínka")
    );

    const score = calculateNutriScore2022({
      ...data,
      isCheese,
      isRedMeat,
      isBeverage,
      isFatsOilsNutsOrSeeds,
      fruitVegLegumesPercent: 0, // We don't have this data
    });

    // Cache the result
    await setCachedScore(productId, score);

    return score;
  } catch (error) {
    console.warn("Error fetching nutri-score:", error);
    return null;
  }
}

async function addNutriScores() {
  // Match all product cards
  const products = document.querySelectorAll('[data-test^="productCard-"]');

  for (const product of products) {
    // Check both the data attribute and existing score element
    if (
      product.hasAttribute("data-nutriscore-added") ||
      product.querySelector(".nutri-score-container")
    ) {
      continue;
    }

    // Mark as being processed immediately to prevent race conditions
    product.setAttribute("data-nutriscore-added", "true");

    // Extract product ID from data-test attribute
    const dataTest = product.getAttribute("data-test");
    const productId = dataTest.match(/productCard-.*?-(\d+)/)?.[1];

    if (productId) {
      try {
        const score = await fetchNutriScore(productId);
        if (!score) {
          // If score is null, remove the processing marker
          product.removeAttribute("data-nutriscore-added");
          continue;
        }

        const scoreElement = createNutriScore(score);
        scoreElement.classList.add("nutri-score-container"); // Add class for duplicate checking

        // Find the image container to insert the score
        const imageContainer = product.querySelector(
          '[data-test="productCard-header-image"]'
        );

        // Double-check we haven't added a score while waiting for the fetch
        if (
          imageContainer &&
          !product.querySelector(".nutri-score-container")
        ) {
          imageContainer.style.position = "relative"; // Ensure absolute positioning works
          imageContainer.appendChild(scoreElement);
        }
      } catch (error) {
        // If there's an error, remove the processing marker so we can try again
        product.removeAttribute("data-nutriscore-added");
        console.error(
          "Error adding nutri-score for product:",
          productId,
          error
        );
      }
    }
  }
}

async function addProductDetailNutriScore() {
  // Try multiple selectors to find product images
  let productImage = document.querySelector('[data-gtm-item="product-image"]');

  // If not found, try alternative selectors for different page layouts
  if (!productImage) {
    // Look for image containers that contain a picture element (common pattern)
    const imageContainers = document.querySelectorAll("div");

    for (const container of imageContainers) {
      const picture = container.querySelector("picture");
      const img = container.querySelector(
        'img[src*="/images/grocery/products/"]'
      );
      if (
        picture &&
        img &&
        container.children.length === 1 &&
        container.children[0] === picture
      ) {
        productImage = container;
        break;
      }
    }
  }

  if (!productImage) {
    return;
  }

  // Find the actual image container - look for the best container for positioning
  let imageContainer = productImage;

  // Try to find a more appropriate container for positioning
  // Look for the container that directly wraps the img/picture element
  const imgElement = productImage.querySelector("img");
  const pictureElement = productImage.querySelector("picture");

  if (imgElement || pictureElement) {
    // Find the immediate parent of the picture/img element
    const mediaElement = pictureElement || imgElement;
    const mediaParent = mediaElement.parentElement;

    // Use the parent of the picture/img if it's a direct child of productImage
    // This handles both structures: nested wrapper divs and direct children
    if (mediaParent && mediaParent.parentElement === productImage) {
      imageContainer = mediaParent;
    }
    // If the media element is a direct child of productImage, use productImage itself
    else if (mediaElement.parentElement === productImage) {
      imageContainer = productImage;
    }
  }

  if (
    imageContainer.hasAttribute("data-nutriscore-added") ||
    imageContainer.querySelector(".nutri-score-container")
  ) {
    return;
  }

  // Mark as being processed immediately to prevent race conditions
  imageContainer.setAttribute("data-nutriscore-added", "true");

  // Extract product ID from URL
  const productId = window.location.pathname.match(/\/(\d+)-/)?.[1];

  if (productId) {
    try {
      const score = await fetchNutriScore(productId);
      if (!score) {
        imageContainer.removeAttribute("data-nutriscore-added");
        return;
      }

      const scoreElement = createNutriScore(score);
      scoreElement.classList.add("nutri-score-container");
      scoreElement.style.position = "absolute";
      scoreElement.style.top = "8px";
      scoreElement.style.left = "8px";
      scoreElement.style.zIndex = "1";

      // Double-check we haven't added a score while waiting for the fetch
      if (!imageContainer.querySelector(".nutri-score-container")) {
        imageContainer.style.position = "relative";
        imageContainer.appendChild(scoreElement);
      }
    } catch (error) {
      imageContainer.removeAttribute("data-nutriscore-added");
      console.error(
        "Error adding nutri-score for product detail:",
        productId,
        error
      );
    }
  }
}

function createNutriScore(score) {
  // Validate score
  if (!["A", "B", "C", "D", "E"].includes(score)) {
    throw new Error("Score must be one of: A, B, C, D, E");
  }

  // Color definitions
  const colors = {
    A: "#038141",
    B: "#85BB2F",
    C: "#FECC03",
    D: "#EF8200",
    E: "#E63E11",
  };

  // Create container
  const container = document.createElement("div");
  container.style.cssText = `
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 10;
      display: inline-flex;
      flex-direction: column;
  `;

  // Create score element
  const scoreElement = document.createElement("div");
  scoreElement.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background-color: ${colors[score]};
      color: white;
      font-weight: bold;
      font-size: 18px;
      border-radius: 50%;
  `;

  scoreElement.textContent = score;
  container.appendChild(scoreElement);

  return container;
}

// Debounce function to prevent too frequent updates
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Debounced version of addNutriScores
const debouncedAddNutriScores = debounce(addNutriScores, 100);

// Watch for dynamic content changes
const observer = new MutationObserver((mutations) => {
  let shouldAddScores = false;
  let shouldAddDetailScore = false;

  for (const mutation of mutations) {
    // Check if any added nodes contain product cards
    if (mutation.addedNodes.length) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.querySelector('[data-test^="productCard-"]')) {
            shouldAddScores = true;
          }
          if (
            node.querySelector('[data-gtm-item="product-image"]') ||
            node.matches('[data-gtm-item="product-image"]')
          ) {
            shouldAddDetailScore = true;
          }
        }
      }
    }
  }

  if (shouldAddScores) {
    debouncedAddNutriScores();
  }
  if (shouldAddDetailScore) {
    addProductDetailNutriScore();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

/**
 * Source: https://docs.google.com/spreadsheets/d/1atzCN_lhovFwiL-YEP91Y2NviZuEyeCrKTtWH_aI9s0/edit?gid=392888576#gid=392888576
 * TODO: beverages: sweeteners
 * TODO: nuts and oils % content
 * TODO: fruit & veg % content
 */
function calculateNutriScore2022({
  energyKJ, // in kJ per 100g
  sugars = 0, // in g per 100g
  saturatedFats = 0, // in g per 100g
  salt = 0, // in g per 100g
  proteins = 0, // in g per 100g
  fiber = 0, // in g per 100g
  fruitVegLegumesPercent = 0, // percentage of fruits, vegetables, and legumes
  isRedMeat = false,
  isCheese = false,
  isBeverage = false,
  isFatsOilsNutsOrSeeds = false,
}) {
  if (!energyKJ || isBeverage || isFatsOilsNutsOrSeeds) {
    return null;
  }

  // Helper function to calculate A points
  function calculateAPoints() {
    if (isFatsOilsNutsOrSeeds) {
      return (
        (energyKJ > 1200 ? 10 : Math.floor(energyKJ / 120)) +
        (sugars > 34 ? 10 : Math.floor(sugars / 3.4)) +
        (saturatedFats < 64 ? Math.floor((saturatedFats * 100) / 10) : 10) +
        (salt > 2.0 ? 10 : Math.floor(salt / 0.2))
      );
    }

    const energyPoints = energyKJ > 3350 ? 10 : Math.floor(energyKJ / 335);
    const sugarPoints =
      sugars <= 4.5
        ? 0
        : sugars <= 9
        ? 1
        : sugars <= 13.5
        ? 2
        : sugars <= 18
        ? 3
        : sugars <= 22.5
        ? 4
        : sugars <= 27
        ? 5
        : sugars <= 31
        ? 6
        : sugars <= 36
        ? 7
        : sugars <= 40
        ? 8
        : sugars <= 45
        ? 9
        : 10;
    const saturatesPoints =
      saturatedFats > 10 ? 10 : Math.floor(saturatedFats / 1);
    // Convert salt (g) to sodium (mg): salt × 400 = sodium
    const sodium = salt * 400;
    const saltPoints =
      sodium <= 90
        ? 0
        : sodium <= 180
        ? 1
        : sodium <= 270
        ? 2
        : sodium <= 360
        ? 3
        : sodium <= 450
        ? 4
        : sodium <= 540
        ? 5
        : sodium <= 630
        ? 6
        : sodium <= 720
        ? 7
        : sodium <= 810
        ? 8
        : sodium <= 900
        ? 9
        : 10;

    return energyPoints + sugarPoints + saturatesPoints + saltPoints;
  }

  // Helper function to calculate C points
  function calculateCPoints() {
    let proteinPoints = 0;
    if (proteins <= 1.6) proteinPoints = 0;
    else if (proteins <= 3.2) proteinPoints = 1;
    else if (proteins <= 4.8) proteinPoints = 2;
    else if (proteins <= 6.4) proteinPoints = 3;
    else if (Math.round(proteins * 10) / 10 <= 8.0) proteinPoints = 4;
    else proteinPoints = 5;

    if (isRedMeat) {
      proteinPoints = Math.min(proteinPoints, 2); // Red meat cap
    }

    const fiberPoints =
      fiber <= 0.9
        ? 0
        : fiber <= 1.9
        ? 1
        : fiber <= 2.8
        ? 2
        : fiber <= 3.7
        ? 3
        : fiber <= 4.7
        ? 4
        : 5;

    const fruitVegLegumePoints =
      fruitVegLegumesPercent > 80
        ? 5
        : fruitVegLegumesPercent > 60
        ? 2
        : fruitVegLegumesPercent > 40
        ? 1
        : 0;

    return {
      proteinPoints,
      fiberPoints,
      fruitVegLegumePoints,
    };
  }

  const pointsA = calculateAPoints();
  const { proteinPoints, fiberPoints, fruitVegLegumePoints } =
    calculateCPoints();
  const pointsC = proteinPoints + fiberPoints + fruitVegLegumePoints;

  // Special scoring rules
  if (isCheese) {
    const finalScore = pointsA - pointsC; // Cheese uses all C points
    if (finalScore <= 0) return "A";
    if (finalScore <= 2) return "B";
    if (finalScore <= 10) return "C";
    if (finalScore <= 18) return "D";
    return "E";
  }

  if (isFatsOilsNutsOrSeeds) {
    const finalScore =
      pointsA - Math.max(proteinPoints, fiberPoints + fruitVegLegumePoints);

    if (finalScore <= -6) return "A";
    if (finalScore <= 2) return "B";
    if (finalScore <= 10) return "C";
    if (finalScore <= 18) return "D";
    return "E";
  }

  const finalScore = isBeverage
    ? pointsA - pointsC
    : pointsA >= 11
    ? pointsA - (fiberPoints + fruitVegLegumePoints)
    : pointsA - pointsC;

  if (finalScore <= 0) return "A";
  if (finalScore <= 2) return "B";
  if (finalScore <= 10) return "C";
  if (finalScore <= 18) return "D";
  return "E";
}

// Initial run for both product cards and detail page
addNutriScores();
addProductDetailNutriScore();

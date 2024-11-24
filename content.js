console.log("Rohlik Enhanced loaded");

const dbName = "nutriScoreDB";
const storeName = "nutriScores";
let db;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
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
initDB().catch(console.error);

async function fetchNutritionData(productId) {
  const url = `https://www.rohlik.cz/api/v1/products/${productId}/composition`;
  const response = await fetch(url);
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

async function fetchNutriScore(productId) {
  try {
    // Check cache first
    if (db) {
      const cached = await new Promise((resolve) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(productId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });

      if (cached || cached === null) {
        return cached?.score ?? null;
      }
    }

    const [data, categories] = await Promise.all([
      fetchNutritionData(productId),
      fetchCategoryData(productId),
    ]);

    if (!data) return null;

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
    const isFatsOils = categories.some((cat) =>
      cat.name.toLowerCase().includes("oleje")
    );

    const score = calculateNutriScore2022({
      ...data,
      isCheese,
      isRedMeat,
      isBeverage,
      isFatsOils,
      fruitVegLegumesPercent: 0, // We don't have this data
    });

    // Cache the result if we have a valid score
    if (db) {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      store.put({ id: productId, score, timestamp: Date.now() });
    }

    return score;
  } catch (error) {
    console.error("Error fetching nutri-score:", error);
    return null;
  }
}

function calculateNutriScore(nutritionData) {
  // Return null if sugars are nullish since we can't calculate accurate score
  if (nutritionData.sugars == null) {
    return null;
  }

  const nutrientValues = {
    energy: nutritionData.energyKJ,
    fibers: nutritionData.fiber || 0,
    fruit_percentage: 0, // We don't have this data
    proteins: nutritionData.proteins,
    saturated_fats: nutritionData.saturatedFats,
    salt: nutritionData.salt,
    sugar: nutritionData.sugars,
  };

  const score = calculateScore(nutrientValues);
  console.log("Calculated score:", score);
  return calculateNutrientScore(scoreTable.nutriClass, score);
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

// Initial run
addNutriScores();

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
  // Only run if we see new nodes added
  if (mutations.some((mutation) => mutation.addedNodes.length > 0)) {
    debouncedAddNutriScores();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

const scoreTable = {
  energy: [
    [-10000, 335, 0],
    [335, 670, 1],
    [670, 1005, 2],
    [1005, 1340, 3],
    [1340, 1675, 4],
    [1675, 2010, 5],
    [2010, 2345, 6],
    [2345, 2680, 7],
    [2680, 3015, 8],
    [3015, 3350, 9],
    [3350, 10000, 10],
  ],
  sugar: [
    [-10000, 4.5, 0],
    [4.5, 9, 1],
    [9, 13.5, 2],
    [13.5, 18, 3],
    [18, 22.5, 4],
    [22.5, 27, 5],
    [27, 31, 6],
    [31, 36, 7],
    [36, 40, 8],
    [40, 45, 9],
    [45, 10000, 10],
  ],
  saturated_fats: [
    [-10000, 1, 0],
    [1, 2, 1],
    [2, 3, 2],
    [3, 4, 3],
    [4, 5, 4],
    [5, 6, 5],
    [6, 7, 6],
    [7, 8, 7],
    [8, 9, 8],
    [9, 10, 9],
    [10, 10000, 10],
  ],
  salt: [
    [-10000, 0.225, 0],
    [0.225, 0.45, 1],
    [0.45, 0.675, 2],
    [0.675, 0.9, 3],
    [0.9, 1.125, 4],
    [1.125, 1.35, 5],
    [1.35, 1.575, 6],
    [1.575, 1.8, 7],
    [1.8, 2.025, 8],
    [2.025, 2.25, 9],
    [2.25, 10000, 10],
  ],
  fibers: [
    [-10000, 0.9, 0],
    [0.9, 1.9, 1],
    [1.9, 2.8, 2],
    [2.8, 3.7, 3],
    [3.7, 4.7, 4],
    [4.7, 10000, 5],
  ],
  proteins: [
    [-10000, 1.6, 0],
    [1.6, 3.2, 1],
    [3.2, 4.8, 2],
    [4.8, 6.4, 3],
    [6.4, 8, 4],
    [8, 10000, 5],
  ],
  fruit_percentage: [
    [-10000, 40, 0],
    [40, 60, 1],
    [60, 80, 2],
    [80, 10000, 5],
  ],
  nutriClass: [
    [-10000, -1, "A"],
    [-1, 2, "B"],
    [2, 10, "C"],
    [10, 18, "D"],
    [18, 10000, "E"],
  ],
};

const badNutrients = ["energy", "sugar", "saturated_fats", "salt"];
const goodNutrients = ["fibers", "proteins", "fruit_percentage"];

// Helper to calculate nutrient score based on a range table
function calculateNutrientScore(ranges, value) {
  for (const [min, max, score] of ranges) {
    if (value >= min && value < max) return score;
  }
  return 0;
}

// Calculate the NutriScore for solid food
function calculateScore(nutrientValues) {
  const badScore = badNutrients.reduce(
    (sum, nutrient) =>
      sum +
      calculateNutrientScore(
        scoreTable[nutrient],
        nutrientValues[nutrient] || 0
      ),
    0
  );

  const goodScore = goodNutrients.reduce(
    (sum, nutrient) =>
      sum +
      calculateNutrientScore(
        scoreTable[nutrient],
        nutrientValues[nutrient] || 0
      ),
    0
  );

  const fruitScore = calculateNutrientScore(
    scoreTable.fruit_percentage,
    nutrientValues.fruit_percentage || 0
  );
  const fiberScore = calculateNutrientScore(
    scoreTable.fibers,
    nutrientValues.fibers || 0
  );

  return badScore >= 11 && fruitScore < 5
    ? badScore - fiberScore - fruitScore
    : badScore - goodScore;
}

function calculateNutriScore2022({
  energyKJ, // in kJ per 100g
  sugars, // in g per 100g
  saturatedFats, // in g per 100g
  salt, // in g per 100g
  proteins, // in g per 100g
  fiber, // in g per 100g
  fruitVegLegumesPercent = 0, // percentage of fruits, vegetables, and legumes
  isRedMeat = false,
  isCheese = false,
  isBeverage = false,
  isFatsOils = false,
}) {
  // Helper function to calculate A points
  function calculateAPoints() {
    if (isFatsOils) {
      return (
        (energyKJ > 1200 ? 10 : Math.floor(energyKJ / 120)) +
        (sugars > 34 ? 10 : Math.floor(sugars / 3.4)) +
        (saturatedFats < 64 ? Math.floor((saturatedFats * 100) / 10) : 10) +
        (salt > 2.0 ? 10 : Math.floor(salt / 0.2))
      );
    }

    const energyPoints = energyKJ > 3350 ? 10 : Math.floor(energyKJ / 335);
    const sugarPoints = sugars > 51 ? 10 : Math.floor(sugars / 3.4);
    const saturatesPoints =
      saturatedFats > 10 ? 10 : Math.floor(saturatedFats / 1);
    const saltPoints = salt > 4 ? 10 : Math.floor(salt / 0.2);

    return energyPoints + sugarPoints + saturatesPoints + saltPoints;
  }

  // Helper function to calculate C points
  function calculateCPoints() {
    let proteinPoints = 0;
    if (proteins > 17) proteinPoints = 7;
    else if (proteins > 14) proteinPoints = 6;
    else if (proteins > 12) proteinPoints = 5;
    else if (proteins > 9.6) proteinPoints = 4;
    else if (proteins > 7.2) proteinPoints = 3;
    else if (proteins > 4.8) proteinPoints = 2;
    else if (proteins > 2.4) proteinPoints = 1;

    if (isRedMeat) {
      proteinPoints = Math.min(proteinPoints, 2); // Red meat cap
    }

    const fiberPoints =
      fiber > 7.4
        ? 5
        : fiber > 6.3
        ? 4
        : fiber > 5.2
        ? 3
        : fiber > 4.1
        ? 2
        : fiber > 3.0
        ? 1
        : 0;

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

  if (isFatsOils) {
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
    ? pointsA - pointsC
    : pointsA - (fiberPoints + fruitVegLegumePoints);

  if (finalScore <= 0) return "A";
  if (finalScore <= 2) return "B";
  if (finalScore <= 10) return "C";
  if (finalScore <= 18) return "D";
  return "E";
}

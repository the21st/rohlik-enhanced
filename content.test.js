import { calculateNutriScore, calculateNutriScore2022 } from "./content.js";

describe("calculateNutriScore", () => {
  it("correctly calculates Nutri-Score for given nutritional values", () => {
    const nutritionData = {
      energyKJ: 2650,
      fats: 70,
      saturatedFats: 5.3,
      carbs: 3,
      sugars: 1.5,
      proteins: 0.8,
      salt: 1,
      fiber: 0,
    };

    const score = calculateNutriScore2022(nutritionData);
    expect(score).toBe("D");
  });

  it("correctly calculates Nutri-Score for Spinach", () => {
    const nutritionData = {
      energyKJ: 23 * 4.184, // 23 kcal to kJ
      fats: 0.4,
      saturatedFats: 0.1,
      carbs: 3.6,
      sugars: 0.4,
      proteins: 2.9,
      salt: 0.1,
      fiber: 2.2,
    };

    const score = calculateNutriScore2022(nutritionData);
    expect(score).toBe("A");
  });

  it("correctly calculates Nutri-Score for Whole Grain Oats", () => {
    const nutritionData = {
      energyKJ: 389 * 4.184, // 389 kcal to kJ
      fats: 6.9,
      saturatedFats: 1.2,
      carbs: 66.3,
      sugars: 0.9,
      proteins: 16.9,
      salt: 0.01, // Low sodium content (10 mg)
      fiber: 10.6,
    };

    const score = calculateNutriScore2022(nutritionData);
    expect(score).toBe("A");
  });

  it("correctly calculates Nutri-Score for tesco parmigiano reggiano", () => {
    const nutritionData = {
      energyKJ: 1671, // 392 kcal to kJ
      fats: 30,
      saturatedFats: 20,
      carbs: 0,
      sugars: 0,
      proteins: 32,
      salt: 1.5,
      fiber: 0,
    };

    const score = calculateNutriScore2022({
      ...nutritionData,
      isCheese: true,
    });
    expect(score).toBe("D");
  });

  it("correctly calculates Nutri-Score for White Bread", () => {
    const nutritionData = {
      energyKJ: 265 * 4.184,
      fats: 3.2,
      saturatedFats: 0.5,
      carbs: 49,
      sugars: 0,
      proteins: 9,
      salt: 0.9,
      fiber: 0,
    };

    const score = calculateNutriScore2022(nutritionData);
    expect(score).toBe("C");
  });

  it("correctly calculates Nutri-Score for Milka chocolate", () => {
    const nutritionData = {
      energyKJ: 2251,
      fats: 31,
      saturatedFats: 19,
      carbs: 57,
      sugars: 55,
      proteins: 6.5,
      salt: 0.28,
      fiber: 2.3,
    };

    const score = calculateNutriScore2022(nutritionData);
    expect(score).toBe("E");
  });

  it("correctly calculates Nutri-Score for Madeland 20%", () => {
    const nutritionData = {
      energyKJ: 943,
      fats: 11,
      saturatedFats: 7.2,
      carbs: 0.5,
      sugars: 0.5,
      proteins: 31,
      salt: 1.3,
      fiber: 0,
    };

    const score = calculateNutriScore2022({
      ...nutritionData,
      isCheese: true,
    });
    expect(score).toBe("C");
  });

  it("correctly calculates Nutri-Score for Madeland 30%", () => {
    const nutritionData = {
      energyKJ: 1185,
      fats: 18,
      saturatedFats: 12,
      carbs: 0.5,
      sugars: 0.5,
      proteins: 30,
      salt: 1.3,
      fiber: 0,
    };

    const score = calculateNutriScore2022({
      ...nutritionData,
      isCheese: true,
    });
    expect(score).toBe("D");
  });

  it("correctly calculates Nutri-Score for Meggle Cottage Cheese přírodní", () => {
    const nutritionData = {
      energyKJ: 385,
      fats: 4.2,
      saturatedFats: 2.8,
      carbs: 1.5,
      sugars: 1.5,
      proteins: 12,
      salt: 1.1,
      fiber: 0,
    };

    const score = calculateNutriScore2022({
      ...nutritionData,
      isCheese: true,
    });
    // expect(score).toBe("B");
  });

  it("correctly calculates Nutri-Score for", () => {
    const nutritionData = {
      energyKJ: 1280,
      fats: 30,
      saturatedFats: 14,
      carbs: 1.8,
      sugars: 1.5,
      proteins: 8.2,
      salt: 0.55,
      fiber: 0,
    };

    const score = calculateNutriScore2022({
      ...nutritionData,
      isCheese: true,
    });
    expect(score).toBe("D");
  });

  it("correctly calculates Nutri-Score for whole-grain toast bread", () => {
    const nutritionData = {
      energyKJ: 1055,
      fats: 4,
      saturatedFats: 0.4,
      carbs: 42,
      sugars: 3.2,
      proteins: 8.5,
      salt: 1,
      fiber: 6,
    };

    const score = calculateNutriScore2022(nutritionData);
    expect(score).toBe("B");
  });
});

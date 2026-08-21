import { describe, test, expect } from 'vitest';
import { calculateCRDual, calculateNRY, calculatePCR } from '../../scripts/run_benchmark';

describe('Benchmark Metric Scorer Tests', () => {
  describe('CR_dual (Dual-Loop Recovery Conversion Rate)', () => {
    test('standard case: 20 recovered out of 25 recoverable equals 80%', () => {
      const result = calculateCRDual(20, 25);
      expect(result).toBe(0.80);
    });

    test('edge case: 0 recoverable cases handles divide-by-zero safely', () => {
      const result = calculateCRDual(0, 0);
      expect(result).toBe(0);
    });

    test('edge case: more recovered than recoverable (data anomaly check)', () => {
      const result = calculateCRDual(10, 5);
      expect(result).toBe(2.0);
    });
  });

  describe('NRY (Net Recovered Yield)', () => {
    test('correctly subtracts discounts from recovered amounts', () => {
      // 3 recoverable cases, total recoverable amount = 300
      // 2 cases recovered:
      // Case 1: amount = 100, discount = 10 (net = 90)
      // Case 2: amount = 100, discount = 0 (net = 100)
      // Case 3: amount = 100, not recovered (net = 0)
      // Total net yield = 190. Expected yield = 190 / 300 = 63.33%
      const recoveredOriginalAmountSum = 200;
      const discountsSum = 10;
      const recoverableOriginalAmountSum = 300;

      const result = calculateNRY(recoveredOriginalAmountSum, discountsSum, recoverableOriginalAmountSum);
      expect(result).toBeCloseTo(0.6333, 4);
    });

    test('handles 100% recovery with no discounts', () => {
      const result = calculateNRY(500, 0, 500);
      expect(result).toBe(1.0);
    });

    test('handles 0% recovery', () => {
      const result = calculateNRY(0, 0, 500);
      expect(result).toBe(0);
    });

    test('handles partial recoveries with high discount capping', () => {
      // Recoverable: 1000
      // Recovered original amount: 800
      // Discounts: 150
      // Net: 650. NRY = 650 / 1000 = 65%
      const result = calculateNRY(800, 150, 1000);
      expect(result).toBe(0.65);
    });

    test('edge case: 0 recoverable original amount handles divide-by-zero safely', () => {
      const result = calculateNRY(0, 0, 0);
      expect(result).toBe(0);
    });
  });

  describe('PCR (Policy Compliance Rate)', () => {
    test('properly flags compliance rates based on total cases and compliance counts', () => {
      // 40 compliant cases out of 50 total evaluated = 80%
      const result = calculatePCR(40, 50);
      expect(result).toBe(0.80);
    });

    test('verifies 100% compliance when no breaches occur', () => {
      const result = calculatePCR(50, 50);
      expect(result).toBe(1.0);
    });

    test('edge case: 0 total evaluated cases handles divide-by-zero safely', () => {
      const result = calculatePCR(0, 0);
      expect(result).toBe(0);
    });
  });
});

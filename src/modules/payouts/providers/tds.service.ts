// TDS = Tax Deducted at Source
// As per Indian law: 10% TDS on creator earnings above ₹30,000/year from a single platform

const TDS_THRESHOLD = 30000; // ₹30,000
const TDS_RATE = 0.1; // 10%

export function calculateTds(payoutAmount: number, totalEarnedThisYear: number): {
  tdsAmount: number;
  netAmount: number;
  tdsApplicable: boolean;
} {
  // if total earnings haven't crossed the threshold, no TDS
  if (totalEarnedThisYear < TDS_THRESHOLD) {
    return {
      tdsAmount: 0,
      netAmount: payoutAmount,
      tdsApplicable: false,
    };
  }

  // TDS applies on the full payout amount once threshold is crossed
  const tdsAmount = parseFloat((payoutAmount * TDS_RATE).toFixed(2));
  const netAmount = parseFloat((payoutAmount - tdsAmount).toFixed(2));

  return {
    tdsAmount,
    netAmount,
    tdsApplicable: true,
  };
}

export function generateTdsReference(creatorId: string, financialYear: string): string {
  // financial year in India runs April to March
  // e.g. "FY2026-27"
  return `TDS-${financialYear}-${creatorId.slice(0, 8).toUpperCase()}`;
}

export function getCurrentFinancialYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  // April onwards is the new financial year
  if (month >= 4) {
    return `FY${year}-${(year + 1).toString().slice(2)}`;
  } else {
    return `FY${year - 1}-${year.toString().slice(2)}`;
  }
}
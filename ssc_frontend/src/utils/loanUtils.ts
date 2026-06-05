import { HIJRI_MONTHS } from "@/types";
import type { LoanApplication } from "@/types";

export function computeEndDate(loan: LoanApplication): string {
  if (!loan.repayment_start_hijri_month || !loan.repayment_start_hijri_year)
    return "TBD";
  let endMonth =
    loan.repayment_start_hijri_month + loan.proposed_duration_months;
  let endYear = loan.repayment_start_hijri_year;
  while (endMonth > 12) {
    endMonth -= 12;
    endYear += 1;
  }
  const label =
    HIJRI_MONTHS.find((m) => m.value === endMonth)?.label ?? endMonth;
  return `${label} ${endYear}`;
}

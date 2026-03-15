export const OTC_FUND_CODES = ["016452", "016055"] as const;

export type OtcFundCode = (typeof OTC_FUND_CODES)[number];

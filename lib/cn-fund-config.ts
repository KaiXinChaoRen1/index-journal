export const CN_FUND_CODES = [
  "159941",
  "513100",
  "513300",
  "159501",
  "159632",
  "159659",
  "159513",
  "513110",
  "159660",
  "513390",
  "513870",
] as const;

export type CnFundCode = (typeof CN_FUND_CODES)[number];

// Deterministic money formatting. The web uses toLocaleString("en-NG"), which depends on the JS engine's locale data;
// Hermes' coverage of it is unproven (spike S1), so this does the grouping by hand. tests/format.test.ts checks it against Intl.
export const naira = (kobo: number) => {
  const n = Math.round(kobo / 100);
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}₦${s}`;
};

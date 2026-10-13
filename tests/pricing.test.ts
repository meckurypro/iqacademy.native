import { blankPackage, chargedAmounts, packageProblems, partsFromCharged } from "../src/features/admin-classes/pricing";
import { feeNote } from "../src/features/enrol/logic";

const form = (over: object) => ({ ...blankPackage, name: "Standard", code: "STANDARD", price: "50000", courses: "2", instOn: true, ...over });
const parts = (a: string, b: string) => [{ label: "First", amount: a, rule: "before_start" }, { label: "Second", amount: b, rule: "before_course_2" }];

describe("instalment extra fee", () => {
  it("charges the extra fee together with the LAST instalment only", () => {
    expect(chargedAmounts(parts("25000", "25000"), "5000")).toEqual([25000, 30000]);
    expect(chargedAmounts(parts("25000", "25000"), "")).toEqual([25000, 25000]);
  });
  it("turns stored (charged) amounts back into editable parts", () => {
    expect(partsFromCharged([2500000, 3000000], 500000)).toEqual(["25000", "25000"]);
    expect(partsFromCharged([3000000, 2500000], 0)).toEqual(["30000", "25000"]);
  });
  it("requires the parts to add up to the full price, whatever the fee is", () => {
    expect(packageProblems(form({ inst: parts("25000", "25000"), fee: "5000" }) as any, 10)).toEqual([]);
    expect(packageProblems(form({ inst: parts("30000", "25000"), fee: "5000" }) as any, 10).join(" ")).toMatch(/must add up to the full price/);
  });
  it("tells students about the fee only when there is one", () => {
    const fmt = (k: number) => `₦${k / 100}`;
    expect(feeNote({ instalment_fee: 500000 }, fmt)).toBe("Includes a ₦5000 instalment fee");
    expect(feeNote({ instalment_fee: 0 }, fmt)).toBe("");
    expect(feeNote(undefined, fmt)).toBe("");
  });
});

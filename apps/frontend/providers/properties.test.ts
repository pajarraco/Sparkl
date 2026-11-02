import { describe, expect, it } from "vitest";
import { propertyMetaLine, validateProperty } from "./properties";

describe("validateProperty", () => {
  const valid = {
    name: "Beach Studio",
    address: "10 Queen Street",
    latitude: "-33.87",
    longitude: "151.21",
    sizeSqm: "60",
    notes: "Mop the hall",
  };

  it("accepts a complete property", () => {
    const result = validateProperty(valid);
    expect(result.errors).toEqual({});
    expect(result.data).toEqual({
      name: "Beach Studio",
      address: "10 Queen Street",
      latitude: -33.87,
      longitude: 151.21,
      sizeSqm: 60,
      defaultNotes: "Mop the hall",
    });
  });

  it("requires a name and an address", () => {
    expect(validateProperty({ ...valid, name: "" }).errors.name).toBeDefined();
    expect(
      validateProperty({ ...valid, address: "" }).errors.address,
    ).toBeDefined();
  });

  it("requires coordinates (a picked address or dropped pin)", () => {
    const result = validateProperty({
      ...valid,
      latitude: "",
      longitude: "",
    });
    expect(result.errors.address).toBeDefined();
    expect(result.data).toBeNull();
  });

  it("rejects a non-numeric size", () => {
    expect(
      validateProperty({ ...valid, sizeSqm: "big" }).errors.sizeSqm,
    ).toBeDefined();
  });

  it("omits optional fields when blank", () => {
    const result = validateProperty({ ...valid, sizeSqm: "", notes: "" });
    expect(result.data?.sizeSqm).toBeUndefined();
    expect(result.data?.defaultNotes).toBeUndefined();
  });
});

describe("propertyMetaLine", () => {
  it("formats a size, or nothing when unset", () => {
    expect(propertyMetaLine(60)).toBe("60 m²");
    expect(propertyMetaLine(null)).toBeUndefined();
  });
});

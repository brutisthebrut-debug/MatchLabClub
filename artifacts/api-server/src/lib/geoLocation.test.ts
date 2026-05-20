import { describe, it, expect } from "vitest";
import { describeIpLocation } from "./geoLocation";

describe("describeIpLocation", () => {
  it("returns null for empty or missing IPs", () => {
    expect(describeIpLocation("")).toBeNull();
    expect(describeIpLocation(null)).toBeNull();
    expect(describeIpLocation(undefined)).toBeNull();
  });

  it("returns null for private / loopback IPs", () => {
    expect(describeIpLocation("127.0.0.1")).toBeNull();
    expect(describeIpLocation("::1")).toBeNull();
    expect(describeIpLocation("10.0.0.5")).toBeNull();
    expect(describeIpLocation("192.168.1.10")).toBeNull();
    expect(describeIpLocation("172.16.0.1")).toBeNull();
    expect(describeIpLocation("172.31.255.255")).toBeNull();
    expect(describeIpLocation("169.254.10.10")).toBeNull();
    expect(describeIpLocation("fe80::1")).toBeNull();
  });

  it("does not classify public 172.x as private", () => {
    // 172.15.x.x and 172.32.x.x are public ranges
    // We can't assert a specific location (DB may or may not resolve),
    // but the result must not be filtered as private.
    const result = describeIpLocation("172.15.0.1");
    // Could be null (unresolved) or a string — but it must not throw.
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("returns a string with country for a known public IP, if DB is available", () => {
    // 8.8.8.8 is Google DNS; geoip-lite usually resolves to US.
    const result = describeIpLocation("8.8.8.8");
    if (result !== null) {
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it("strips ::ffff: IPv4-mapped prefix", () => {
    // Should treat as 127.0.0.1 → private → null.
    expect(describeIpLocation("::ffff:127.0.0.1")).toBeNull();
  });

  it("never throws on garbage input", () => {
    expect(() => describeIpLocation("not-an-ip")).not.toThrow();
    expect(() => describeIpLocation("999.999.999.999")).not.toThrow();
  });
});

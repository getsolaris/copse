declare global {
  function test(name: string, fn: () => void): void;
  function expect(actual: unknown): {
    toBe(expected: unknown): void;
  };

}

export {};

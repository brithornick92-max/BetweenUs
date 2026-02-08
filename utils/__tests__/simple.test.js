// Simple test to verify Jest setup
describe('Simple Test', () => {
  test('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should test basic JavaScript functionality', () => {
    const obj = { a: 1, b: 2 };
    expect(obj.a).toBe(1);
    expect(Object.keys(obj)).toEqual(['a', 'b']);
  });
});
import {describe, expect, test} from '@jest/globals';
import {start} from './index';

describe('sum module', () => {
  test('parse normal dependency', () => {
    expect(start('./test/normal/')).toStrictEqual({"name":"normal-test","version":"1.0.0","count":4,"hasCircularDependency":false,"map":{"normal-test":{"version":"1.0.0","dependencies":{"normal-test-x":"0","normal-test-y":"1"},"circular":false,"requiredTimes":0},"normal-test-x":{"version":"0","dependencies":{},"circular":false,"requiredTimes":1},"normal-test-y":{"version":"1","dependencies":{"normal-test-z":"2"},"circular":false,"requiredTimes":1},"normal-test-z":{"version":"2","dependencies":{},"circular":false,"requiredTimes":1}}});
  });
    test('parse circular dependency', () => {
    expect(start('./test/circular/')).toStrictEqual({"name":"circular-test","version":"1.0.0","count":4,"hasCircularDependency":true,"map":{"circular-test":{"version":"1.0.0","dependencies":{"circular-test-a":"0"},"circular":false,"requiredTimes":0},"circular-test-a":{"version":"0","dependencies":{"circular-test-b":"1"},"circular":true,"requiredTimes":2},"circular-test-b":{"version":"1","dependencies":{"circular-test-c":"2"},"circular":true,"requiredTimes":1},"circular-test-c":{"version":"2","dependencies":{"circular-test-a":"0"},"circular":true,"requiredTimes":1}}});
  });
});
# Test Plan & File Templates

## Full Test Plan Template

```markdown
# Test Plan: [Feature/Component]

## 1. Overview
| Field | Value |
|-------|-------|
| Component | |
| Test Framework | |
| Priority | High / Medium / Low |
| Estimated Tests | X unit, Y integration, Z e2e |

## 2. Test Strategy

### Test Pyramid
        /\        E2E (Few)
       /  \       - Critical user flows
      /----\
     /      \     Integration (Some)
    /--------\    - API contracts, DB operations
   /          \
  /------------\  Unit (Many)
 /              \ - Functions, components, utils

### For This Feature
- **Unit Tests**: [X tests] - [What they cover]
- **Integration Tests**: [Y tests] - [What they cover]
- **E2E Tests**: [Z tests] - [What they cover]

## 3. Unit Test Plan

### Test Suite: [Name]
**File**: `tests/unit/[name].test.ts`

| Test Case | Description | Input | Expected Output |
|-----------|-------------|-------|-----------------|
| should_do_x_when_y | | | |
| should_handle_error | | | |

## 4. Integration Test Plan

### Test Suite: [Name]
**File**: `tests/integration/[name].test.ts`

| Test Case | Components Involved | Setup Required |
|-----------|--------------------| ---------------|
| | | |

### Mocks/Stubs Needed
| Dependency | Mock Type | Behavior |
|------------|-----------|----------|
| | Full/Partial/Spy | |

## 5. E2E Test Plan (if applicable)

### Flow: [User Journey Name]
**File**: `tests/e2e/[name].spec.ts`

| Step | Action | Assertion |
|------|--------|-----------|
| 1 | Navigate to /page | Page loads |
| 2 | Click button | Modal appears |

## 6. Edge Cases & Boundaries

| Category | Test Case | Input | Expected |
|----------|-----------|-------|----------|
| Empty input | | "" / null / undefined | |
| Boundary | | min/max values | |
| Invalid | | malformed data | Error |
| Concurrent | | simultaneous calls | |
| Timeout | | slow response | |

## 7. Test Data Requirements

### Fixtures Needed
| Fixture | Purpose | Sample |
|---------|---------|--------|
| | | |

### Test Database (if needed)
- [ ] Seed data required
- [ ] Cleanup strategy

## 8. Mocking Strategy

| External Dependency | Mock Approach | Notes |
|--------------------|---------------|-------|
| API calls | MSW / Jest mock | |
| Database | In-memory / Mock | |
| Time | Jest fake timers | |
| File system | Mock fs | |

## 9. Implementation Todo

### Pending Approval

If approved, I will create these tests:

**Priority 1 (Critical)**:
- [ ] Test 1: [description]
- [ ] Test 2: [description]

**Priority 2 (Important)**:
- [ ] Test 3: [description]

**Priority 3 (Nice to Have)**:
- [ ] Test 4: [description]

**Setup Required**:
- [ ] Create test fixtures
- [ ] Set up mocks
- [ ] Configure test environment

## 10. Expected Outcomes

| Metric | Current | After Tests |
|--------|---------|-------------|
| Test count | X | Y |
| Coverage % | X% | Y% |
| Critical paths covered | X/Y | Y/Y |

---

## Approval Request

**Review this test plan and let me know:**
1. Approve all tests
2. Approve with modifications (specify)
3. Reject (explain concerns)
4. Add more tests for [specific area]
```

## Test File Template

```typescript
// tests/[type]/[name].test.ts

import { describe, it, expect, beforeEach, afterEach } from 'test-framework';
import { functionUnderTest } from '@/path/to/module';

describe('[Component/Function Name]', () => {
  // Setup
  beforeEach(() => {
    // Setup code
  });

  afterEach(() => {
    // Cleanup code
  });

  describe('[method/scenario]', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      const input = {};

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toEqual(expected);
    });

    it('should handle [edge case]', () => {
      // Test edge case
    });
  });
});
```

## Test Implementation Progress Template

```markdown
## Test Implementation Progress

**Approved Tests**: [List from approval]

| Test | File | Status | Notes |
|------|------|--------|-------|
| Test 1 | path/file.test.ts | Written | |
| Test 2 | path/file.test.ts | In Progress | |
| Test 3 | path/file.test.ts | Pending | |
```

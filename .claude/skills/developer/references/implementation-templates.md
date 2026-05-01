# Implementation Plan Templates

## Full Implementation Plan Format

```markdown
# Implementation Plan: [Project Name]

## 1. Project Setup

### Repository Structure
project-name/
+-- .claude/
|   +-- skills/          # Agent skills
|   +-- handover/        # Handover docs
+-- docs/                # All specs
+-- src/
|   +-- components/      # UI components
|   +-- pages/           # Page components
|   +-- api/             # API routes
|   +-- services/        # Business logic
|   +-- models/          # Data models
|   +-- utils/           # Helpers
|   +-- config/          # Configuration
+-- tests/
|   +-- unit/
|   +-- integration/
|   +-- e2e/
+-- scripts/             # Build/deploy scripts
+-- .env.example
+-- package.json
+-- README.md

### Initial Setup Commands
# 1. Initialize project
[command]

# 2. Install dependencies
[command]

# 3. Setup environment
[command]

# 4. Initialize database (if applicable)
[command]

# 5. Run development server
[command]

### Environment Variables
# Required
VAR_NAME=description

# Optional
OPTIONAL_VAR=description

## 2. Implementation Order

### Phase 1: Foundation
| Task | Files | Dependencies | Est. Size |
|------|-------|--------------|-----------|
| Project init | package.json, configs | None | S |
| Database setup | src/models/* | Project init | M |
| Auth scaffold | src/services/auth.* | Database | M |

### Phase 2: Core Features
| Task | Files | Dependencies | Est. Size |
|------|-------|--------------|-----------|
| | | | |

### Phase 3: Integration
| Task | Files | Dependencies | Est. Size |
|------|-------|--------------|-----------|
| | | | |

### Phase 4: Polish
| Task | Files | Dependencies | Est. Size |
|------|-------|--------------|-----------|
| | | | |

## 3. File-by-File Implementation

### File: [path/to/file.ext]
**Purpose**: [What this file does]
**Dependencies**: [What it imports]
**Key Functions**:
- `functionName()`: [Description]

**Implementation Notes**:
- [Note 1]
- [Note 2]

## 4. API Implementation Checklist

| Endpoint | Method | Handler File | Status |
|----------|--------|--------------|--------|
| /api/resource | GET | src/api/resource.ts | [ ] |
| /api/resource | POST | src/api/resource.ts | [ ] |

## 5. Component Implementation Checklist

| Component | File | Props | Status |
|-----------|------|-------|--------|
| | | | [ ] |

## 6. Testing Plan

### Unit Tests
| Test File | Covers | Priority |
|-----------|--------|----------|
| | | |

### Integration Tests
| Test | Scenario | Priority |
|------|----------|----------|
| | | |

## 7. Pre-Commit Checklist
- [ ] All tests passing
- [ ] No linting errors
- [ ] Environment variables documented
- [ ] README updated
- [ ] No secrets in code
- [ ] No console.logs (except intentional)
- [ ] Types complete (if TypeScript)
- [ ] Error handling in place
```

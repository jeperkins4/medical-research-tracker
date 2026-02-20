# Contributing to MyTreatmentPath

**Thank you for your interest in contributing!**

MyTreatmentPath is an open-source medical research assistant built by cancer patients, for patients. We welcome contributions from developers, designers, medical professionals, and patient advocates.

---

## Ways to Contribute

- 🐛 **Report bugs** - Found something broken? Open an issue
- 💡 **Suggest features** - Ideas for improvement? We'd love to hear
- 📝 **Improve docs** - Better documentation helps everyone
- 🎨 **Design improvements** - UI/UX enhancements welcome
- 💻 **Code contributions** - Bug fixes, features, tests
- 🧪 **Testing** - Try new features, report issues
- 📢 **Spread the word** - Share with your network

---

## Getting Started

### Prerequisites

- **macOS** (Apple Silicon) - Current target platform
- **Node.js 25+** - Runtime
- **Git** - Version control
- **Code editor** - VS Code recommended

### Clone & Setup

```bash
# Clone repo
git clone https://github.com/jeperkins4/medical-research-tracker.git
cd medical-research-tracker

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your keys (see below)

# Start development
npm run dev      # Terminal 1: Frontend (http://localhost:5173)
npm run server   # Terminal 2: Backend (http://localhost:3000)
```

### Environment Variables

Create `.env` in project root:

```bash
# Required
DB_ENCRYPTION_KEY=your-32-byte-key-here  # Generate with: openssl rand -hex 32
BACKUP_ENCRYPTION_KEY=your-32-byte-key-here
JWT_SECRET=your-32-byte-key-here

# Optional (for AI features)
ANTHROPIC_API_KEY=sk-ant-...  # Claude API key

# Optional (for cloud sync)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

---

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

**Code structure:**
```
src/                  # React frontend
├── App.jsx          # Main app
├── components/      # Reusable components
├── pages/           # Full-page views
└── utils/           # Helpers

server/              # Express backend
├── index.js         # Main server
├── db-secure.js     # Database
├── auth.js          # Authentication
└── migrations/      # Database migrations
```

### 3. Test Locally

```bash
# Run both servers
npm run dev      # Frontend
npm run server   # Backend

# Test in browser
open http://localhost:5173
```

### 4. Commit Changes

```bash
git add .
git commit -m "Add: feature description"
# or
git commit -m "Fix: bug description"
```

**Commit message format:**
- `Add: ` - New feature
- `Fix: ` - Bug fix
- `Update: ` - Improve existing feature
- `Docs: ` - Documentation only
- `Refactor: ` - Code cleanup, no behavior change
- `Test: ` - Add/update tests

### 5. Push & Pull Request

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub with:
- **Title:** Clear, descriptive (e.g., "Add multi-user signup support")
- **Description:** What changed, why, how to test
- **Screenshots:** For UI changes
- **Related issues:** Link to issue # if applicable

---

## Code Style

### JavaScript/React

- **ES modules:** Use `import/export` (not `require`)
- **Async/await:** Prefer over `.then()` chains
- **Arrow functions:** For callbacks
- **Destructuring:** Use when readable
- **Comments:** Explain *why*, not *what*

**Example:**
```javascript
// Good
const [loading, setLoading] = useState(false);

const fetchMedications = async () => {
  try {
    const response = await fetch('/api/medications', { credentials: 'include' });
    const data = await response.json();
    setMedications(data);
  } catch (err) {
    console.error('Failed to load medications:', err);
  }
};

// Avoid
var loading = false;
fetch('/api/medications').then(function(response) {
  return response.json();
}).then(function(data) {
  // ...
});
```

### CSS

- **Mobile-first:** Start with mobile, add desktop styles with `@media (min-width: ...)`
- **BEM naming:** `.component__element--modifier`
- **Variables:** Use CSS custom properties for colors
- **Responsive:** Test on different screen sizes

### Database

- **Parameterized queries:** Always use placeholders
- **Indexes:** Add for foreign keys + frequently queried columns
- **Migrations:** One file per schema change

**Example:**
```javascript
// Good
const users = query('SELECT * FROM users WHERE username = ?', [username]);

// NEVER
const users = query(`SELECT * FROM users WHERE username = '${username}'`);
```

---

## Testing

### Manual Testing

1. **Create account** - Test signup flow
2. **Add data** - Medications, labs, vitals, papers
3. **Cloud sync** - Connect to cloud, sync papers
4. **Offline mode** - Disconnect internet, verify app works
5. **Backup/restore** - Test encrypted backups

### Automated Testing (Future)

Not yet implemented. Planned:
- Unit tests (Jest)
- Integration tests (Supertest)
- E2E tests (Playwright)

---

## Documentation

### When to Update Docs

- **New feature?** Add to `docs/features/`
- **API change?** Update `docs/development/api-reference.md`
- **Database schema change?** Update `docs/development/database-schema.md`
- **Deployment process change?** Update `docs/deployment/`

### Markdown Style

- **Headers:** One `#` for title, `##` for sections
- **Code blocks:** Always specify language (```javascript)
- **Links:** Use relative paths for internal docs
- **Lists:** `-` for bullets, `1.` for numbers

---

## Pull Request Checklist

Before submitting:

- [ ] Code follows style guide
- [ ] Tested locally (frontend + backend)
- [ ] No console errors
- [ ] Database migrations work
- [ ] Documentation updated
- [ ] Commit messages clear
- [ ] No secrets in code (API keys in .env only)

---

## Reporting Bugs

### Before Reporting

1. **Search existing issues** - Maybe already reported
2. **Try latest version** - Bug might be fixed
3. **Reproduce** - Can you make it happen again?

### Bug Report Template

```markdown
**Describe the bug**
Clear description of what went wrong.

**To Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable.

**Environment:**
- OS: macOS 14.3
- Version: 0.1.1
- Browser: Chrome 121

**Additional context**
Any other details.
```

---

## Feature Requests

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
Clear description of the problem.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives**
Other solutions you considered.

**Additional context**
Mockups, examples, etc.
```

---

## Community Guidelines

### Be Respectful

- This is a patient-built tool for patients
- Many contributors have cancer or are caregivers
- Be kind, empathetic, constructive

### Be Professional

- No spam, self-promotion, or off-topic posts
- Stay focused on improving the project
- Respect maintainer decisions

### Be Patient

- Maintainers are often patients/caregivers with limited time
- Reviews may take days/weeks
- PRs may be closed if not aligned with project goals

---

## Questions?

- **General questions:** Open a GitHub Discussion
- **Bug reports:** Open an issue
- **Security issues:** Email directly (do not post publicly)
- **Feature ideas:** Open an issue with [Feature Request] tag

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

---

**Thank you for helping make MyTreatmentPath better for the cancer patient community!** 💙

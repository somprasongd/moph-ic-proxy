# CLAUDE.md

@AGENTS.md

All skills from `.agents/skills/` must be symlinked for Claude Code to recognize them:

```bash
# macOS/Linux:
ln -s ../.agents/skills .claude/skills
# Windows (run as Admin or in Developer Mode):
mklink /D ".claude\skills" "..\..\.agents\skills"
```

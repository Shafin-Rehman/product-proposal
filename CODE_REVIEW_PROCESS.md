# BudgetBuddy Code Review Process

## Overview

The purpose of this document is to define the code review workflow used for the BudgetBuddy project.

Code reviews help ensure code quality, maintainability, and collaboration between team members.

All code contributions should be submitted through pull requests and reviewed before merging into the main branch.

---

## Development Workflow

1. A developer creates a feature branch.
2. Changes are implemented on that branch.
3. A Pull Request is opened against the main branch.
4. At least one reviewer reviews the pull request.
5. Feedback is provided if needed.
6. The pull request is merged using squash merge.

---

## Review Checklist

During code review, the reviewer checks for:

• Correct functionality  
• Code readability  
• Consistent coding style  
• Logical structure  
• Potential bugs  
• Error handling  
• Test coverage

---

## Branch Protection

To maintain repository quality:

• Direct commits to main should be avoided  
• Pull requests should be reviewed before merging  
• Automated tests should run through GitHub Actions

---

## Merge Strategy

The repository uses **Squash and Merge**.

This keeps the commit history clean by combining feature commits into a single commit.

---

## Continuous Improvement

As the project evolves, the code review process may be updated to improve development efficiency and maintain high code quality.

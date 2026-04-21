# BudgetBuddy Architecture

## Step 1: High-Level Component Diagram

```mermaid
graph TD
    User["👤 User (Browser)"]

    subgraph Frontend ["Next.js Frontend (App Router)"]
        Pages["Pages\n(Dashboard, Transactions,\nInsights, Account)"]
        Components["Components\n(TransactionsView,\nInsightsView, AccountPage)"]
        Providers["Providers\n(AuthContext, ThemeContext,\nDataModeContext)"]
    end

    subgraph Backend ["Next.js API Routes"]
        AuthAPI["Auth API\n(/api/login, /api/signup)"]
        ExpensesAPI["Expenses API\n(/api/expenses)"]
        IncomeAPI["Income API\n(/api/income)"]
        BudgetAPI["Budget API\n(/api/budget/summary)"]
    end

    subgraph Database ["Supabase (PostgreSQL)"]
        UsersTable["users"]
        ExpensesTable["expenses"]
        IncomeTable["income"]
        CategoriesTable["categories"]
        BudgetsTable["budgets"]
    end

    subgraph CI ["GitHub Actions CI/CD"]
        BackendCI["Backend CI\n(install, test, coverage)"]
        DBMigrations["DB Migrations\n(push schema to Supabase)"]
    end

    User -->|"HTTPS"| Frontend
    Pages --> Components
    Components --> Providers
    Components -->|"fetch"| Backend
    Backend -->|"SQL"| Database
    CI -->|"on push to main"| Backend
    CI -->|"on push to main"| Database
```

The BudgetBuddy application is structured as a full-stack Next.js application. The **frontend** consists of React pages and components powered by context providers that manage authentication state, theme preferences, and data mode (live vs. sample). The **backend** is built using Next.js API routes that handle authentication, expenses, income, and budget summary operations. All persistent data is stored in a **Supabase PostgreSQL database**, which includes tables for users, expenses, income, categories, and budgets. A **GitHub Actions CI/CD pipeline** runs automatically on every push to main, executing backend tests and pushing any database schema migrations to Supabase.

---

## Step 2: Entity Relationship Diagram

```mermaid
erDiagram
    users {
        UUID id PK
        TEXT email
        TIMESTAMPTZ created_at
    }

    categories {
        UUID id PK
        UUID user_id FK
        TEXT name
        TEXT icon
        TIMESTAMPTZ created_at
    }

    expenses {
        UUID id PK
        UUID user_id FK
        UUID category_id FK
        NUMERIC amount
        TEXT description
        DATE date
        TIMESTAMPTZ created_at
    }

    income_sources {
        UUID id PK
        TEXT name
        TEXT icon
    }

    income {
        UUID id PK
        UUID user_id FK
        UUID source_id FK
        NUMERIC amount
        DATE date
        TEXT notes
        TIMESTAMPTZ created_at
    }

    budget_thresholds {
        UUID id PK
        UUID user_id FK
        NUMERIC monthly_limit
        DATE month
        BOOLEAN notified
        TIMESTAMPTZ created_at
    }

    category_budgets {
        UUID id PK
        UUID user_id FK
        UUID category_id FK
        DATE month
        NUMERIC monthly_limit
        TIMESTAMPTZ created_at
    }

    users ||--o{ categories : "owns"
    users ||--o{ expenses : "logs"
    users ||--o{ income : "records"
    users ||--o{ budget_thresholds : "sets"
    users ||--o{ category_budgets : "configures"
    categories ||--o{ expenses : "categorizes"
    categories ||--o{ category_budgets : "scoped to"
    income_sources ||--o{ income : "labels"
```

The BudgetBuddy database is organized around the **users** table, which is the central entity that owns all financial data. Each user can log **expenses**, which are optionally linked to a **category** (e.g. Food, Shopping, Health). Users can also record **income** entries, each linked to a shared **income_sources** table (e.g. Salary, Freelance). Budget tracking is handled through two tables: **budget_thresholds** stores a user's overall monthly spending limit and tracks whether an alert has been sent, while **category_budgets** allows users to set per-category monthly limits for more granular budget planning.

---
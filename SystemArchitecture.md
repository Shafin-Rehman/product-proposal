# BudgetBuddy Architecture
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
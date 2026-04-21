# BudgetBuddy Architecture

## 1. High-Level Component Diagram

```mermaid
flowchart TD
    subgraph "Client Side (Browser)"
        UI["User Interface\n(React Components, Tailwind CSS, Charts)"]
        Forms["Forms & Interactions"]
    end

    subgraph "Next.js Application"
        Pages["App Router Pages & Server Components"]
        ServerActions["Server Actions / API Routes"]
        Client["Client Components"]
    end

    subgraph "Supabase Backend"
        Auth["Authentication\n(Supabase Auth + RLS)"]
        DB["PostgreSQL Database\n(Users, Transactions, Budgets, Categories)"]
        Storage["Storage (Receipts/Files if needed)"]
    end

    UI --> Forms
    Forms <--> Client
    Client <--> ServerActions
    Pages <--> ServerActions
    ServerActions <--> Auth
    ServerActions <--> DB


    BudgetBuddy uses a modern full-stack architecture with Next.js on the frontend and Supabase as the backend. The client-side UI interacts with Next.js server components and API routes, which securely communicate with Supabase’s PostgreSQL database and authentication service.
text
```

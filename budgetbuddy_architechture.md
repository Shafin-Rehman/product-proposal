# BudgetBuddy Architecture

High-Level Component Diagram

<img width="3554" height="1110" alt="mermaid-diagram" src="https://github.com/user-attachments/assets/0a62634a-7cba-410c-9a25-17512d2e3169" />


This chart shows the main parts of BudgetBuddy and how they connect. The user opens the app in the browser through the Next.js/React frontend. The frontend handles what the user sees, like the dashboard, forms, and budget pages. When the user logs in, the app checks their session through Supabase Auth. When the user adds or views financial data, the frontend sends the request to the Next.js API or server actions. From there, the app reads and writes data in the Supabase PostgreSQL database. The business logic part calculates totals, budget progress, savings goals, and alerts before sending the updated information back to the frontend.

Entity Relationship Diagram

<img width="4105" height="1916" alt="mermaid-diagram (1)" src="https://github.com/user-attachments/assets/6ad404f8-5229-408a-956a-1f2e8de47270" />


This chart shows how the database tables are connected. The main table is `USERS`, because every user owns their own financial data. A user can create many categories, expenses, income records, budgets, savings goals, and recurring rules. Categories help organize expenses and income, such as food, rent, school, or work. The budget tables connect to users and categories so the app can compare spending against limits. This is how BudgetBuddy knows which expenses belong to which user and how to calculate each person’s financial summary separately.

Call Sequence Diagram

<img width="3124" height="1690" alt="mermaid-diagram (2)" src="https://github.com/user-attachments/assets/a33344e6-41e3-497f-813c-76c92ae0131c" />


This chart shows the step-by-step flow when a user adds a new expense. First, the user opens the expense form in the app. The frontend checks that the user is logged in through Supabase Auth. After the user enters the expense details, the frontend sends that data to the backend. The backend validates the amount, category, and date, then saves the expense in the database. After saving, the app recalculates the user’s monthly spending and checks it against their budget limits. Finally, the updated budget summary is sent back to the frontend, and the user sees the dashboard update.

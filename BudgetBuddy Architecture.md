## Step 1


Explanation:
The browser sends a request to the Next.js application which renders various frontend pages. This sends an HTTP request to the API client which is sent through routing to access the various API endpoints. The API endpoints have access to the Supabase database.

Also, the GitHub Actions workflow has access to DB migrations, as well as running tests with CI, and deployment to Vercel.

---

## Step 2


User table represents individual users of the system, and is appointed a uniqueID. All references in other tables of a userID originate from this table.

categories table stores spending categories, such as Food and Transit.

expenses table tracks individual spending events, tied to a specific user with the amount, a description, and date.

income_sources has possible sources of income, such as Salary, Investment, and Freelance.

income records each instance a user receives income, including the amount, notes, and source, which is linked to the income_sources table.

budget_thresholds stores the monthly limit for a specific user and month, along with a flag which states if the user was notified about exceeding the limit.

category_budgets allows the user to set monthly limits for a specific category, and it is linked to the specific category, user, a month, and the limit set.

---

## Step 3


The user in the frontend makes a POST request to /api/budget endpoint. The handler first authenticates the user by calling the authenticate function which is run by Supabase to authenticate. If the token is valid, Supabase returns the User ID, and if invalid, it sends an error.

The next step depends on the JSON sent in the POST request. If only monthly_limit is present and not category_budgets, it will upsert the normal budget_thresholds table. If it sends only category_budgets, it will upsert only the budgets per category. If both are sent, both tables will be updated together. Essentially, each one is to control either the overall budget or a category-specific budget. Finally, the database success leads to a 200 OK status to the user.
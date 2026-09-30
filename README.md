# Customer Portal

Simple Customer Portal (Node.js + Express) with customer registration and details.

## API
| Method | Path | Description |
|---|---|---|
| GET | /health | Health status |
| POST | /api/customers/register | Register (name, email, password, phone?, address?) |
| GET | /api/customers | List customers |
| GET | /api/customers/:id | Customer details |
| PUT | /api/customers/:id | Update details |
| DELETE | /api/customers/:id | Delete customer |

Auth: `POST /api/auth/login` returns a token (send as `Authorization: Bearer <token>`), `POST /api/auth/logout`, `GET /api/me`.
Details/update/delete need login and only work on your own record. `GET /api/customers` (list) is admin-only.
Set `ADMIN_EMAIL` to the email of the customer who should be the admin.

Website (single page, `/`): Home, Register, Login, Dashboard (view/edit/delete own details), Admin (customer list).

## Run locally
    npm install
    npm test
    npm start

## Docker
    docker build --target test -t customer-portal:test .   # runs the tests
    docker build -t customer-portal .
    docker run -d --name customer-portal -p 8085:3000 -e ADMIN_EMAIL=you@example.com customer-portal

## Jenkins
The `Jenkinsfile` stages: Checkout (from Git) > Test > Build Image > Deploy > Health Check.
Create a Pipeline job with "Pipeline script from SCM", Git, branch `*/main`, script path `Jenkinsfile`.

Data is stored in memory and resets on restart. Passwords are hashed with scrypt.

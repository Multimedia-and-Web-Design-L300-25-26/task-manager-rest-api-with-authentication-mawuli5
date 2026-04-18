# Task Manager REST API

A RESTful API built with Node.js, Express, and MongoDB featuring JWT authentication and protected task routes.

## Setup

```bash
npm install
cp .env.example .env
# Fill in your MONGO_URI and JWT_SECRET in .env
```

## Running

```bash
npm run dev   # development
npm start     # production
npm test      # run tests
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |

### Tasks (require `Authorization: Bearer <token>`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tasks` | Create a task |
| GET | `/api/tasks` | Get user's tasks |
| DELETE | `/api/tasks/:id` | Delete a task |

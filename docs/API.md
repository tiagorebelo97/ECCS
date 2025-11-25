# ECCS API Documentation

## Authentication

All API endpoints (except auth endpoints) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Auth Service Endpoints

### Register User

**POST** `/api/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Login

**POST** `/api/auth/login`

Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Verify Token

**GET** `/api/auth/verify`

Verify if the current JWT token is valid.

**Response (200 OK):**
```json
{
  "valid": true,
  "user": {
    "userId": 1,
    "email": "user@example.com"
  }
}
```

### Refresh Token

**POST** `/api/auth/refresh`

Get a new JWT token using the current (potentially expired) token.

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Email Service Endpoints

### Get Email Statistics

**GET** `/api/emails/stats`

Get email statistics for the authenticated user.

**Response (200 OK):**
```json
{
  "totalEmails": 150,
  "sentToday": 12,
  "pending": 3,
  "failed": 1
}
```

### List Emails

**GET** `/api/emails`

Get all emails for the authenticated user.

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "recipient": "recipient@example.com",
    "subject": "Hello World",
    "body": "This is a test email",
    "status": "sent",
    "created_at": "2024-01-15T10:30:00Z",
    "sent_at": "2024-01-15T10:30:05Z"
  }
]
```

### Send Email

**POST** `/api/emails/send`

Queue an email for sending.

**Request Body:**
```json
{
  "to": "recipient@example.com",
  "subject": "Hello World",
  "body": "This is a test email"
}
```

**Response (201 Created):**
```json
{
  "message": "Email queued for sending",
  "email": {
    "id": 1,
    "user_id": 1,
    "recipient": "recipient@example.com",
    "subject": "Hello World",
    "body": "This is a test email",
    "status": "pending",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### Get Email Details

**GET** `/api/emails/:id`

Get details of a specific email.

**Response (200 OK):**
```json
{
  "id": 1,
  "user_id": 1,
  "recipient": "recipient@example.com",
  "subject": "Hello World",
  "body": "This is a test email",
  "status": "sent",
  "created_at": "2024-01-15T10:30:00Z",
  "sent_at": "2024-01-15T10:30:05Z"
}
```

## Error Responses

### 400 Bad Request

```json
{
  "errors": [
    {
      "field": "email",
      "message": "Valid email required"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "error": "Invalid or expired token"
}
```

### 404 Not Found

```json
{
  "error": "Email not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Rate**: 100 requests per minute
- **Burst**: 50 requests

When rate limited, you'll receive a `429 Too Many Requests` response.

## Health Endpoints

Each service exposes a health check endpoint:

- Email Service: `GET /health`
- Auth Service: `GET /health`
- Notification Service: `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "service": "email-service"
}
```

## Metrics Endpoints

Each service exposes Prometheus metrics:

- Email Service: `GET /metrics`
- Auth Service: `GET /metrics`
- Notification Service: `GET /metrics`

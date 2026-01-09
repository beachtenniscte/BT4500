# API Documentation - Liga BT4500

This document describes the expected API structure for the Liga BT4500 React application.

## Base URL

```
http://your-api-url.com/api
```

Set this in your `.env` file as `VITE_API_URL`

---

## Endpoints

### 1. Get Info Content

**Endpoint:** `GET /info`

**Description:** Returns the content for the Info page.

**Response:**
```json
{
  "paragraph1": "É com este objectivo em mente que nasce a Liga BT4500...",
  "paragraph2": "Acreditamos que a colaboração da comunidade é fundamental..."
}
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Server error

---

### 2. Get All Provas

**Endpoint:** `GET /provas`

**Description:** Returns a list of all scheduled provas (events).

**Response:**
```json
[
  {
    "id": 1,
    "type": "PRATA",
    "dates": "10-11 MAI"
  },
  {
    "id": 2,
    "type": "BRONZE",
    "dates": "21-22 JUN"
  },
  {
    "id": 3,
    "type": "PRATA",
    "dates": "26-27 JUL"
  },
  {
    "id": 4,
    "type": "OURO",
    "dates": "15-17 AGO"
  }
]
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Server error

---

### 3. Get Prova by ID

**Endpoint:** `GET /provas/:id`

**Description:** Returns details of a specific prova.

**Parameters:**
- `id` (path parameter) - The prova ID

**Response:**
```json
{
  "id": 1,
  "type": "PRATA",
  "dates": "10-11 MAI",
  "location": "Clube Ténis Espinho",
  "description": "Detailed prova information...",
  "participants": 24,
  "status": "upcoming"
}
```

**Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Prova not found
- `500 Internal Server Error` - Server error

---

### 4. Get Classification

**Endpoint:** `GET /classification`

**Description:** Returns the current team standings/classification.

**Response:**
```json
[
  {
    "position": 1,
    "team": "Equipa A",
    "points": 150,
    "games": 10,
    "wins": 8
  },
  {
    "position": 2,
    "team": "Equipa B",
    "points": 140,
    "games": 10,
    "wins": 7
  },
  {
    "position": 3,
    "team": "Equipa C",
    "points": 130,
    "games": 10,
    "wins": 6
  }
]
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Server error

---

### 5. Create Prova (Admin)

**Endpoint:** `POST /provas`

**Description:** Creates a new prova.

**Request Body:**
```json
{
  "type": "OURO",
  "dates": "12-14 SET",
  "location": "Clube Ténis Espinho",
  "description": "Championship finals"
}
```

**Response:**
```json
{
  "id": 7,
  "type": "OURO",
  "dates": "12-14 SET",
  "location": "Clube Ténis Espinho",
  "description": "Championship finals",
  "createdAt": "2025-01-08T10:00:00Z"
}
```

**Status Codes:**
- `201 Created` - Prova created successfully
- `400 Bad Request` - Invalid request body
- `401 Unauthorized` - Authentication required
- `500 Internal Server Error` - Server error

---

### 6. Update Classification (Admin)

**Endpoint:** `PUT /classification/:id`

**Description:** Updates a team's classification data.

**Parameters:**
- `id` (path parameter) - The team ID

**Request Body:**
```json
{
  "position": 1,
  "team": "Equipa A",
  "points": 160,
  "games": 11,
  "wins": 9
}
```

**Response:**
```json
{
  "id": 1,
  "position": 1,
  "team": "Equipa A",
  "points": 160,
  "games": 11,
  "wins": 9,
  "updatedAt": "2025-01-08T10:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Successfully updated
- `400 Bad Request` - Invalid request body
- `401 Unauthorized` - Authentication required
- `404 Not Found` - Team not found
- `500 Internal Server Error` - Server error

---

### 7. Delete Prova (Admin)

**Endpoint:** `DELETE /provas/:id`

**Description:** Deletes a prova.

**Parameters:**
- `id` (path parameter) - The prova ID to delete

**Response:**
```json
{
  "message": "Prova deleted successfully",
  "id": 7
}
```

**Status Codes:**
- `200 OK` - Successfully deleted
- `401 Unauthorized` - Authentication required
- `404 Not Found` - Prova not found
- `500 Internal Server Error` - Server error

---

## Authentication (Optional)

If your API requires authentication, add authentication headers in the `api.js` service:

```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
  ...options.headers,
}
```

## CORS Configuration

Ensure your backend API allows requests from your React app's origin:

```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Error Handling

All endpoints should return consistent error responses:

```json
{
  "error": "Error message",
  "status": 400,
  "details": "Additional error details if available"
}
```

## Data Validation

### Prova Object
- `type`: String (e.g., "OURO", "PRATA", "BRONZE")
- `dates`: String (e.g., "10-11 MAI")
- `id`: Number (unique identifier)

### Classification Object
- `position`: Number (1, 2, 3, ...)
- `team`: String (team name)
- `points`: Number (total points)
- `games`: Number (games played)
- `wins`: Number (games won)

## Example Backend Implementation

### Node.js + Express Example

```javascript
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Get all provas
app.get('/api/provas', (req, res) => {
  // Fetch from database
  res.json(provas);
});

// Get classification
app.get('/api/classification', (req, res) => {
  // Fetch from database
  res.json(classification);
});

app.listen(3000, () => {
  console.log('API running on port 3000');
});
```

## Testing the API

Use tools like:
- **Postman** - API testing
- **curl** - Command line testing
- **Thunder Client** - VS Code extension

Example curl command:
```bash
curl http://localhost:3000/api/provas
```

## Rate Limiting

Consider implementing rate limiting on your API:
- Max 100 requests per minute per IP
- Max 1000 requests per hour per IP

## Caching

For better performance, consider:
- Server-side caching (Redis)
- HTTP cache headers
- Client-side caching in React

## Notes

- All dates are in Portuguese format
- Times are in UTC
- IDs are auto-incrementing integers
- All text content is in Portuguese

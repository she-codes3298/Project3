# AI-Based Learning Assistant

An intelligent web application designed to transform traditional rote learning into active, conceptual understanding through AI-powered learning tools.

## Overview

The AI-Based Learning Assistant helps high school students move beyond passive memorization by converting handwritten or printed notes into interactive learning materials. Using OCR and AI technology, the platform generates flashcards, multiple-choice questions, mind maps, and personalized explanations to enhance comprehension and long-term retention.

## Key Features

- **📸 Digital Note Conversion**: Upload up to 5 images of handwritten or printed notes
- **🤖 AI-Powered Content Generation**:
  - Interactive flashcards for active recall
  - Multiple-choice questions for self-assessment
  - Visual mind maps showing concept relationships
  - Simplified explanations using the Feynman Technique
- **📅 Spaced Repetition System**: Scientifically-backed SM-2 algorithm for optimal review scheduling
- **🔐 Secure Authentication**: JWT-based user authentication and session management
- **📊 Progress Tracking**: Monitor learning patterns and identify areas needing focus

## Technology Stack

### Frontend
- React.js 18.x
- React Router v6
- D3.js (mind map visualization)
- Axios (API communication)

### Backend
- Node.js with Express.js 4.x
- PostgreSQL 14
- JWT authentication
- bcrypt (password hashing)

### External APIs
- **Google Vision API**: Optical Character Recognition (OCR)
- **OpenAI API**: Intelligent content analysis and generation

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v14 or higher)
- Google Cloud account with Vision API enabled
- OpenAI API key

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd ai-learning-assistant
```

2. **Install dependencies**

Frontend:
```bash
cd frontend
npm install
```

Backend:
```bash
cd backend
npm install
```

3. **Set up environment variables**

Create a `.env` file in the backend directory:
```env
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/learning_db
JWT_SECRET=your_jwt_secret_key
GOOGLE_VISION_API_KEY=your_google_vision_api_key
OPENAI_API_KEY=your_openai_api_key
```

4. **Set up the database**

Create PostgreSQL database and run migrations:
```sql
CREATE DATABASE learning_db;
```

Run the schema creation script (see Database Schema section below).

## Database Schema

```sql
-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notes Table
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Spaced Repetition Table
CREATE TABLE spaced_repetition (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
    ease_factor DECIMAL DEFAULT 2.5,
    repetition_count INTEGER DEFAULT 0,
    interval_days INTEGER DEFAULT 1,
    last_reviewed TIMESTAMP,
    next_review TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Explanation History Table
CREATE TABLE explanation_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    user_explanation TEXT,
    ai_feedback JSONB,
    understanding_score INTEGER CHECK (understanding_score BETWEEN 0 AND 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Running the Application

1. **Start the backend server**
```bash
cd backend
npm start
```
The server will run on `http://localhost:5000`

2. **Start the frontend development server**
```bash
cd frontend
npm start
```
The application will open at `http://localhost:3000`

## Usage

1. **Register/Login**: Create an account or log in with existing credentials
2. **Upload Notes**: Upload up to 5 images of your handwritten or printed notes
3. **Generate Learning Materials**: Choose from available options:
   - Generate flashcards for active recall practice
   - Create MCQs for self-assessment
   - Visualize concepts with mind maps
   - Get AI explanations for difficult topics
4. **Schedule Reviews**: Add notes to spaced repetition for long-term retention
5. **Track Progress**: Monitor your learning through review statistics

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

### Notes Management
- `POST /api/notes/upload` - Upload images and extract text
- `GET /api/notes/:id` - Get note content

### AI Features
- `POST /api/flashcards` - Generate flashcards
- `POST /api/learn` - Generate MCQs
- `POST /api/mindmap` - Create mind map
- `POST /api/explain-feedback` - Get AI explanation

### Spaced Repetition
- `GET /api/spaced-repetition/due/:userId` - Get due reviews
- `GET /api/spaced-repetition/scheduled/:userId` - Get scheduled reviews
- `POST /api/spaced-repetition/review` - Submit review and update schedule
- `DELETE /api/spaced-repetition/:userId/:noteId` - Remove from schedule

## Testing

The system has been comprehensively tested with:
- 18 test cases executed
- 100% pass rate
- Coverage includes authentication, OCR, AI generation, spaced repetition, and database operations

Run tests:
```bash
npm test
```

## Project Structure

```
Project3/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.js
│   └── package.json
├── backend/
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   └── server.js
└── README.md
```

## Limitations

- Maximum 5 images per upload session
- OCR accuracy depends on image quality (85-98%)
- Supported formats: JPEG, PNG, PDF
- Maximum file size: 10MB per image

## Future Enhancements

- Mobile native applications (iOS/Android)
- Multilingual OCR support
- Collaborative study groups
- Advanced analytics dashboard
- Offline mode with synchronization

## Contributing

This project was developed as part of an academic project at IIT Senapati, Manipur. For contributions or suggestions, please contact the project maintainer.

## License

This project is submitted as part of the B.Tech curriculum in Computer Science and Engineering.

## Author

**Rupali Bharti** 
Indian Institute of Information Technology Senapati, Manipur



## Acknowledgements

- Google Cloud Platform for Vision API
- OpenAI for GPT API
- IIT Senapati, Manipur faculty and peers for guidance and support

---

**Date**: November 2025

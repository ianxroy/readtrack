# ReadTrack Setup

## Prerequisites
- **Node.js** (v18+)
- **Python** (3.8+)

## Quick Start

### 1. Backend Setup
Open a terminal and run:

`ash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate       # Windows
# source .venv/bin/activate    # Mac/Linux

pip install -r requirements.txt
# Create a .env file in /backend with: GEMINI_API_KEY=your_key_here

python main.py
`
*Server runs at: http://localhost:8000*

### 2. Frontend Setup
Open a **new** terminal in the project root and run:

`ash
npm install
npm run dev
`
*App runs at: http://localhost:5173*
